import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { getProtocolContract } from "@/src/contracts";
import { dnum18 } from "@/src/dnum-utils";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { vDnum } from "@/src/valibot-utils";
import * as dn from "dnum";
import * as v from "valibot";
import { createRequestSchema, verifyTransaction } from "./shared";

const RequestSchema = createRequestSchema(
  "redeemCollateral",
  {
    amount: vDnum(),
    maxFee: vDnum(),
  },
);

export type RedeemCollateralRequest = v.InferOutput<typeof RequestSchema>;

export const redeemCollateral: FlowDeclaration<RedeemCollateralRequest> = {
  title: "Review & Send Transaction",
  Summary: () => null,

  Details({ request }) {
    return (
      <>
        <TransactionDetailsRow
          label="Reedem BOLD"
          value={[
            <Amount
              key="start"
              value={request.amount}
              suffix=" BOLD"
            />,
          ]}
        />
        <TransactionDetailsRow
          label="Max fee"
          value={[
            <Amount
              key="start"
              value={request.maxFee}
              percentage
              format="pctfull"
            />,
          ]}
        />
      </>
    );
  },

  steps: {
    approve: {
      name: () => "Approve BOLD",
      Status: TransactionStatus,

      async commit({ request, writeContract }) {
        const CollateralRegistry = getProtocolContract("CollateralRegistry");
        const BoldToken = getProtocolContract("BoldToken");

        return writeContract({
          ...BoldToken,
          functionName: "approve",
          args: [CollateralRegistry.address, request.amount[0]],
        });
      },

      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },

    redeemCollateral: {
      name: () => "Redeem BOLD",
      Status: TransactionStatus,
      async commit({ request, writeContract }) {
        const CollateralRegistry = getProtocolContract("CollateralRegistry");
        return writeContract({
          ...CollateralRegistry,
          functionName: "redeemCollateral",
          args: [
            request.amount[0],
            0n,
            request.maxFee[0],
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

    const steps = [];

    // check for allowance
    const boldAllowance = await ctx.readContract({
      ...getProtocolContract("BoldToken"),
      functionName: "allowance",
      args: [
        ctx.account,
        getProtocolContract("CollateralRegistry").address,
      ],
    });
    if (dn.gt(ctx.request.amount, dnum18(boldAllowance))) {
      steps.push("approve");
    }

    steps.push("redeemCollateral");

    return steps;
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },
};
