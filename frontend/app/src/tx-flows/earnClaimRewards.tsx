import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { EarnPositionSummary } from "@/src/comps/EarnPositionSummary/EarnPositionSummary";
import { DNUM_0 } from "@/src/dnum-utils";
import { getBranch, getCollToken, useEarnPool } from "@/src/liquity-utils";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { usePrice } from "@/src/services/Prices";
import { vPositionEarn } from "@/src/valibot-utils";
import * as dn from "dnum";
import * as v from "valibot";
import { createRequestSchema, verifyTransaction } from "./shared";

const RequestSchema = createRequestSchema(
  "earnClaimRewards",
  {
    earnPosition: vPositionEarn(),
    compound: v.optional(v.boolean(), false),
  },
);

export type EarnClaimRewardsRequest = v.InferOutput<typeof RequestSchema>;

export const earnClaimRewards: FlowDeclaration<EarnClaimRewardsRequest> = {
  title: "Review & Send Transaction",

  Summary({ request }) {
    const { compound = false } = request;
    const earnPool = useEarnPool(request.earnPosition.branchId);

    // when compounding, show the updated position with the BOLD rewards
    const updatedEarnPosition = compound
      ? {
        ...request.earnPosition,
        deposit: dn.add(
          request.earnPosition.deposit,
          request.earnPosition.rewards.bold,
        ),
        rewards: { bold: DNUM_0, coll: DNUM_0 },
      }
      : request.earnPosition;

    const poolDeposit = earnPool.data?.totalDeposited;

    const newPoolDeposit = compound && poolDeposit
      ? dn.add(poolDeposit, request.earnPosition.rewards.bold)
      : poolDeposit;

    const poolDepositProps = !poolDeposit || !newPoolDeposit ? {} : {
      poolDeposit: newPoolDeposit,
      prevPoolDeposit: poolDeposit,
    };

    return (
      <EarnPositionSummary
        branchId={request.earnPosition.branchId}
        earnPosition={updatedEarnPosition}
        prevEarnPosition={compound ? request.earnPosition : undefined}
        txPreviewMode
        {...poolDepositProps}
      />
    );
  },

  Details({ request }) {
    const collateral = getCollToken(request.earnPosition.branchId);
    const { compound = false } = request;

    const boldPrice = usePrice("BOLD");
    const collPrice = usePrice(collateral.symbol);

    const rewardsBold = request.earnPosition.rewards.bold;
    const rewardsColl = request.earnPosition.rewards.coll;
    const rewardsBoldUsd = boldPrice.data && dn.mul(rewardsBold, boldPrice.data);
    const rewardsCollUsd = collPrice.data && dn.mul(rewardsColl, collPrice.data);

    return (
      <>
        <TransactionDetailsRow
          label={compound ? "Compound BOLD rewards" : "Claim BOLD rewards"}
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
          label={`Claim ${collateral.name} rewards`}
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

  steps: {
    claimRewards: {
      name: (ctx) => ctx.request.compound ? "Compound rewards" : "Claim rewards",
      Status: TransactionStatus,

      async commit(ctx) {
        const { branchId } = ctx.request.earnPosition;
        const { compound = false } = ctx.request;
        const branch = getBranch(branchId);
        return ctx.writeContract({
          ...branch.contracts.StabilityPool,
          functionName: "withdrawFromSP",
          args: [0n, !compound],
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
