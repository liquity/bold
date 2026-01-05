import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { getProtocolContract } from "@/src/contracts";
import { dnum18, DNUM_1 } from "@/src/dnum-utils";
import { getBranches, getCollToken } from "@/src/liquity-utils";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { useCollateralRedemptionPrices, usePrice } from "@/src/services/Prices";
import { vDnum } from "@/src/valibot-utils";
import { css } from "@/styled-system/css";
import { HFlex, InfoTooltip, TokenIcon, VFlex } from "@liquity2/uikit";
import * as dn from "dnum";
import * as v from "valibot";
import { REDEMPTION_SLIPPAGE_TOLERANCE } from "../constants";
import { createRequestSchema, verifyTransaction } from "./shared";

const RequestSchema = createRequestSchema(
  "redeemCollateral",
  {
    amount: vDnum(),
    maxIterationsPerCollateral: v.number(),
    feePct: vDnum(),
    collRedeemed: v.array(vDnum()),
    slippageTolerance: vDnum(),
  },
);

export type RedeemCollateralRequest = v.InferOutput<typeof RequestSchema>;

export const redeemCollateral: FlowDeclaration<RedeemCollateralRequest> = {
  title: "Review & Send Transaction",
  Summary: () => null,

  Details(ctx) {
    const { amount, feePct, collRedeemed } = ctx.request;
    const branches = getBranches();
    const boldPrice = usePrice("BOLD");
    const collPrices = useCollateralRedemptionPrices(branches.map((b) => b.symbol));

    return (
      <VFlex gap={32}>
        <HFlex justifyContent="space-between" alignItems="start">
          <HFlex gap={4}>
            <div>
              You redeem JPYDF{" "}
              <span className={css({ color: "contentAlt" })}>
                (incl. <Amount value={feePct} percentage /> fee)
              </span>
            </div>
            <InfoTooltip>
              This is the estimated amount of JPYDF you will pay, including a <Amount value={feePct} percentage />{" "}
              redemption fee. The actual fee may be up to{" "}
              <Amount value={REDEMPTION_SLIPPAGE_TOLERANCE} percentage format="full" />{" "}
              higher than this due to slippage.
            </InfoTooltip>
          </HFlex>
          <VFlex gap={4} alignItems="flex-end">
            <HFlex gap={6} className={css({ fontSize: 18 })}>
              <Amount format="2z" value={amount} title={{ suffix: " JPYDF" }} />
              <TokenIcon symbol="BOLD" size={20} />
            </HFlex>
            {boldPrice.data && (
              <div className={css({ paddingRight: 26, color: "contentAlt", fontSize: 14 })}>
                <Amount prefix="$" value={dn.mul(amount, boldPrice.data)} />
              </div>
            )}
          </VFlex>
        </HFlex>

        {branches.map(({ branchId }) => {
          const collateralToken = getCollToken(branchId);
          const collateralTokenName = collateralToken.symbol === "ETH" ? "WETH" : collateralToken.name;

          return (
            <HFlex key={collateralToken.symbol} justifyContent="space-between" alignItems="start">
              <HFlex gap={4} className={css({ fontSize: 16 })}>
                You receive {collateralTokenName}
                <InfoTooltip>
                  This is the estimated amount of {collateralTokenName} you will receive. The actual amount may be up to
                  {" "}
                  <Amount value={REDEMPTION_SLIPPAGE_TOLERANCE} percentage format="full" />{" "}
                  lower than this due to slippage.
                </InfoTooltip>
              </HFlex>
              <VFlex gap={4} alignItems="flex-end">
                <HFlex gap={6} className={css({ fontSize: 18 })}>
                  <Amount format="4z" value={collRedeemed[branchId]} title={{ suffix: ` ${collateralTokenName}` }} />
                  <TokenIcon symbol={collateralToken.symbol} size={20} />
                </HFlex>
                {collRedeemed[branchId] && collPrices.data?.[branchId] && (
                  <div className={css({ paddingRight: 26, color: "contentAlt", fontSize: 14 })}>
                    <Amount prefix="$" value={dn.mul(collRedeemed[branchId], collPrices.data[branchId])} />
                  </div>
                )}
              </VFlex>
            </HFlex>
          );
        })}
      </VFlex>
    );
  },

  steps: {
    approve: {
      name: () => "Approve JPYDF",
      Status: TransactionStatus,

      async commit({ request, writeContract }) {
        const RedemptionHelper = getProtocolContract("RedemptionHelper");
        const BoldToken = getProtocolContract("BoldToken");

        return writeContract({
          ...BoldToken,
          functionName: "approve",
          args: [RedemptionHelper.address, request.amount[0]],
        });
      },
      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },

    redeemCollateral: {
      name: () => "Redeem JPYDF",
      Status: TransactionStatus,

      async commit({ request, writeContract }) {
        const bold = dn.from(request.amount, 18)[0];
        const maxIterationsPerCollateral = BigInt(request.maxIterationsPerCollateral);
        const maxFeePct = dn.add(request.feePct, request.slippageTolerance, 18)[0];
        const slippageFactor = dn.sub(DNUM_1, request.slippageTolerance);
        const minCollRedeemed = request.collRedeemed.map((collRedeemed) => dn.mul(collRedeemed, slippageFactor, 18)[0]);
        const RedemptionHelper = getProtocolContract("RedemptionHelper");

        return writeContract({
          ...RedemptionHelper,
          functionName: "redeemCollateral",
          args: [bold, maxIterationsPerCollateral, maxFeePct, minCollRedeemed],
        });
      },
      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },
  },

  async getSteps(ctx) {
    const steps = [];

    // check for allowance
    const boldAllowance = await ctx.readContract({
      ...getProtocolContract("BoldToken"),
      functionName: "allowance",
      args: [
        ctx.account,
        getProtocolContract("RedemptionHelper").address,
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

export const StoredBalancesChangeSchema = v.object({
  stringifiedRequest: v.string(),
  balanceChanges: v.array(v.object({
    symbol: v.string(),
    change: vDnum(),
  })),
});
