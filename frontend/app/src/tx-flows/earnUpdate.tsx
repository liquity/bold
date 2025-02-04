import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { EarnPositionSummary } from "@/src/comps/EarnPositionSummary/EarnPositionSummary";
import { DNUM_0 } from "@/src/dnum-utils";
import { getCollToken } from "@/src/liquity-utils";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { usePrice } from "@/src/services/Prices";
import { vCollIndex, vPositionEarn } from "@/src/valibot-utils";
import * as dn from "dnum";
import * as v from "valibot";
import { createRequestSchema, verifyTransaction } from "./shared";

const RequestSchema = createRequestSchema(
  "earnUpdate",
  {
    prevEarnPosition: vPositionEarn(),
    earnPosition: vPositionEarn(),
    collIndex: vCollIndex(),
    claimRewards: v.boolean(),
  },
);

export type EarnUpdateRequest = v.InferOutput<typeof RequestSchema>;

export const earnUpdate: FlowDeclaration<EarnUpdateRequest> = {
  title: "Review & Send Transaction",

  Summary({ request }) {
    return (
      <EarnPositionSummary
        collIndex={request.collIndex}
        earnPosition={{
          ...request.earnPosition,

          // compound BOLD rewards if not claiming
          deposit: dn.add(
            request.earnPosition.deposit,
            request.claimRewards
              ? DNUM_0
              : request.earnPosition.rewards.bold,
          ),
          rewards: {
            // BOLD rewards are claimed or compounded
            bold: DNUM_0,
            coll: request.claimRewards
              ? DNUM_0
              : request.earnPosition.rewards.coll,
          },
        }}
        prevEarnPosition={dn.eq(request.prevEarnPosition.deposit, 0)
          ? null
          : request.prevEarnPosition}
        txPreviewMode
      />
    );
  },

  Details({ request }) {
    const { earnPosition, prevEarnPosition, claimRewards } = request;
    const { rewards } = earnPosition;

    const collateral = getCollToken(earnPosition.collIndex);

    const boldPrice = usePrice("BOLD");
    const collPrice = usePrice(collateral.symbol);

    const depositChange = dn.sub(earnPosition.deposit, prevEarnPosition.deposit);

    const boldAmount = dn.abs(depositChange);
    const usdAmount = boldPrice.data && dn.mul(boldAmount, boldPrice.data);

    return (
      <>
        <TransactionDetailsRow
          label={dn.gt(depositChange, 0) ? "You deposit" : "You withdraw"}
          value={[
            <Amount
              key="start"
              suffix=" BOLD"
              value={dn.abs(depositChange)}
            />,
            <Amount
              key="end"
              prefix="$"
              value={usdAmount}
            />,
          ]}
        />
        {dn.gt(rewards.bold, 0) && (
          <TransactionDetailsRow
            label={claimRewards ? "Claim BOLD rewards" : "Compound BOLD rewards"}
            value={[
              <Amount
                key="start"
                value={rewards.bold}
                suffix=" BOLD"
              />,
              <Amount
                key="end"
                value={boldPrice.data && dn.mul(rewards.bold, boldPrice.data)}
                prefix="$"
              />,
            ]}
          />
        )}
        {claimRewards && dn.gt(rewards.coll, 0) && (
          <TransactionDetailsRow
            label={`Claim ${collateral.name} rewards`}
            value={[
              <Amount
                key="start"
                value={rewards.coll}
                suffix={` ${collateral.symbol}`}
              />,
              <Amount
                key="end"
                value={collPrice.data && dn.mul(rewards.coll, collPrice.data)}
                prefix="$"
              />,
            ]}
          />
        )}
      </>
    );
  },

  steps: {
    provideToStabilityPool: {
      name: () => "Deposit",
      Status: TransactionStatus,
      async commit({ contracts, request, writeContract }) {
        const collateral = contracts.collaterals[request.collIndex];
        if (!collateral) {
          throw new Error("Invalid collateral index: " + request.collIndex);
        }

        const { earnPosition, prevEarnPosition, claimRewards } = request;
        const change = earnPosition.deposit[0] - prevEarnPosition.deposit[0];
        return writeContract({
          ...collateral.contracts.StabilityPool,
          functionName: "provideToSP",
          args: [change, claimRewards],
        });
      },
      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },

    withdrawFromStabilityPool: {
      name: () => "Withdraw",
      Status: TransactionStatus,
      async commit({ contracts, request, writeContract }) {
        const collateral = contracts.collaterals[request.collIndex];
        if (!collateral) {
          throw new Error("Invalid collateral index: " + request.collIndex);
        }

        const { earnPosition, prevEarnPosition, claimRewards } = request;
        const change = earnPosition.deposit[0] - prevEarnPosition.deposit[0];
        return writeContract({
          ...collateral.contracts.StabilityPool,
          functionName: "withdrawFromSP",
          args: [-change, claimRewards],
        });
      },
      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },
  },

  async getSteps({ request: { earnPosition, prevEarnPosition } }) {
    return dn.gt(earnPosition.deposit, prevEarnPosition.deposit)
      ? ["provideToStabilityPool"]
      : ["withdrawFromStabilityPool"];
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },
};
