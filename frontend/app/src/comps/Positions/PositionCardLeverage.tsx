import type { PositionLoanCommitted } from "@/src/types";

import { getContracts } from "@/src/contracts";
import { formatRedemptionRisk } from "@/src/formatting";
import { getLiquidationRisk, getLtv, getRedemptionRisk } from "@/src/liquity-math";
import { usePrice } from "@/src/services/Prices";
import { riskLevelToStatusMode } from "@/src/uikit-utils";
import { css } from "@/styled-system/css";
import { HFlex, IconLeverage, StatusDot, StrongCard, TokenIcon, TOKENS_BY_SYMBOL } from "@liquity2/uikit";
import * as dn from "dnum";
import Link from "next/link";
import { CardRow, CardRows, EditSquare } from "./shared";

export function PositionCardLeverage({
  borrowed,
  collIndex,
  deposit,
  interestRate,
  troveId,
}: Pick<
  PositionLoanCommitted,
  | "borrowed"
  | "collIndex"
  | "deposit"
  | "interestRate"
  | "troveId"
>) {
  const contracts = getContracts();
  const { symbol } = contracts.collaterals[collIndex];
  const token = TOKENS_BY_SYMBOL[symbol];

  const collateralPriceUsd = usePrice(symbol);

  if (!collateralPriceUsd) {
    return null;
  }

  const ltv = getLtv(deposit, borrowed, collateralPriceUsd);
  const redemptionRisk = getRedemptionRisk(interestRate);

  const maxLtv = dn.from(1 / token.collateralRatio, 18);
  const liquidationRisk = ltv && getLiquidationRisk(ltv, maxLtv);

  return (
    <Link
      href={`/loan?id=${collIndex}:${troveId}`}
      legacyBehavior
      passHref
    >
      <StrongCard
        heading={[
          <div
            key="start"
            className={css({
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "strongSurfaceContent",
            })}
          >
            <div
              className={css({
                display: "flex",
                color: "brandGreen",
              })}
            >
              <IconLeverage size={16} />
            </div>
            Leverage loan
          </div>,
        ]}
        contextual={<EditSquare />}
        main={{
          value: (
            <HFlex gap={8} alignItems="center" justifyContent="flex-start">
              {deposit ? dn.format(deposit, 2) : "−"}
              <TokenIcon size={24} symbol={symbol} />
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
                      color: "strongSurfaceContentAlt",
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
                      {dn.format(dn.mul(ltv, 100), 2)}%
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
                  <div
                    className={css({
                      color: "strongSurfaceContent",
                    })}
                  >
                    {liquidationRisk === "low" ? "Low" : liquidationRisk === "medium" ? "Medium" : "High"}{" "}
                    liquidation risk
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
                    gap: 8,
                    fontSize: 14,
                  })}
                >
                  <div
                    className={css({
                      color: "strongSurfaceContentAlt",
                    })}
                  >
                    Interest rate
                  </div>
                  <div
                    className={css({
                      color: "strongSurfaceContent",
                    })}
                  >
                    {dn.format(dn.mul(interestRate, 100), 2)}%
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
                      color: "strongSurfaceContent",
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
