import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { YusndPositionSummary } from "@/src/comps/EarnPositionSummary/YusndPositionSummary";
import { YusndContract } from "@/src/yusnd";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { vPositionYusnd } from "@/src/valibot-utils";
import * as dn from "dnum";
import * as v from "valibot";
import { createRequestSchema, verifyTransaction } from "./shared";

const RequestSchema = createRequestSchema(
  "yusndRedeem",
  {
    prevYusndPosition: vPositionYusnd(),
    yusndPosition: vPositionYusnd(),
  },
);

export type YusndRedeemRequest = v.InferOutput<typeof RequestSchema>;

export const yusndRedeem: FlowDeclaration<YusndRedeemRequest> = {
  title: "Review & Send Transaction",

  Summary({ request }) {
    const { prevYusndPosition, yusndPosition } = request;
    return (
      <YusndPositionSummary
        prevYusndPosition={prevYusndPosition}
        yusndPosition={yusndPosition}
        txPreviewMode
      />
    );
  },

  Details({ request }) {
    const { yusndPosition, prevYusndPosition } = request;
    const redeemAmount = dn.sub(yusndPosition.yusnd, prevYusndPosition.yusnd);
    const usndAmount = dn.sub(yusndPosition.usnd, prevYusndPosition.usnd);
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
              value={dn.abs(usndAmount)}
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
        const { yusndPosition, prevYusndPosition } = request;
        const redeemAmount = (yusndPosition.yusnd[0] - prevYusndPosition.yusnd[0]) * -1n;
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
