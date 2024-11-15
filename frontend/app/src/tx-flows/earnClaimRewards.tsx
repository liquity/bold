import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { EarnPositionSummary } from "@/src/comps/EarnPositionSummary/EarnPositionSummary";
import { getCollToken } from "@/src/liquity-utils";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { usePrice } from "@/src/services/Prices";
import { vPositionEarn } from "@/src/valibot-utils";
import * as dn from "dnum";
import * as v from "valibot";

const FlowIdSchema = v.literal("earnClaimRewards");

const RequestSchema = v.object({
  flowId: FlowIdSchema,
  backLink: v.union([
    v.null(),
    v.tuple([
      v.string(), // path
      v.string(), // label
    ]),
  ]),
  successLink: v.tuple([
    v.string(), // path
    v.string(), // label
  ]),
  successMessage: v.string(),
  earnPosition: vPositionEarn(),
});

export type Request = v.InferOutput<typeof RequestSchema>;

type Step = "claimRewards";

export const earnClaimRewards: FlowDeclaration<Request, Step> = {
  title: "Review & Send Transaction",

  Summary({ flow }) {
    const { request } = flow;
    return (
      <EarnPositionSummary
        collIndex={request.earnPosition.collIndex}
        earnPosition={request.earnPosition}
        txPreviewMode
      />
    );
  },

  Details({ flow }) {
    const { request } = flow;
    const collateral = getCollToken(request.earnPosition.collIndex);

    if (!collateral) {
      return null;
    }

    const boldPrice = usePrice("BOLD");
    const collPrice = usePrice(collateral.symbol);

    const rewardsBold = request.earnPosition.rewards.bold;
    const rewardsColl = request.earnPosition.rewards.coll;
    const rewardsBoldUsd = boldPrice && dn.mul(rewardsBold, boldPrice);
    const rewardsCollUsd = collPrice && dn.mul(rewardsColl, collPrice);

    return (
      <>
        <TransactionDetailsRow
          label="Claiming BOLD rewards"
          value={[
            <Amount
              key="start"
              value={rewardsBold}
              suffix=" BOLD"
            />,
            <Amount
              key="end"
              value={rewardsBoldUsd}
              prefix="$"
            />,
          ]}
        />
        <TransactionDetailsRow
          label={`Claiming ${collateral.name} rewards`}
          value={[
            <Amount
              key="start"
              value={rewardsColl}
              suffix={` ${collateral.symbol}`}
            />,
            <Amount
              key="end"
              value={rewardsCollUsd}
              prefix="$"
            />,
          ]}
        />
      </>
    );
  },

  async getSteps() {
    return ["claimRewards"];
  },

  getStepName() {
    return "Claim rewards"; // single step
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },

  async writeContractParams(_stepId, { contracts, request }) {
    const collateral = contracts.collaterals[request.earnPosition.collIndex];
    return {
      ...collateral.contracts.StabilityPool,
      functionName: "withdrawFromSP",
      args: [0n, true],
    };
  },
};
