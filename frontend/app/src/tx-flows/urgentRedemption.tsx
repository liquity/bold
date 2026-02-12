import type { FlowDeclaration } from "@/src/services/TransactionFlow";
import type { BranchId } from "@/src/types";

import { Amount } from "@/src/comps/Amount/Amount";
import { getBranchContract, getProtocolContract } from "@/src/contracts";
import content from "@/src/content";
import { dnum18 } from "@/src/dnum-utils";
import { URGENT_REDEMPTION_BONUS_PCT } from "@/src/urgent-redemption-utils";
import { getBranch, getCollToken } from "@/src/liquity-utils";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { useLastGoodPrice } from "@/src/services/Prices";
import { vDnum } from "@/src/valibot-utils";
import { css } from "@/styled-system/css";
import { HFlex, InfoTooltip, TokenIcon, VFlex } from "@liquity2/uikit";
import * as dn from "dnum";
import * as v from "valibot";
import { maxUint256 } from "viem";
import { createRequestSchema, verifyTransaction } from "./shared";

const RequestSchema = createRequestSchema(
  "urgentRedemption",
  {
    branchId: v.number() as v.BaseSchema<BranchId, BranchId, v.BaseIssue<unknown>>,
    boldAmount: vDnum(),
    troveIds: v.array(v.string()),
    minCollateral: vDnum(),
    expectedCollateral: vDnum(),
    slippagePct: vDnum(),
  },
);

export type UrgentRedemptionRequest = v.InferOutput<typeof RequestSchema>;

