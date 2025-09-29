import type { PositionLoanCommitted } from "@/src/types";
import * as dn from "dnum";
import type { ReactNode } from "react";

import { Amount } from "@/src/comps/Amount/Amount";
import { Value } from "@/src/comps/Value/Value";
import { DNUM_0 } from "@/src/dnum-utils";
import { formatLiquidationRisk, formatRedemptionRisk } from "@/src/formatting";
import { fmtnum } from "@/src/formatting";
import { getLoanDetails } from "@/src/liquity-math";
import { getCollToken, useRedemptionRiskOfLoan } from "@/src/liquity-utils";
import { usePrice } from "@/src/services/Prices";
import { riskLevelToStatusMode } from "@/src/uikit-utils";
import { roundToDecimal } from "@/src/utils";
import { css } from "@/styled-system/css";
import { HFlex, IconLeverage, StatusDot, TokenIcon } from "@liquity2/uikit";
import { PositionCard } from "./PositionCard";
import { CardRow, CardRows } from "./shared";

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
  >
  & { statusTag?: ReactNode })
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
        value: (
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
        label: <>Exposure {!dn.eq(deposit, DNUM_0) ? fmtnum(deposit) : "−"} {token.name}</>,
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
                {status === "liquidated"
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
                        color: liquidationRisk === "high"
                          ? "var(--status-negative)"
                          : liquidationRisk === "medium"
                          ? "var(--status-warning)"
                          : "var(--status-positive)",
                      }}
                    >
                      {fmtnum(ltv, "pct2")}%
                    </div>
                  )
                  : "−"}
              </div>
            }
            end={
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
                  {formatLiquidationRisk(liquidationRisk ?? "not-applicable")}
                </div>
                <StatusDot
                  mode={riskLevelToStatusMode(liquidationRisk)}
                  size={8}
                />
              </div>
            }
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
                  {status === "liquidated"
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
            end={
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
                    {formatRedemptionRisk(redemptionRisk.data ?? null)}
                  </div>
                }
                <StatusDot
                  mode={riskLevelToStatusMode(redemptionRisk.data)}
                  size={8}
                />
              </div>
            }
          />
        </CardRows>
      }
    />
  );
}
