import type { PositionLoan, TroveId } from "@/src/types";
import type { ReactNode } from "react";

import { ACCOUNT_POSITIONS } from "@/src/demo-mode";
import { DEMO_MODE } from "@/src/env";
import {
  // getLeverageFactorFromLtv,
  // getLiquidationRisk,
  getLoanDetails,
  // getLtv,
  // getRedemptionRisk,
} from "@/src/liquity-math";
import { usePrice } from "@/src/services/Prices";
import { riskLevelToStatusMode } from "@/src/uikit-utils";
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

  const token = position && TOKENS_BY_SYMBOL[position.collateral];

  const collPriceUsd = usePrice(token ? token.symbol : null);

  if (!position || !collPriceUsd || !token) {
    return null;
  }

  const { deposit, borrowed, interestRate } = position;

  const loanDetails = getLoanDetails(
    deposit,
    borrowed,
    interestRate,
    token.collateralRatio,
    collPriceUsd,
  );

  const {
    ltv,
    leverageFactor,
    redemptionRisk,
    depositPreLeverage,
    liquidationRisk,
  } = loanDetails;

  const leveragePercentage = leverageFactor === null ? null : dn.mul(dn.sub(leverageFactor, dn.from(1, 18)), 100);

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
          title={`${dn.format(position.borrowed)} BOLD`}
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
              <>
                <div>{dn.format(position.deposit, { digits: 2 })}</div>
                <TokenIcon symbol={position.collateral} size={32} />
                {leveragePercentage && (
                  <div
                    className={css({
                      fontSize: 16,
                      color: "positiveAlt",
                    })}
                  >
                    +{dn.format(leveragePercentage)}%
                  </div>
                )}
              </>
            )
            : (
              <>
                <div>
                  {dn.format(position.borrowed, { digits: 2 })}
                </div>
                <TokenIcon symbol="BOLD" size={32} />
              </>
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
            <GridItem label="Deposit">
              {depositPreLeverage && dn.format(depositPreLeverage, 2)} {TOKENS_BY_SYMBOL[position.collateral].name}
            </GridItem>
          )
          : (
            <GridItem label="Collateral">
              {position.deposit && dn.format(position.deposit, 2)} {TOKENS_BY_SYMBOL[position.collateral].name}
            </GridItem>
          )}
        <GridItem label="Liq. price">
          {loanDetails.liquidationPrice && `$${dn.format(loanDetails.liquidationPrice, 2)}`}
        </GridItem>
        <GridItem label="Interest rate">
          {dn.format(dn.mul(position.interestRate, 100), 2)}%
        </GridItem>
        <GridItem label="LTV">
          {ltv && dn.format(dn.mul(ltv, 100), 2)}%
        </GridItem>
        <GridItem label="Liquidation risk">
          <HFlex gap={8} alignItems="center" justifyContent="flex-start">
            <StatusDot
              mode={riskLevelToStatusMode(liquidationRisk)}
              size={8}
            />
            {liquidationRisk === "low" ? "Low" : liquidationRisk === "medium" ? "Medium" : "High"}
          </HFlex>
        </GridItem>
        {redemptionRisk && (
          <GridItem label="Redemption risk">
            <HFlex gap={8} alignItems="center" justifyContent="flex-start">
              <StatusDot
                mode={riskLevelToStatusMode(redemptionRisk)}
                size={8}
              />
              {redemptionRisk === "low" ? "Low" : redemptionRisk === "medium" ? "Medium" : "High"}
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
