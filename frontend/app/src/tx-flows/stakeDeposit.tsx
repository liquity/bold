import type { FlowDeclaration } from "@/src/services/TransactionFlow";
import type { Address } from "@/src/types";

import { Amount } from "@/src/comps/Amount/Amount";
import { StakePositionSummary } from "@/src/comps/StakePositionSummary/StakePositionSummary";
import { dnum18 } from "@/src/dnum-utils";
import { signPermit } from "@/src/permit";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { useAccount } from "@/src/services/Ethereum";
import { usePrice } from "@/src/services/Prices";
import { GovernanceUserAllocated, graphQuery } from "@/src/subgraph-queries";
import { vDnum, vPositionStake } from "@/src/valibot-utils";
import * as dn from "dnum";
import * as v from "valibot";
import { maxUint256 } from "viem";
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
        if (!ctx.account) {
          throw new Error("Account address is required");
        }
        return ctx.writeContract({
          ...ctx.contracts.Governance,
          functionName: "deployUserProxy",
        });
      },
      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },

    resetAllocations: {
      name: () => "Reset Votes",
      Status: TransactionStatus,
      async commit(ctx) {
        if (!ctx.account) {
          throw new Error("Account address is required");
        }
        const allocated = await graphQuery(
          GovernanceUserAllocated,
          { id: ctx.account.toLowerCase() },
        );
        return ctx.writeContract({
          ...ctx.contracts.Governance,
          functionName: "resetAllocations",
          args: [(allocated.governanceUser?.allocated ?? []) as Address[], true],
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
        if (!ctx.account) {
          throw new Error("Account address is required");
        }

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

    stakeDeposit: {
      name: () => "Stake",
      Status: TransactionStatus,

      async commit(ctx) {
        if (!ctx.account) {
          throw new Error("Account address is required");
        }

        const approveStep = ctx.steps?.find((step) => step.id === "approve");
        const isPermit = approveStep?.artifact?.startsWith("permit:") === true;

        // deposit approved LQTY
        if (!isPermit) {
          return ctx.writeContract({
            ...ctx.contracts.Governance,
            functionName: "depositLQTY",
            args: [ctx.request.lqtyAmount[0]],
          });
        }

        // deposit LQTY via permit
        const { userProxyAddress, ...permit } = JSON.parse(
          approveStep?.artifact?.replace(/^permit:/, "") ?? "{}",
        );

        return ctx.writeContract({
          ...ctx.contracts.Governance,
          functionName: "depositLQTYViaPermit",
          args: [
            ctx.request.lqtyAmount[0],
            {
              owner: ctx.account,
              spender: userProxyAddress,
              value: ctx.request.lqtyAmount[0],
              deadline: permit.deadline,
              v: permit.v,
              r: permit.r,
              s: permit.s,
            },
          ],
        });
      },

      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },
  },

  async getSteps(ctx) {
    if (!ctx.account) {
      throw new Error("Account address is required");
    }

    const steps: string[] = [];

    // check if the user has any allocations
    const allocated = await graphQuery(
      GovernanceUserAllocated,
      { id: ctx.account.toLowerCase() },
    );
    if (
      allocated.governanceUser
      && allocated.governanceUser.allocated.length > 0
    ) {
      steps.push("resetAllocations");
    }

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

    // approve
    if (dn.gt(ctx.request.lqtyAmount, dnum18(lqtyAllowance))) {
      steps.push("approve");
    }

    // stake
    steps.push("stakeDeposit");

    return steps;
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },
};
