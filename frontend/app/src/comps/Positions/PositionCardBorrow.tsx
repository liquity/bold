import type { PositionLoanCommitted } from "@/src/types";
import type { Dnum } from "dnum";
import type { ReactNode } from "react";

import { Amount } from "@/src/comps/Amount/Amount";
import { formatLiquidationRisk } from "@/src/formatting";
import { fmtnum } from "@/src/formatting";
import { getLiquidationRisk, getLtv, getRedemptionRisk } from "@/src/liquity-math";
import { getCollToken, shortenTroveId, useDebtPositioning } from "@/src/liquity-utils";
import { usePrice } from "@/src/services/Prices";
import { riskLevelToStatusMode } from "@/src/uikit-utils";
import { css } from "@/styled-system/css";
import { HFlex, IconBorrow, StatusDot, TokenIcon } from "@liquity2/uikit";
import * as dn from "dnum";
import { PositionCard } from "./PositionCard";
import { CardRow, CardRows } from "./shared";

export function PositionCardBorrow({
  batchManager,
  debt,
  branchId,
  deposit,
  interestRate,
  liquidated = false,
  statusTag,
  troveId,
}:
  & Pick<
    PositionLoanCommitted,
    | "batchManager"
    | "branchId"
    | "interestRate"
    | "troveId"
  >
  & {
    debt: null | Dnum;
    deposit: null | Dnum;
    liquidated?: boolean;
    statusTag?: ReactNode;
  })
{
  const token = getCollToken(branchId);
  const collateralPriceUsd = usePrice(token?.symbol ?? null);

  const ltv = debt && deposit && collateralPriceUsd.data
    && getLtv(deposit, debt, collateralPriceUsd.data);
  const debtPositioning = useDebtPositioning(branchId, interestRate);
  const redemptionRisk = getRedemptionRisk(debtPositioning.debtInFront, debtPositioning.totalDebt);

  const maxLtv = token && dn.from(1 / token.collateralRatio, 18);
  const liquidationRisk = ltv && maxLtv && getLiquidationRisk(ltv, maxLtv);

  const title = token
    ? [
      `Loan ID: ${shortenTroveId(troveId)}…`,
      `Debt: ${fmtnum(debt, "full")} BOLD`,
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
          <div>BOLD loan</div>
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
        value: (
          <HFlex gap={8} alignItems="center" justifyContent="flex-start">
            <div
              className={css({
                display: "grid",
              })}
            >
              <Amount value={debt} fallback="−" />
            </div>
            <TokenIcon
              size={24}
              symbol="BOLD"
            />
          </HFlex>
        ),
        // label: "Total debt",
        label: token && (
          <div
            className={css({
              display: "flex",
              gap: 8,
              alignItems: "cente",
            })}
          >
            Backed by {deposit ? fmtnum(deposit) : "−"} {token.name}
            <TokenIcon size="small" symbol={token.symbol} />
          </div>
        ),
      }}
      secondary={
        <CardRows>
          <CardRow
            start={
              <div
                className={css({
                  display: "flex",
                  gap: 8,
                  fontSize: 14,
                })}
              >
                <div
                  className={css({
                    color: "positionContentAlt",
                  })}
                >
                  LTV
                </div>
                {liquidated
                  ? "N/A"
                  : ltv
                  ? (
                    <div
                      className={css({
                        "--status-positive": "token(colors.positiveAlt)",
                        "--status-warning": "token(colors.warning)",
                        "--status-negative": "token(colors.negative)",
                      })}
                      style={{
                        color: liquidationRisk === "low"
                          ? "var(--status-positive)"
                          : liquidationRisk === "medium"
                          ? "var(--status-warning)"
                          : "var(--status-negative)",
                      }}
                    >
                      {fmtnum(ltv, "pct2")}%
                    </div>
                  )
                  : "−"}
              </div>
            }
            end={!liquidated && (
              <div
                className={css({
                  display: "grid",
                  gridAutoFlow: "column",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 14,
                })}
              >
                <div
                  className={css({
                    color: "positionContent",
                  })}
                >
                  {liquidationRisk && formatLiquidationRisk(liquidationRisk)}
                </div>
                <StatusDot
                  mode={riskLevelToStatusMode(liquidationRisk)}
                  size={8}
                />
              </div>
            )}
          />
          <CardRow
            start={
              <div
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 14,
                })}
              >
                <div
                  className={css({
                    color: "positionContentAlt",
                  })}
                >
                  {batchManager ? "Int. rate" : "Interest rate"}
                </div>
                <div
                  className={css({
                    color: "positionContent",
                  })}
                >
                  {liquidated
                    ? "N/A"
                    : fmtnum(interestRate, { preset: "pct2", suffix: "%" })}
                </div>
                {batchManager && (
                  <div
                    title={`Interest rate delegate: ${batchManager}`}
                    className={css({
                      display: "grid",
                      placeItems: "center",
                      width: 16,
                      height: 16,
                      fontSize: 10,
                      fontWeight: 600,
                      color: "content",
                      background: "brandCyan",
                      borderRadius: "50%",
                    })}
                  >
                    D
                  </div>
                )}
              </div>
            }
            end={!liquidated && (
              <div
                className={css({
                  display: "grid",
                  gridAutoFlow: "column",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 14,
                })}
              >
                {
                  <div
                    className={css({
                      flexShrink: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      color: "positionContent",
                    })}
                  >
                    {redemptionRisk === "low"
                      ? "Low"
                      : redemptionRisk === "medium"
                      ? "Medium"
                      : "High"} redemption risk
                  </div>
                }
                <StatusDot
                  mode={riskLevelToStatusMode(redemptionRisk)}
                  size={8}
                />
              </div>
            )}
          />
        </CardRows>
      }
    />
  );
}
