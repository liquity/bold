import type { FlowDeclaration } from "@/src/services/TransactionFlow";
import type { Address } from "@/src/types";

import { Amount } from "@/src/comps/Amount/Amount";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { usePrice } from "@/src/services/Prices";
import { GovernanceUserAllocated, graphQuery } from "@/src/subgraph-queries";
import { vDnum } from "@/src/valibot-utils";
import * as dn from "dnum";
import * as v from "valibot";
import { createRequestSchema, verifyTransaction } from "./shared";

const RequestSchema = createRequestSchema(
  "legacyUnstakeAll",
  {
    lqtyAmount: vDnum(),
  },
);

export type LegacyUnstakeAllRequest = v.InferOutput<typeof RequestSchema>;

export const legacyUnstakeAll: FlowDeclaration<LegacyUnstakeAllRequest> = {
  title: "Withdraw from Legacy Stake",
  Summary: null,

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
    const steps: string[] = [];

    // check if the user has any allocations
    const allocated = await graphQuery(GovernanceUserAllocated, {
      id: account.toLowerCase(),
    });

    if ((allocated.governanceUser?.allocated.length ?? 0) > 0) {
      steps.push("resetAllocations");
    }

    steps.push("unstakeDeposit");

    return steps;
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },
};
