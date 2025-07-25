import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { YusndPositionSummary } from "@/src/comps/EarnPositionSummary/YusndPositionSummary";
import { YusndContract } from "@/src/sbold";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { vPositionYusnd } from "@/src/valibot-utils";
import * as dn from "dnum";
import * as v from "valibot";
import { createRequestSchema, verifyTransaction } from "./shared";

const RequestSchema = createRequestSchema(
  "sboldRedeem",
  {
    prevSboldPosition: vPositionYusnd(),
    sboldPosition: vPositionYusnd(),
  },
);

export type SboldRedeemRequest = v.InferOutput<typeof RequestSchema>;

export const sboldRedeem: FlowDeclaration<SboldRedeemRequest> = {
  title: "Review & Send Transaction",

  Summary({ request }) {
    const { prevSboldPosition, sboldPosition } = request;
    return (
      <YusndPositionSummary
        prevYusndPosition={prevSboldPosition}
        yusndPosition={sboldPosition}
        txPreviewMode
      />
    );
  },

  Details({ request }) {
    const { sboldPosition, prevSboldPosition } = request;
    const redeemAmount = dn.sub(sboldPosition.yusnd, prevSboldPosition.yusnd);
    const boldAmount = dn.sub(sboldPosition.usnd, prevSboldPosition.usnd);
    return (
      <>
        <TransactionDetailsRow
          label="You redeem"
          value={[
            <Amount
              key="start"
              suffix=" yUSND"
              value={dn.abs(redeemAmount)}
            />,
          ]}
        />
        <TransactionDetailsRow
          label="You get"
          value={[
            <Amount
              key="end"
              suffix=" USND"
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
        const redeemAmount = (sboldPosition.yusnd[0] - prevSboldPosition.yusnd[0]) * -1n;
        if (redeemAmount <= 0n) {
          throw new Error("Invalid redeem amount");
        }
        return writeContract({
          ...YusndContract,
          functionName: "redeem",
          args: [redeemAmount, account, account],
        });
      },
      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
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
