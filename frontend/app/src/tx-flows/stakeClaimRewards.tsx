import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { StakePositionSummary } from "@/src/comps/StakePositionSummary/StakePositionSummary";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { usePrice } from "@/src/services/Prices";
import { vPositionStake } from "@/src/valibot-utils";
import * as dn from "dnum";
import * as v from "valibot";
import { createRequestSchema, verifyTransaction } from "./shared";

const RequestSchema = createRequestSchema(
  "stakeClaimRewards",
  {
    stakePosition: vPositionStake(),
    prevStakePosition: v.union([v.null(), vPositionStake()]),
  },
);

export type StakeClaimRewardsRequest = v.InferOutput<typeof RequestSchema>;

export const stakeClaimRewards: FlowDeclaration<StakeClaimRewardsRequest> = {
  title: "Review & Send Transaction",

  Summary({ request }) {
    return (
      <StakePositionSummary
        prevStakePosition={request.prevStakePosition}
        stakePosition={request.stakePosition}
        txPreviewMode
      />
    );
  },

  Details({ request }) {
    const { rewards } = request.stakePosition;
    const lusdPrice = usePrice("LUSD");
    const ethPrice = usePrice("ETH");

    const rewardsLusdInUsd = lusdPrice.data && dn.mul(rewards.lusd, lusdPrice.data);
    const rewardsEthInUsd = ethPrice.data && dn.mul(rewards.eth, ethPrice.data);

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

  steps: {
    stakeClaimRewards: {
      name: () => "Claim rewards",
      Status: TransactionStatus,

      async commit(ctx) {
        return ctx.writeContract({
          ...ctx.contracts.Governance,
          functionName: "claimFromStakingV1",
          args: [ctx.request.stakePosition.owner], // address to receive the payout
        });
      },

      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },
  },

  async getSteps() {
    return ["stakeClaimRewards"];
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },
};
