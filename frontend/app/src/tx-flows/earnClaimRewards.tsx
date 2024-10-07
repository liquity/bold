import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { EarnPositionSummary } from "@/src/comps/EarnPositionSummary/EarnPositionSummary";
import { useCollateral } from "@/src/liquity-utils";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { usePrice } from "@/src/services/Prices";
import { vAddress, vCollIndex } from "@/src/valibot-utils";
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

  collIndex: vCollIndex(),
  depositor: vAddress(),
});

export type Request = v.InferOutput<typeof RequestSchema>;

type Step = "claimRewards";

export const earnClaimRewards: FlowDeclaration<Request, Step> = {
  title: "Review & Send Transaction",

  Summary({ flow }) {
    const collateral = useCollateral(flow.request.collIndex);
    const symbol = collateral?.symbol;
    return symbol && (
      <EarnPositionSummary
        address={flow.request.depositor}
        collSymbol={symbol}
      />
    );
  },

  Details({ flow }) {
    const collateral = useCollateral(flow.request.collIndex);

    const rewardsBold = dn.from(0, 18);
    const rewardsColl = dn.from(0, 18);

    const boldPrice = usePrice("BOLD");
    const collPrice = usePrice(collateral?.symbol ?? null);

    const rewardsBoldUsd = boldPrice && dn.mul(rewardsBold, boldPrice);
    const rewardsCollUsd = collPrice && dn.mul(rewardsColl, collPrice);

    return (
      <>
        <TransactionDetailsRow
          label="Claiming BOLD rewards"
          value={[
            <Amount value={rewardsBold} suffix=" BOLD" />,
            <Amount value={rewardsBoldUsd} prefix="$" />,
          ]}
        />
        <TransactionDetailsRow
          label={`Claiming ${collateral?.name} rewards`}
          value={[
            <Amount value={rewardsColl} suffix={` ${collateral?.symbol}`} />,
            <Amount value={rewardsCollUsd} prefix="$" />,
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
    const collateral = contracts.collaterals[request.collIndex];
    return {
      ...collateral.contracts.StabilityPool,
      functionName: "withdrawFromSP",
      args: [0n, true],
    };
  },
};
