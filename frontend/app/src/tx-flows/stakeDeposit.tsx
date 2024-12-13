import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { StakePositionSummary } from "@/src/comps/StakePositionSummary/StakePositionSummary";
import { dnum18 } from "@/src/dnum-utils";
import { signPermit } from "@/src/permit";
import { PermissionStatus } from "@/src/screens/TransactionsScreen/PermissionStatus";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { usePrice } from "@/src/services/Prices";
import { vDnum, vPositionStake } from "@/src/valibot-utils";
import * as dn from "dnum";
import * as v from "valibot";
import { readContract, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { createRequestSchema } from "./shared";

const RequestSchema = createRequestSchema(
  "stakeDeposit",
  {
    lqtyAmount: vDnum(),
    stakePosition: vPositionStake(),
    prevStakePosition: v.union([v.null(), vPositionStake()]),
  },
);

export type StakeDepositRequest = v.InferOutput<typeof RequestSchema>;

const USE_PERMIT = false;

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
    const { rewards } = request.stakePosition;

    const lqtyPrice = usePrice("LQTY");
    const lusdPrice = usePrice("LUSD");
    const ethPrice = usePrice("ETH");

    const rewardsLusdInUsd = lusdPrice.data && dn.mul(rewards.lusd, lusdPrice.data);
    const rewardsEthInUsd = ethPrice.data && dn.mul(rewards.eth, ethPrice.data);

    return (
      <>
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
        <TransactionDetailsRow
          label="Claiming LUSD rewards"
          value={[
            <Amount
              key="start"
              value={rewards.lusd}
              suffix=" LUSD"
            />,
            <Amount
              key="end"
              value={rewardsLusdInUsd}
              prefix="$"
            />,
          ]}
        />
        <TransactionDetailsRow
          label="Claiming ETH rewards"
          value={[
            <Amount
              key="start"
              value={rewards.eth}
              suffix=" ETH"
            />,
            <Amount
              key="end"
              value={rewardsEthInUsd}
              prefix="$"
            />,
          ]}
        />
      </>
    );
  },

  steps: {
    // approve via permit
    permitLqty: {
      name: () => "Approve LQTY",
      Status: PermissionStatus,

      async commit({ account, contracts, request, wagmiConfig }) {
        if (!account) {
          throw new Error("Account address is required");
        }

        const { deadline, ...permit } = await signPermit({
          token: contracts.LqtyToken.address,
          spender: contracts.Governance.address,
          value: request.lqtyAmount[0],
          account,
          wagmiConfig,
        });

        return JSON.stringify({
          ...permit,
          deadline: Number(deadline),
        });
      },

      async verify() {
        // nothing to do
      },
    },

    // approve tx
    approveLqty: {
      name: () => "Approve LQTY",
      Status: TransactionStatus,

      async commit({ account, contracts, request, wagmiConfig }) {
        if (!account) {
          throw new Error("Account address is required");
        }

        const { LqtyToken, Governance } = contracts;

        return writeContract(wagmiConfig, {
          ...LqtyToken,
          functionName: "approve",
          args: [Governance.address, request.lqtyAmount[0]],
        });
      },

      async verify({ wagmiConfig }, hash) {
        await waitForTransactionReceipt(wagmiConfig, {
          hash: hash as `0x${string}`,
        });
      },
    },

    stakeDeposit: {
      name: () => "Stake",
      Status: TransactionStatus,

      async commit({ account, contracts, request, wagmiConfig, steps }) {
        if (!account) {
          throw new Error("Account address is required");
        }

        const permitStep = steps?.find((step) => step.id === "permitLqty");
        const depositLqtyViaPermit = Boolean(permitStep?.artifact);

        // deposit LQTY
        if (!depositLqtyViaPermit) {
          return writeContract(wagmiConfig, {
            ...contracts.Governance,
            functionName: "depositLQTY",
            args: [request.lqtyAmount[0]],
          });
        }

        // deposit LQTY via permit
        const permit = JSON.parse(permitStep?.artifact ?? "");
        return writeContract(wagmiConfig, {
          ...contracts.Governance,
          functionName: "depositLQTYViaPermit",
          args: [
            request.lqtyAmount[0],
            {
              owner: account,
              spender: contracts.Governance.address,
              value: request.lqtyAmount[0],
              deadline: permit.deadline,
              v: permit.v,
              r: permit.r,
              s: permit.s,
            },
          ],
        });
      },

      async verify({ wagmiConfig }, hash) {
        await waitForTransactionReceipt(wagmiConfig, { hash: hash as `0x${string}` });
      },
    },
  },

  async getSteps({ account, contracts, request, wagmiConfig }) {
    if (!account) {
      throw new Error("Account address is required");
    }

    const steps: string[] = [];

    // approve
    if (USE_PERMIT) {
      steps.push("permitLqty");
    } else {
      const lqtyAllowance = await readContract(wagmiConfig, {
        ...contracts.LqtyToken,
        functionName: "allowance",
        args: [account, contracts.LqtyStaking.address],
      });
      if (dn.gt(request.lqtyAmount, dnum18(lqtyAllowance))) {
        steps.push("approveLqty");
      }
    }

    // stake
    steps.push("stakeDeposit");

    return steps;
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },
};
