import type { PositionLoanCommitted } from "@/src/types";
import * as dn from "dnum";
import type { ReactNode } from "react";

import { Amount } from "@/src/comps/Amount/Amount";
import { CrossedText } from "@/src/comps/CrossedText/CrossedText";
import { Value } from "@/src/comps/Value/Value";
import { DNUM_0 } from "@/src/dnum-utils";
import { fmtnum } from "@/src/formatting";
import { getLoanDetails } from "@/src/liquity-math";
import { getCollToken, useRedemptionRiskOfLoan } from "@/src/liquity-utils";
import { usePrice } from "@/src/services/Prices";
import { roundToDecimal } from "@/src/utils";
import { css } from "@/styled-system/css";
import { HFlex, IconLeverage, TokenIcon } from "@liquity2/uikit";
import { PositionCard } from "./PositionCard";
import { PositionCardSecondaryContent } from "./PositionCardSecondaryContent";

export function PositionCardLeverage({
  batchManager,
  borrowed,
  branchId,
  deposit,
  interestRate,
  status,
  statusTag,
  troveId,
  isZombie,
  liquidatedColl,
  liquidatedDebt,
  collSurplus,
  priceAtLiquidation,
  collSurplusOnChain,
}:
  & Pick<
    PositionLoanCommitted,
    | "batchManager"
    | "borrowed"
    | "branchId"
    | "deposit"
    | "interestRate"
    | "isZombie"
    | "status"
    | "troveId"
    | "liquidatedColl"
    | "liquidatedDebt"
    | "collSurplus"
    | "priceAtLiquidation"
  >
  & { statusTag?: ReactNode; collSurplusOnChain: dn.Dnum | null })
{
  const token = getCollToken(branchId);
  if (!token) {
    throw new Error(`Collateral token not found for index ${branchId}`);
  }

  const collateralPriceUsd = usePrice(token.symbol);
  const redemptionRisk = useRedemptionRiskOfLoan({ branchId, troveId, interestRate, status, isZombie });

  const { ltv, liquidationRisk, ...loanDetails } = getLoanDetails(
    deposit,
    borrowed,
    interestRate,
    token.collateralRatio,
    collateralPriceUsd.data ?? null,
  );

  return (
    <PositionCard
      className="position-card position-card-loan position-card-leverage"
      href={`/loan?id=${branchId}:${troveId}`}
      heading={[
        <div
          key="start"
          className={css({
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "positionContent",
          })}
        >
          <div>Multiply position</div>
          {statusTag}
        </div>,
      ]}
      contextual={
        <div
          className={css({
            color: "positionContent",
          })}
        >
          <IconLeverage size={32} />
        </div>
      }
      main={{
        value: status === "liquidated"
          ? (
            <HFlex gap={8} alignItems="center" justifyContent="flex-start">
              <CrossedText>
                <Amount value={liquidatedDebt ?? borrowed} fallback="−" />
              </CrossedText>
              <TokenIcon size={24} symbol="BOLD" />
            </HFlex>
          )
          : (
            <HFlex gap={8} alignItems="center" justifyContent="flex-start">
              <Value negative={loanDetails.status === "underwater"}>
                <Amount value={loanDetails.depositPreLeverage ?? 0} />
              </Value>

              <TokenIcon size={24} symbol={token.symbol} />

              {loanDetails.leverageFactor !== null && (
                <div className={css({ display: "flex", flexDirection: "column", gap: 4 })}>
                  <Value
                    negative={loanDetails.status === "underwater" || loanDetails.status === "liquidatable"}
                    title={`Multiply: ${roundToDecimal(loanDetails.leverageFactor, 1)}x`}
                    className={css({ fontSize: 16 })}
                  >
                    {roundToDecimal(loanDetails.leverageFactor, 1)}x
                  </Value>
                </div>
              )}
            </HFlex>
          ),
        label: status === "liquidated"
          ? (
            <>
              Was backed by {liquidatedColl ? fmtnum(liquidatedColl) : "−"} {token.name}
            </>
          )
          : <>Exposure {!dn.eq(deposit, DNUM_0) ? fmtnum(deposit) : "−"} {token.name}</>,
      }}
      secondary={
        <PositionCardSecondaryContent
          status={status}
          collSurplus={collSurplus}
          collSurplusOnChain={collSurplusOnChain}
          liquidatedColl={liquidatedColl}
          liquidatedDebt={liquidatedDebt}
          priceAtLiquidation={priceAtLiquidation}
          token={token}
          ltv={ltv}
          liquidationRisk={liquidationRisk}
          interestRate={interestRate}
          batchManager={batchManager}
          redemptionRisk={redemptionRisk}
        />
      }
    />
  );
}
