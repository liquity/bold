import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { SboldPositionSummary } from "@/src/comps/EarnPositionSummary/SboldPositionSummary";
import { SboldContract } from "@/src/sbold";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { vPositionSbold } from "@/src/valibot-utils";
import * as dn from "dnum";
import * as v from "valibot";
import { createRequestSchema, verifyTransaction } from "./shared";

const RequestSchema = createRequestSchema(
  "sboldRedeem",
  {
    prevSboldPosition: vPositionSbold(),
    sboldPosition: vPositionSbold(),
  },
);

export type SboldRedeemRequest = v.InferOutput<typeof RequestSchema>;

export const sboldRedeem: FlowDeclaration<SboldRedeemRequest> = {
  title: "Review & Send Transaction",

  Summary({ request }) {
    const { prevSboldPosition, sboldPosition } = request;
    return (
      <SboldPositionSummary
        prevSboldPosition={prevSboldPosition}
        sboldPosition={sboldPosition}
        txPreviewMode
      />
    );
  },

  Details({ request }) {
    const { sboldPosition, prevSboldPosition } = request;
    const redeemAmount = dn.sub(sboldPosition.sbold, prevSboldPosition.sbold);
    const boldAmount = dn.sub(sboldPosition.bold, prevSboldPosition.bold);
    return (
      <>
        <TransactionDetailsRow
          label="You redeem"
          value={[
            <Amount
              key="start"
              suffix=" sBOLD"
              value={dn.abs(redeemAmount)}
            />,
          ]}
        />
        <TransactionDetailsRow
          label="You get"
          value={[
            <Amount
              key="end"
              suffix=" BOLD"
              value={dn.abs(boldAmount)}
            />,
          ]}
        />
      </>
    );
  },

  steps: {
    redeem: {
      name: () => "Redeem",
      Status: TransactionStatus,
      async commit({ account, request, writeContract }) {
        const { sboldPosition, prevSboldPosition } = request;
        const redeemAmount = (sboldPosition.sbold[0] - prevSboldPosition.sbold[0]) * -1n;
        if (redeemAmount <= 0n) {
          throw new Error("Invalid redeem amount");
        }
        return writeContract({
          ...SboldContract,
          functionName: "redeem",
          args: [redeemAmount, account, account],
        });
      },
      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe, false);
      },
    },
  },

  async getSteps() {
    return ["redeem"];
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },
};