export const urgentRedemption: FlowDeclaration<UrgentRedemptionRequest> = {
  title: content.urgentRedeemScreen.txFlow.title,
  Summary: () => null,

  Details(ctx) {
    const { branchId, boldAmount, expectedCollateral, troveIds, slippagePct } = ctx.request;
    const branch = getBranch(branchId);
    const collToken = getCollToken(branchId);
    const tokenName = collToken.symbol === "ETH" ? "WETH" : collToken.name;
    const price = useLastGoodPrice(branch.symbol);

    const collWithoutBonus = price.data
      ? dn.div(boldAmount, price.data)
      : null;
    const bonus = collWithoutBonus
      ? dn.sub(expectedCollateral, collWithoutBonus)
      : null;

    return (
      <VFlex gap={32}>
        <HFlex justifyContent="space-between" alignItems="start">
          <HFlex gap={4}>
            <div>{content.urgentRedeemScreen.txFlow.youRedeemBold}</div>
            <InfoTooltip>
              {content.urgentRedeemScreen.txFlow.redeemTooltip(URGENT_REDEMPTION_BONUS_PCT)}
            </InfoTooltip>
          </HFlex>
          <VFlex gap={4} alignItems="flex-end">
            <HFlex gap={6} className={css({ fontSize: 18 })}>
              <Amount format="2z" value={boldAmount} fallback="−" title={{ suffix: " BOLD" }} />
              <TokenIcon symbol="BOLD" size={20} />
            </HFlex>
          </VFlex>
        </HFlex>

        <HFlex justifyContent="space-between" alignItems="start">
          <HFlex gap={4}>
            <div>{content.urgentRedeemScreen.txFlow.youReceiveToken(tokenName)}</div>
            <InfoTooltip>
              {content.urgentRedeemScreen.txFlow.receiveTooltip(tokenName, URGENT_REDEMPTION_BONUS_PCT)}
            </InfoTooltip>
          </HFlex>
          <VFlex gap={4} alignItems="flex-end">
            <HFlex gap={6} className={css({ fontSize: 18 })}>
              <Amount format="4z" value={expectedCollateral} fallback="−" title={{ suffix: ` ${tokenName}` }} />
              <TokenIcon symbol={collToken.symbol} size={20} />
            </HFlex>
            {price.data && (
              <div className={css({ paddingRight: 26, color: "contentAlt", fontSize: 14 })}>
                <Amount prefix="$" value={dn.mul(expectedCollateral, price.data)} fallback="−" />
              </div>
            )}
          </VFlex>
        </HFlex>

        <HFlex justifyContent="space-between" alignItems="start">
          <HFlex gap={4}>
            <div className={css({ color: "contentAlt" })}>{content.urgentRedeemScreen.bonusLabel(URGENT_REDEMPTION_BONUS_PCT)}</div>
          </HFlex>
          <VFlex gap={4} alignItems="flex-end">
            <HFlex gap={6} className={css({ fontSize: 18, color: "contentAlt" })}>
              <Amount format="4z" value={bonus} fallback="−" title={{ suffix: ` ${tokenName}` }} />
              <TokenIcon symbol={collToken.symbol} size={20} />
            </HFlex>
            {price.data && bonus && (
              <div className={css({ paddingRight: 26, color: "contentAlt", fontSize: 14 })}>
                <Amount prefix="$" value={dn.mul(bonus, price.data)} fallback="−" />
              </div>
            )}
          </VFlex>
        </HFlex>

        <HFlex justifyContent="space-between" alignItems="start">
          <HFlex gap={4}>
            <div className={css({ color: "contentAlt" })}>{content.urgentRedeemScreen.txFlow.trovesLabel}</div>
            <InfoTooltip>
              {content.urgentRedeemScreen.txFlow.trovesTooltip}
            </InfoTooltip>
          </HFlex>
          <div className={css({ color: "contentAlt" })}>
            {content.urgentRedeemScreen.txFlow.trovesValue(troveIds.length)}
          </div>
        </HFlex>

        <HFlex justifyContent="space-between" alignItems="start">
          <HFlex gap={4}>
            <div>{content.urgentRedeemScreen.slippageTolerance}</div>
            <InfoTooltip>
              {content.urgentRedeemScreen.txFlow.slippageTooltip(
                <Amount value={dn.sub(dn.from(1, 18), slippagePct)} percentage format="full" />,
              )}
            </InfoTooltip>
          </HFlex>
          <div>
            <Amount value={slippagePct} percentage />
          </div>
        </HFlex>
      </VFlex>
    );
  },

  steps: {
    approve: {
      name: () => content.urgentRedeemScreen.txFlow.approveStep,
      Status: (props) => <TransactionStatus {...props} approval="approve-only" />,

      async commit({ request, writeContract, preferredApproveMethod }) {
        const TroveManager = getBranchContract(request.branchId, "TroveManager");
        const BoldToken = getProtocolContract("BoldToken");

        return writeContract({
          ...BoldToken,
          functionName: "approve",
          args: [
            TroveManager.address,
            preferredApproveMethod === "approve-infinite"
              ? maxUint256
              : request.boldAmount[0],
          ],
        });
      },
      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },

    urgentRedemption: {
      name: () => content.urgentRedeemScreen.txFlow.redeemStep,
      Status: TransactionStatus,

      async commit({ request, writeContract }) {
        const TroveManager = getBranchContract(request.branchId, "TroveManager");
        const boldAmount = request.boldAmount[0];
        const minCollateral = request.minCollateral[0];

        return writeContract({
          ...TroveManager,
          functionName: "urgentRedemption",
          args: [boldAmount, request.troveIds.map(BigInt), minCollateral],
        });
      },
      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },
  },

  async getSteps(ctx) {
    const steps: string[] = [];

    const TroveManager = getBranchContract(ctx.request.branchId, "TroveManager");
    const boldAllowance = await ctx.readContract({
      ...getProtocolContract("BoldToken"),
      functionName: "allowance",
      args: [ctx.account, TroveManager.address],
    });

    if (dn.gt(ctx.request.boldAmount, dnum18(boldAllowance))) {
      steps.push("approve");
    }

    steps.push("urgentRedemption");
    return steps;
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },
};
