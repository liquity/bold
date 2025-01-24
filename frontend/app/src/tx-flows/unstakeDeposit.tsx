import type { FlowDeclaration } from "@/src/services/TransactionFlow";
import type { Address } from "@/src/types";

import { Amount } from "@/src/comps/Amount/Amount";
import { StakePositionSummary } from "@/src/comps/StakePositionSummary/StakePositionSummary";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { usePrice } from "@/src/services/Prices";
import { GovernanceUserAllocated, graphQuery } from "@/src/subgraph-queries";
import { vDnum, vPositionStake } from "@/src/valibot-utils";
import * as dn from "dnum";
import * as v from "valibot";
import { createRequestSchema, verifyTransaction } from "./shared";

const RequestSchema = createRequestSchema(
  "unstakeDeposit",
  {
    lqtyAmount: vDnum(),
    stakePosition: vPositionStake(),
    prevStakePosition: v.union([v.null(), vPositionStake()]),
  },
);

export type UnstakeDepositRequest = v.InferOutput<typeof RequestSchema>;

export const unstakeDeposit: FlowDeclaration<UnstakeDepositRequest> = {
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
        label="You withdraw"
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
    // reset allocations
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

    unstakeDeposit: {
      name: () => "Unstake",
      Status: TransactionStatus,

      async commit(ctx) {
        const { Governance } = ctx.contracts;
        return ctx.writeContract({
          ...Governance,
          functionName: "withdrawLQTY",
          args: [ctx.request.lqtyAmount[0]],
        });
      },

      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },
  },

  async getSteps({ account }) {
    if (!account) {
      throw new Error("Account address is required");
    }

    const steps: string[] = [];

    // check if the user has any allocations
    const allocated = await graphQuery(
      GovernanceUserAllocated,
      { id: account.toLowerCase() },
    );
    if (
      allocated.governanceUser
      && allocated.governanceUser.allocated.length > 0
    ) {
      steps.push("resetAllocations");
    }

    steps.push("unstakeDeposit");

    return steps;
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },
};
