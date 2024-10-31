import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { StakePositionSummary } from "@/src/comps/StakePositionSummary/StakePositionSummary";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { usePrice } from "@/src/services/Prices";
import { vPositionStake } from "@/src/valibot-utils";
import * as dn from "dnum";
import * as v from "valibot";

const FlowIdSchema = v.literal("stakeClaimRewards");

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

  stakePosition: vPositionStake(),
  prevStakePosition: v.union([v.null(), vPositionStake()]),
});

export type Request = v.InferOutput<typeof RequestSchema>;

type Step = "stakeClaimRewards";

const stepNames: Record<Step, string> = {
  stakeClaimRewards: "Claim rewards",
};

export const stakeClaimRewards: FlowDeclaration<Request, Step> = {
  title: "Review & Send Transaction",

  Summary({ flow }) {
    return (
      <StakePositionSummary
        prevStakePosition={flow.request.prevStakePosition}
        stakePosition={flow.request.stakePosition}
        txPreviewMode
      />
    );
  },

  Details({ flow }) {
    const { request } = flow;
    const { rewards } = request.stakePosition;

    const lusdPrice = usePrice("LUSD");
    const ethPrice = usePrice("ETH");

    const rewardsLusdInUsd = lusdPrice && dn.mul(rewards.lusd, lusdPrice);
    const rewardsEthInUsd = ethPrice && dn.mul(rewards.eth, ethPrice);

    return (
      <>
        <TransactionDetailsRow
          label="Claiming LUSD rewards"
          value={[
            <Amount
              key="start"
              value={rewards.lusd}
              suffix=" LUSD"
            />,
            <Amount
              key="end"
              value={rewardsLusdInUsd}
              prefix="$"
              fallback="−"
            />,
          ]}
        />
        <TransactionDetailsRow
          label="Claiming ETH rewards"
          value={[
            <Amount
              key="start"
              value={rewards.eth}
              suffix=" ETH"
            />,
            <Amount
              key="end"
              value={rewardsEthInUsd}
              prefix="$"
              fallback="−"
            />,
          ]}
        />
      </>
    );
  },

  async getSteps() {
    return ["stakeClaimRewards"];
  },

  getStepName(stepId) {
    return stepNames[stepId];
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },

  async writeContractParams(stepId, { contracts }) {
    if (stepId === "stakeClaimRewards") {
      return {
        ...contracts.LqtyStaking,
        functionName: "unstake",
        args: [0n],
      };
    }
    throw new Error(`Invalid stepId: ${stepId}`);
  },
};
