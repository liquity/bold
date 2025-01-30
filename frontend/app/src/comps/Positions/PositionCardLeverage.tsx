import type { PositionLoanCommitted } from "@/src/types";
import type { Dnum } from "dnum";
import type { ReactNode } from "react";

import { formatRedemptionRisk } from "@/src/formatting";
import { fmtnum } from "@/src/formatting";
import { getLiquidationRisk, getLtv, getRedemptionRisk } from "@/src/liquity-math";
import { getCollToken } from "@/src/liquity-utils";
import { usePrice } from "@/src/services/Prices";
import { riskLevelToStatusMode } from "@/src/uikit-utils";
import { css } from "@/styled-system/css";
import { HFlex, IconLeverage, StatusDot, TokenIcon } from "@liquity2/uikit";
import * as dn from "dnum";
import Link from "next/link";
import { PositionCard } from "./PositionCard";
import { CardRow, CardRows } from "./shared";

export function PositionCardLeverage({
  debt,
  collIndex,
  deposit,
  interestRate,
  statusTag,
  troveId,
}:
  & Pick<
    PositionLoanCommitted,
    | "collIndex"
    | "deposit"
    | "interestRate"
    | "troveId"
  >
  & {
    debt: null | Dnum;
    statusTag?: ReactNode;
  })
{
  const token = getCollToken(collIndex);
  if (!token) {
    throw new Error(`Collateral token not found for index ${collIndex}`);
  }

  const collateralPriceUsd = usePrice(token.symbol);

  const maxLtv = dn.from(1 / token.collateralRatio, 18);
  const ltv = debt && collateralPriceUsd.data
    && getLtv(deposit, debt, collateralPriceUsd.data);
  const liquidationRisk = ltv && getLiquidationRisk(ltv, maxLtv);
  const redemptionRisk = getRedemptionRisk(interestRate);

  return (
    <Link
      href={`/loan?id=${collIndex}:${troveId}`}
      legacyBehavior
      passHref
    >
      <PositionCard
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
              {deposit ? fmtnum(deposit, 2) : "−"}
              <TokenIcon size={24} symbol={token.symbol} />
            </HFlex>
          ),
          label: "Net value",
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
                  {ltv && (
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
                  )}
                </div>
              }
              end={
                <div
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 14,
                  })}
                >
                  {liquidationRisk && (
                    <div
                      className={css({
                        color: "positionContent",
                      })}
                    >
                      {liquidationRisk === "low" ? "Low" : liquidationRisk === "medium" ? "Medium" : "High"}{" "}
                      liquidation risk
                    </div>
                  )}
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
                    gap: 8,
                    fontSize: 14,
                  })}
                >
                  <div
                    className={css({
                      color: "positionContentAlt",
                    })}
                  >
                    Interest rate
                  </div>
                  <div
                    className={css({
                      color: "positionContent",
                    })}
                  >
                    {fmtnum(interestRate, "pct2")}%
                  </div>
                </div>
              }
              end={
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
                      color: "positionContent",
                    })}
                  >
                    {formatRedemptionRisk(redemptionRisk)}
                  </div>
                  <StatusDot
                    mode={riskLevelToStatusMode(redemptionRisk)}
                    size={8}
                  />
                </div>
              }
            />
          </CardRows>
        }
      />
    </Link>
  );
}
