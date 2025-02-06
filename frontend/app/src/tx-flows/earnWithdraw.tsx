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
  "earnWithdraw",
  {
    prevEarnPosition: vPositionEarn(),
    earnPosition: vPositionEarn(),
    branchId: vBranchId(),
    claim: v.boolean(),
  },
);

export type EarnWithdrawRequest = v.InferOutput<typeof RequestSchema>;

export const earnWithdraw: FlowDeclaration<EarnWithdrawRequest> = {
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
    const boldAmount = dn.abs(dn.sub(
      request.earnPosition.deposit,
      request.prevEarnPosition.deposit,
    ));
    return (
      <>
        <TransactionDetailsRow
          label="You withdraw"
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
    withdrawFromStabilityPool: {
      name: () => "Withdraw",
      Status: TransactionStatus,

      async commit(ctx) {
        const boldAmount = dn.abs(dn.sub(
          ctx.request.earnPosition.deposit,
          ctx.request.prevEarnPosition.deposit,
        ));

        const branch = getBranch(ctx.request.branchId);
        return ctx.writeContract({
          ...branch.contracts.StabilityPool,
          functionName: "withdrawFromSP",
          args: [boldAmount[0], ctx.request.claim],
        });
      },

      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },
  },

  async getSteps() {
    return ["withdrawFromStabilityPool"];
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },
};
