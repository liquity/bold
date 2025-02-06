import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { EarnPositionSummary } from "@/src/comps/EarnPositionSummary/EarnPositionSummary";
import { getBranch } from "@/src/liquity-utils";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { usePrice } from "@/src/services/Prices";
import { vBranchId, vPositionEarn } from "@/src/valibot-utils";
import * as dn from "dnum";
import * as v from "valibot";
import { createRequestSchema, verifyTransaction } from "./shared";

const RequestSchema = createRequestSchema(
  "earnDeposit",
  {
    prevEarnPosition: v.union([
      v.null(),
      vPositionEarn(),
    ]),
    earnPosition: vPositionEarn(),
    branchId: vBranchId(),
    claim: v.boolean(),
  },
);

export type EarnDepositRequest = v.InferOutput<typeof RequestSchema>;

export const earnDeposit: FlowDeclaration<EarnDepositRequest> = {
  title: "Review & Send Transaction",

  Summary({ request }) {
    return (
      <EarnPositionSummary
        branchId={request.branchId}
        earnPosition={request.earnPosition}
        prevEarnPosition={request.prevEarnPosition}
        txPreviewMode
      />
    );
  },

  Details({ request }) {
    const boldPrice = usePrice("BOLD");
    const boldAmount = dn.sub(
      request.earnPosition.deposit,
      request.prevEarnPosition?.deposit ?? dn.from(0, 18),
    );
    return (
      <>
        <TransactionDetailsRow
          label="You deposit"
          value={[
            <Amount
              key="start"
              suffix=" BOLD"
              value={boldAmount}
            />,
            <Amount
              key="end"
              prefix="$"
              value={boldPrice.data && dn.mul(boldAmount, boldPrice.data)}
            />,
          ]}
        />
      </>
    );
  },

  steps: {
    provideToStabilityPool: {
      name: () => "Add deposit",
      Status: TransactionStatus,

      async commit(ctx) {
        const branch = getBranch(ctx.request.branchId);
        const boldAmount = dn.sub(
          ctx.request.earnPosition.deposit,
          ctx.request.prevEarnPosition?.deposit ?? dn.from(0, 18),
        );
        return ctx.writeContract({
          ...branch.contracts.StabilityPool,
          functionName: "provideToSP",
          args: [
            boldAmount[0],
            ctx.request.claim,
          ],
        });
      },

      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },
  },

  async getSteps() {
    return ["provideToStabilityPool"];
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },
};
