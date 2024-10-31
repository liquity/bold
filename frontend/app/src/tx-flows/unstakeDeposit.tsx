import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { StakePositionSummary } from "@/src/comps/StakePositionSummary/StakePositionSummary";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { usePrice } from "@/src/services/Prices";
import { vDnum, vPositionStake } from "@/src/valibot-utils";
import * as dn from "dnum";
import * as v from "valibot";

const FlowIdSchema = v.literal("unstakeDeposit");

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

  lqtyAmount: vDnum(),
  stakePosition: vPositionStake(),
  prevStakePosition: v.union([v.null(), vPositionStake()]),
});

export type Request = v.InferOutput<typeof RequestSchema>;

type Step = "unstakeDeposit";

const stepNames: Record<Step, string> = {
  unstakeDeposit: "Unstake",
};

export const unstakeDeposit: FlowDeclaration<Request, Step> = {
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

    const lqtyPrice = usePrice("LQTY");
    const lusdPrice = usePrice("LUSD");
    const ethPrice = usePrice("ETH");

    const rewardsLusdInUsd = lusdPrice && dn.mul(rewards.lusd, lusdPrice);
    const rewardsEthInUsd = ethPrice && dn.mul(rewards.eth, ethPrice);

    return (
      <>
        <TransactionDetailsRow
          label="You withdraw"
          value={[
            <Amount
              key="start"
              suffix=" LQTY"
              value={request.lqtyAmount}
            />,
            <Amount
              key="end"
              prefix="$"
              value={lqtyPrice && dn.mul(request.lqtyAmount, lqtyPrice)}
            />,
          ]}
        />
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
            />,
          ]}
        />
      </>
    );
  },

  async getSteps() {
    return ["unstakeDeposit"];
  },

  getStepName(stepId) {
    return stepNames[stepId];
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },

  async writeContractParams(stepId, { contracts, request }) {
    if (stepId === "unstakeDeposit") {
      return {
        ...contracts.LqtyStaking,
        functionName: "unstake",
        args: [request.lqtyAmount[0]],
      };
    }
    throw new Error(`Invalid stepId: ${stepId}`);
  },
};
