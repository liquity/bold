import type { Dnum, RiskLevel, TroveStatus } from "@/src/types";
import type { CollateralToken } from "@liquity2/uikit";
import type { ReactNode } from "react";

import { fmtnum, formatLiquidationRisk, formatRedemptionRisk } from "@/src/formatting";
import { riskLevelToStatusMode } from "@/src/uikit-utils";
import { css } from "@/styled-system/css";
import { StatusDot } from "@liquity2/uikit";
import * as dn from "dnum";
import { CardRow, CardRows } from "./shared";

type PositionCardSecondaryContentProps = {
  status: TroveStatus;
  collSurplus: Dnum | null;
  collSurplusOnChain: Dnum | null;
  liquidatedColl: Dnum | null;
  liquidatedDebt: Dnum | null;
  priceAtLiquidation: Dnum | null;
  token: CollateralToken;
  ltv: Dnum | null | undefined;
  liquidationRisk: RiskLevel | null | undefined;
  interestRate: Dnum;
  batchManager: string | null;
  redemptionRisk: {
    status: string;
    data: RiskLevel | null | undefined;
  };
};

export function PositionCardSecondaryContent({
  status,
  collSurplus,
  collSurplusOnChain,
  liquidatedColl,
  liquidatedDebt,
  priceAtLiquidation,
  token,
  ltv,
  liquidationRisk,
  interestRate,
  batchManager,
  redemptionRisk,
}: PositionCardSecondaryContentProps): ReactNode {
  const labels = {
    liquidatedColl: "Liq. coll.",
    liquidatedDebt: "Liq. debt",
    liquidationPrice: "Liq. price",
    claimableCollateral: "Remaining coll.",
  };

  const {
    liquidatedColl: liquidatedCollLabel,
    liquidatedDebt: liquidatedDebtLabel,
    liquidationPrice: liquidationPriceLabel,
    claimableCollateral: claimableCollateralLabel,
  } = labels;

  if (status === "liquidated") {
    const collateralWasClaimed = collSurplus && dn.gt(collSurplus, 0)
      && collSurplusOnChain !== null
      && dn.eq(collSurplusOnChain, 0);

    return (
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
                {liquidatedCollLabel}
              </div>
              <div
                className={css({
                  color: "positionContent",
                })}
              >
                {liquidatedColl ? fmtnum(liquidatedColl) : "−"} {token.name}
              </div>
            </div>
          }
          end={
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
                {liquidatedDebtLabel}
              </div>
              <div
                className={css({
                  color: "positionContent",
                })}
              >
                {liquidatedDebt ? fmtnum(liquidatedDebt) : "−"} BOLD
              </div>
            </div>
          }
        />
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
                {liquidationPriceLabel}
              </div>
              <div
                className={css({
                  color: "positionContent",
                })}
              >
                {priceAtLiquidation ? `$${fmtnum(priceAtLiquidation)}` : "−"}
              </div>
            </div>
          }
          end={
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
                {claimableCollateralLabel}
              </div>
              <div
                className={css({
                  color: "positionContent",
                })}
              >
                {collateralWasClaimed ? "0" : collSurplus ? fmtnum(collSurplus) : "−"} {token.name}
              </div>
            </div>
          }
        />
      </CardRows>
    );
  }

  return (
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
            {ltv
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
              {fmtnum(interestRate, { preset: "pct2", suffix: "%" })}
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
  );
}
