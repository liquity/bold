import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { EarnPositionSummary } from "@/src/comps/EarnPositionSummary/EarnPositionSummary";
import { getCollToken } from "@/src/liquity-utils";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { usePrice } from "@/src/services/Prices";
import { vPositionEarn } from "@/src/valibot-utils";
import * as dn from "dnum";
import * as v from "valibot";
import { createRequestSchema, verifyTransaction } from "./shared";

const RequestSchema = createRequestSchema("earnClaimRewards", {
  earnPosition: vPositionEarn(),
});

export type EarnClaimRewardsRequest = v.InferOutput<typeof RequestSchema>;

export const earnClaimRewards: FlowDeclaration<EarnClaimRewardsRequest> = {
  title: "Review & Send Transaction",

  Summary({ request }) {
    return (
      <EarnPositionSummary
        collIndex={request.earnPosition.collIndex}
        earnPosition={request.earnPosition}
        txPreviewMode
      />
    );
  },

  Details({ request }) {
    const collateral = getCollToken(request.earnPosition.collIndex);

    if (!collateral) {
      return null;
    }

    const boldPrice = usePrice("USND");
    const collPrice = usePrice(collateral.symbol);

    const rewardsBold = request.earnPosition.rewards.usnd;
    const rewardsColl = request.earnPosition.rewards.coll;
    const rewardsBoldUsd =
      boldPrice.data && dn.mul(rewardsBold, boldPrice.data);
    const rewardsCollUsd =
      collPrice.data && dn.mul(rewardsColl, collPrice.data);

    return (
      <>
        <TransactionDetailsRow
          label='Claiming USND rewards'
          value={[
            <Amount key='start' value={rewardsBold} suffix=' USND' />,
            <Amount key='end' value={rewardsBoldUsd} prefix='$' />,
          ]}
        />
        <TransactionDetailsRow
          label={`Claiming ${collateral.name} rewards`}
          value={[
            <Amount
              key='start'
              value={rewardsColl}
              suffix={` ${collateral.symbol}`}
            />,
            <Amount key='end' value={rewardsCollUsd} prefix='$' />,
          ]}
        />
      </>
    );
  },

  steps: {
    claimRewards: {
      name: () => "Claim rewards",
      Status: TransactionStatus,

      async commit(ctx) {
        const { collIndex } = ctx.request.earnPosition;
        const collateral = ctx.contracts.collaterals[collIndex];
        if (!collateral) {
          throw new Error("Invalid collateral index: " + collIndex);
        }

        const { StabilityPool } = collateral.contracts;
        return ctx.writeContract({
          ...StabilityPool,
          functionName: "withdrawFromSP",
          args: [0n, true],
        });
      },

      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },
  },

  async getSteps() {
    return ["claimRewards"];
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },
};
