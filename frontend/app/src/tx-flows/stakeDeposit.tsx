import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { StakePositionSummary } from "@/src/comps/StakePositionSummary/StakePositionSummary";
import { dnum18 } from "@/src/dnum-utils";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { usePrice } from "@/src/services/Prices";
import { vDnum, vPositionStake } from "@/src/valibot-utils";
import * as dn from "dnum";
import * as v from "valibot";
import { readContract } from "wagmi/actions";

const FlowIdSchema = v.literal("stakeDeposit");

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

type Step = "stakeDeposit" | "approveLqty";

const stepNames: Record<Step, string> = {
  approveLqty: "Approve LQTY",
  stakeDeposit: "Stake",
};

export const stakeDeposit: FlowDeclaration<Request, Step> = {
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
          label="You deposit"
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

  async getSteps({ account, contracts, request, wagmiConfig }) {
    if (!account.address) {
      throw new Error("Account address is required");
    }

    const lqtyAllowance = await readContract(wagmiConfig, {
      ...contracts.LqtyToken,
      functionName: "allowance",
      args: [account.address, contracts.LqtyStaking.address],
    });

    const isLqtyApproved = dn.lte(request.lqtyAmount, dnum18(lqtyAllowance));

    return [
      isLqtyApproved ? null : "approveLqty" as const,
      "stakeDeposit" as const,
    ].filter((step): step is Step => step !== null);
  },

  getStepName(stepId) {
    return stepNames[stepId];
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },

  async writeContractParams(stepId, { contracts, request }) {
    if (stepId === "approveLqty") {
      return {
        ...contracts.LqtyToken,
        functionName: "approve",
        args: [contracts.LqtyStaking.address, request.lqtyAmount[0]],
      };
    }
    if (stepId === "stakeDeposit") {
      return {
        ...contracts.LqtyStaking,
        functionName: "stake",
        args: [request.lqtyAmount[0]],
      };
    }
    throw new Error(`Invalid stepId: ${stepId}`);
  },
};
