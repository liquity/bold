import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { StakePositionSummary } from "@/src/comps/StakePositionSummary/StakePositionSummary";
import { dnum18 } from "@/src/dnum-utils";
import { signPermit } from "@/src/permit";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { usePrice } from "@/src/services/Prices";
import { vDnum, vPositionStake } from "@/src/valibot-utils";
import { useAccount } from "@/src/wagmi-utils";
import * as dn from "dnum";
import * as v from "valibot";
import { encodeFunctionData, maxUint256 } from "viem";
import { getBytecode } from "wagmi/actions";
import { createRequestSchema, verifyTransaction } from "./shared";

const RequestSchema = createRequestSchema(
  "stakeDeposit",
  {
    lqtyAmount: vDnum(),
    stakePosition: vPositionStake(),
    prevStakePosition: v.union([v.null(), vPositionStake()]),
  },
);

export type StakeDepositRequest = v.InferOutput<typeof RequestSchema>;

export const stakeDeposit: FlowDeclaration<StakeDepositRequest> = {
  title: "Review & Send Transaction",

  Summary({ request }) {
    return (
      <StakePositionSummary
        prevStakePosition={request.prevStakePosition}
        stakePosition={request.stakePosition}
        txPreviewMode
      />
    );
  },

  Details({ request }) {
    const lqtyPrice = usePrice("LQTY");
    return (
      <TransactionDetailsRow
        label="You deposit"
        value={[
          <Amount
            key="start"
            suffix=" LQTY"
            value={request.lqtyAmount}
          />,
          <Amount
            key="end"
            prefix="$"
            value={lqtyPrice.data && dn.mul(request.lqtyAmount, lqtyPrice.data)}
          />,
        ]}
      />
    );
  },

  steps: {
    deployUserProxy: {
      name: () => "Initialize Staking",
      Status: TransactionStatus,
      async commit(ctx) {
        return ctx.writeContract({
          ...ctx.contracts.Governance,
          functionName: "deployUserProxy",
        });
      },
      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },

    approve: {
      name: () => "Approve LQTY",
      Status: (props) => {
        const account = useAccount();
        return (
          <TransactionStatus
            {...props}
            // don’t use permit for safe transactions
            approval={account.safeStatus === null ? "all" : "approve-only"}
          />
        );
      },
      async commit(ctx) {
        const userProxyAddress = await ctx.readContract({
          ...ctx.contracts.Governance,
          functionName: "deriveUserProxyAddress",
          args: [ctx.account],
        });

        // permit
        if (ctx.preferredApproveMethod === "permit" && !ctx.isSafe) {
          const { deadline, ...permit } = await signPermit({
            token: ctx.contracts.LqtyToken.address,
            spender: userProxyAddress,
            value: ctx.request.lqtyAmount[0],
            account: ctx.account,
            wagmiConfig: ctx.wagmiConfig,
          });

          return "permit:" + JSON.stringify({
            ...permit,
            deadline: Number(deadline),
            userProxyAddress,
          });
        }

        // approve()
        return ctx.writeContract({
          ...ctx.contracts.LqtyToken,
          functionName: "approve",
          args: [
            userProxyAddress,
            ctx.preferredApproveMethod === "approve-infinite"
              ? maxUint256 // infinite approval
              : ctx.request.lqtyAmount[0], // exact amount
          ],
        });
      },
      async verify(ctx, hash) {
        if (!hash.startsWith("permit:")) {
          await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
        }
      },
    },

    // reset allocations + deposit LQTY in a single transaction
    deposit: {
      name: () => "Stake",
      Status: TransactionStatus,
      async commit(ctx) {
        const { Governance } = ctx.contracts;
        const inputs: `0x${string}`[] = [];

        const approveStep = ctx.steps?.find((step) => step.id === "approve");
        const isPermit = approveStep?.artifact?.startsWith("permit:") === true;

        // deposit LQTY via permit
        if (isPermit) {
          const { userProxyAddress, ...permit } = JSON.parse(
            approveStep?.artifact?.replace(/^permit:/, "") ?? "{}",
          );
          inputs.push(encodeFunctionData({
            abi: Governance.abi,
            functionName: "depositLQTYViaPermit",
            args: [ctx.request.lqtyAmount[0], {
              owner: ctx.account,
              spender: userProxyAddress,
              value: ctx.request.lqtyAmount[0],
              deadline: permit.deadline,
              v: permit.v,
              r: permit.r,
              s: permit.s,
            }],
          }));
        } else {
          const userProxyAddress = await ctx.readContract({
            ...Governance,
            functionName: "deriveUserProxyAddress",
            args: [ctx.account],
          });

          const lqtyAllowance = await ctx.readContract({
            ...ctx.contracts.LqtyToken,
            functionName: "allowance",
            args: [ctx.account, userProxyAddress],
          });

          if (dn.gt(ctx.request.lqtyAmount, dnum18(lqtyAllowance))) {
            throw new Error("LQTY allowance is not enough");
          }

          // deposit approved LQTY
          inputs.push(encodeFunctionData({
            abi: Governance.abi,
            functionName: "depositLQTY",
            args: [ctx.request.lqtyAmount[0]],
          }));
        }

        return ctx.writeContract({
          ...Governance,
          functionName: "multiDelegateCall",
          args: [inputs],
        });
      },
      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },
  },

  async getSteps(ctx) {
    const steps: string[] = [];

    // get the user proxy address
    const userProxyAddress = await ctx.readContract({
      ...ctx.contracts.Governance,
      functionName: "deriveUserProxyAddress",
      args: [ctx.account],
    });

    // check if the user proxy contract exists
    const userProxyBytecode = await getBytecode(ctx.wagmiConfig, {
      address: userProxyAddress,
    });

    // deploy the user proxy (optional, but prevents wallets
    // to show a warning for approving a non-deployed contract)
    if (!userProxyBytecode) {
      steps.push("deployUserProxy");
    }

    // check for allowance
    const lqtyAllowance = await ctx.readContract({
      ...ctx.contracts.LqtyToken,
      functionName: "allowance",
      args: [ctx.account, userProxyAddress],
    });

    // approve needed
    if (dn.gt(ctx.request.lqtyAmount, dnum18(lqtyAllowance))) {
      steps.push("approve");
    }

    // stake
    steps.push("deposit");

    return steps;
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },
};
