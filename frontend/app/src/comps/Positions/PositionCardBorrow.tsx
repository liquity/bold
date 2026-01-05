import type { PositionLoanCommitted } from "@/src/types";
import * as dn from "dnum";
import type { ReactNode } from "react";

import { Amount } from "@/src/comps/Amount/Amount";
import { CrossedText } from "@/src/comps/CrossedText/CrossedText";
import { DNUM_0 } from "@/src/dnum-utils";
import { fmtnum } from "@/src/formatting";
import { getLiquidationRisk, getLtv } from "@/src/liquity-math";
import { getCollToken, shortenTroveId, useRedemptionRiskOfLoan } from "@/src/liquity-utils";
import { usePrice } from "@/src/services/Prices";
import { css } from "@/styled-system/css";
import { HFlex, IconBorrow, TokenIcon } from "@liquity2/uikit";
import { PositionCard } from "./PositionCard";
import { PositionCardSecondaryContent } from "./PositionCardSecondaryContent";

export function PositionCardBorrow({
  batchManager,
  borrowed,
  branchId,
  deposit,
  interestRate,
  isZombie,
  status,
  statusTag,
  troveId,
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
  const collateralPriceUsd = usePrice(token?.symbol ?? null);

  const ltv = collateralPriceUsd.data && getLtv(deposit, borrowed, collateralPriceUsd.data);
  const redemptionRisk = useRedemptionRiskOfLoan({ branchId, troveId, interestRate, status, isZombie });

  const maxLtv = dn.from(1 / token.collateralRatio, 18);
  const liquidationRisk = ltv && getLiquidationRisk(ltv, maxLtv);

  const title = token
    ? [
      `Loan ID: ${shortenTroveId(troveId)}…`,
      `Debt: ${fmtnum(borrowed, "full")} JPYDF`,
      `Collateral: ${fmtnum(deposit, "full")} ${token.name}`,
      `Interest rate: ${fmtnum(interestRate, "pctfull")}%`,
    ]
    : [];

  return (
    <PositionCard
      className="position-card position-card-loan position-card-borrow"
      href={`/loan?id=${branchId}:${troveId}`}
      title={title.join("\n")}
      heading={
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "positionContent",
          })}
        >
          <div>JPYDF loan</div>
          {statusTag}
        </div>
      }
      contextual={
        <div
          className={css({
            color: "positionContent",
          })}
        >
          <IconBorrow size={32} />
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
              <Amount value={borrowed} fallback="−" />
              <TokenIcon size={24} symbol="BOLD" />
            </HFlex>
          ),
        label: status === "liquidated"
          ? (
            <div
              className={css({
                display: "flex",
                gap: 8,
                alignItems: "cente",
              })}
            >
              Was backed by {liquidatedColl ? fmtnum(liquidatedColl) : "−"} {token.name}
              <TokenIcon size="small" symbol={token.symbol} />
            </div>
          )
          : (
            <div
              className={css({
                display: "flex",
                gap: 8,
                alignItems: "cente",
              })}
            >
              Backed by {!dn.eq(deposit, DNUM_0) ? fmtnum(deposit) : "−"} {token.name}
              <TokenIcon size="small" symbol={token.symbol} />
            </div>
          ),
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
