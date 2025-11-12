import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { getProtocolContract } from "@/src/contracts";
import { dnum18, DNUM_1 } from "@/src/dnum-utils";
import { getBranches, getCollToken } from "@/src/liquity-utils";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { useCollateralPrices, usePrice } from "@/src/services/Prices";
import { vDnum } from "@/src/valibot-utils";
import { HFlex, InfoTooltip } from "@liquity2/uikit";
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
    const { amount, collRedeemed } = ctx.request;
    const branches = getBranches();
    const boldPrice = usePrice("BOLD");
    const collPrices = useCollateralPrices(branches.map((b) => b.symbol));

    return (
      <>
        <TransactionDetailsRow
          label="Redemption fee"
          value={[
            <HFlex gap={4}>
              <Amount key="start" value={ctx.request.feePct} percentage />
              <InfoTooltip>
                This is the estimated fee you will pay. The actual fee may be up to{" "}
                <Amount value={REDEMPTION_SLIPPAGE_TOLERANCE} percentage format="full" />{" "}
                higher than this due to slippage.
              </InfoTooltip>
            </HFlex>,
          ]}
        />

        <TransactionDetailsRow
          label="Redeeming"
          value={[
            <HFlex gap={4}>
              <Amount key="start" value={amount} suffix=" BOLD" />
              <InfoTooltip>
                This is the estimated amount of BOLD you will pay. The actual amount may be slightly lower than this.
              </InfoTooltip>
            </HFlex>,
            boldPrice.data && <Amount key="end" prefix="$" value={dn.mul(amount, boldPrice.data)} />,
          ]}
        />

        {branches.map(({ branchId }, i) => {
          const collateralToken = getCollToken(branchId);
          const collateralTokenName = collateralToken.symbol === "ETH" ? "WETH" : collateralToken.name;

          return (
            <TransactionDetailsRow
              key={collateralToken.symbol}
              label={"Receiving" + (branches.length > 1 ? ` #${i + 1}` : "")}
              value={[
                <HFlex gap={4}>
                  <Amount key="start" value={collRedeemed[branchId]} suffix={` ${collateralTokenName}`} format="4z" />
                  <InfoTooltip>
                    This is the estimated amount of {collateralTokenName}{" "}
                    you will receive. The actual amount may be up to{" "}
                    <Amount value={REDEMPTION_SLIPPAGE_TOLERANCE} percentage format="full" />{" "}
                    lower than this due to slippage.
                  </InfoTooltip>
                </HFlex>,
                collRedeemed[branchId] && collPrices.data?.[branchId] && (
                  <Amount key="end" prefix="$" value={dn.mul(collRedeemed[branchId], collPrices.data[branchId])} />
                ),
              ]}
            />
          );
        })}
      </>
    );
  },

  steps: {
    approve: {
      name: () => "Approve BOLD",
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
      name: () => "Redeem BOLD",
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
