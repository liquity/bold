import type { PositionLoan, TroveId } from "@/src/types";
import type { ReactNode } from "react";

import { ACCOUNT_POSITIONS } from "@/src/demo-mode";
import { DEMO_MODE } from "@/src/env";
import { formatRisk } from "@/src/formatting";
import { fmtnum } from "@/src/formatting";
import { getLoanDetails } from "@/src/liquity-math";
import { usePrice } from "@/src/services/Prices";
import { riskLevelToStatusMode } from "@/src/uikit-utils";
import { roundToDecimal } from "@/src/utils";
import { css } from "@/styled-system/css";
import { Button, HFlex, IconBorrow, IconLeverage, StatusDot, TokenIcon, TOKENS_BY_SYMBOL } from "@liquity2/uikit";
import * as dn from "dnum";

export function Position({
  troveId,
  leverageMode,
  onLeverageModeChange,
}: {
  troveId: TroveId;
  leverageMode: boolean;
  onLeverageModeChange: (leverageMode: boolean) => void;
}) {
  const position = (
    DEMO_MODE
      ? ACCOUNT_POSITIONS.find((position) => (
        (position.type === "borrow" || position.type === "leverage") && position.troveId === troveId
      ))
      : undefined
  ) as PositionLoan | undefined;

  const collateral = position && TOKENS_BY_SYMBOL[position.collateral];

  const collPriceUsd = usePrice(collateral ? collateral.symbol : null);

  if (!position || !collPriceUsd || !collateral) {
    return null;
  }

  const { deposit, borrowed, interestRate } = position;

  const loanDetails = getLoanDetails(
    deposit,
    borrowed,
    interestRate,
    collateral.collateralRatio,
    collPriceUsd,
  );

  const {
    ltv,
    leverageFactor,
    redemptionRisk,
    liquidationRisk,
  } = loanDetails;

  const maxLtv = dn.div(dn.from(1, 18), collateral.collateralRatio);

  return (
    <section
      className={css({
        padding: "16px 16px 24px",
        color: "strongSurfaceContent",
        background: "strongSurface",
        borderRadius: 8,
      })}
    >
      <h1
        className={css({
          display: "flex",
          alignItems: "center",
          gap: 4,
          paddingBottom: 12,
          color: "strongSurfaceContentAlt",
        })}
      >
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "strongSurfaceContent",
            fontSize: 12,
            textTransform: "uppercase",
          })}
        >
          <div
            className={css({
              display: "flex",
              color: "strongSurfaceContentAlt2",
            })}
          >
            {leverageMode
              ? <IconLeverage size={16} />
              : <IconBorrow size={16} />}
          </div>
          {leverageMode ? "Leverage loan" : "BOLD loan"}
        </div>
      </h1>
      <div
        className={css({
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        })}
      >
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            fontSize: 40,
            lineHeight: 1,
            gap: 12,
          })}
        >
          {leverageMode
            ? (
              <div
                title={`${fmtnum(position.deposit, "full")} ${position.collateral}`}
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                })}
              >
                <div>{fmtnum(position.deposit)}</div>
                <TokenIcon symbol={position.collateral} size={32} />
                <div
                  className={css({
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  })}
                >
                  <div
                    title={`Leverage factor: ${
                      loanDetails.isLiquidatable || leverageFactor === null
                        ? "∞"
                        : `${roundToDecimal(leverageFactor, 3)}x`
                    }`}
                    className={css({
                      fontSize: 16,
                    })}
                  >
                    <div
                      style={{
                        color: ltv && dn.lt(ltv, maxLtv) ? "inherit" : "var(--colors-negative)",
                      }}
                    >
                      {loanDetails.isLiquidatable || leverageFactor === null
                        ? "∞"
                        : `${roundToDecimal(leverageFactor, 1)}x`}
                    </div>
                  </div>
                  {
                    /*<div
                    className={css({
                      fontSize: 16,
                    })}
                  >
                    ${fmtnum(dn.mul(position.deposit, collPriceUsd), { digits: 2 })}
                  </div>*/
                  }
                </div>
              </div>
            )
            : (
              <div
                title={`${fmtnum(position.borrowed)} BOLD`}
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                })}
              >
                {fmtnum(position.borrowed)}
                <TokenIcon symbol="BOLD" size={32} />
              </div>
            )}
        </div>
        <div>
          <Button
            label={leverageMode ? "View as loan" : "View as leverage"}
            mode="primary"
            size="small"
            onClick={() => {
              onLeverageModeChange(!leverageMode);
            }}
          />
        </div>
      </div>

      <div
        className={css({
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
          paddingTop: 32,
        })}
      >
        {leverageMode
          ? (
            <GridItem label="Debt">
              {fmtnum(position.borrowed)} BOLD
            </GridItem>
          )
          : (
            <GridItem label="Collateral">
              <div title={`${fmtnum(position.deposit, "full")} ${TOKENS_BY_SYMBOL[position.collateral].name}`}>
                {fmtnum(position.deposit)} {TOKENS_BY_SYMBOL[position.collateral].name}
              </div>
            </GridItem>
          )}
        <GridItem label="Liq. price">
          <div
            className={css({
              "--color-negative": "token(colors.negative)",
            })}
            style={{
              color: ltv && dn.gt(ltv, maxLtv) ? "var(--color-negative)" : "inherit",
            }}
          >
            ${fmtnum(loanDetails.liquidationPrice)}
          </div>
        </GridItem>
        <GridItem label="Interest rate">
          {fmtnum(dn.mul(position.interestRate, 100))}%
        </GridItem>
        <GridItem label="LTV">
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
            {ltv && fmtnum(dn.mul(ltv, 100))}%
          </div>
        </GridItem>
        <GridItem label="Liquidation risk">
          <HFlex gap={8} alignItems="center" justifyContent="flex-start">
            <StatusDot
              mode={riskLevelToStatusMode(liquidationRisk)}
              size={8}
            />
            {formatRisk(liquidationRisk)}
          </HFlex>
        </GridItem>
        {redemptionRisk && (
          <GridItem label="Redemption risk">
            <HFlex gap={8} alignItems="center" justifyContent="flex-start">
              <StatusDot
                mode={riskLevelToStatusMode(redemptionRisk)}
                size={8}
              />
              {formatRisk(redemptionRisk)}
            </HFlex>
          </GridItem>
        )}
      </div>
    </section>
  );
}

function GridItem({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: 4,
        fontSize: 14,
      })}
    >
      <div
        className={css({
          color: "strongSurfaceContentAlt",
        })}
      >
        {label}
      </div>
      <div
        className={css({
          color: "strongSurfaceContent",
        })}
      >
        {children}
      </div>
    </div>
  );
}
