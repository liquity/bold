import type { PositionLoan, TroveId } from "@/src/types";
import type { ReactNode } from "react";

import { ACCOUNT_POSITIONS } from "@/src/demo-mode";
import { DEMO_MODE } from "@/src/env";
import { getLiquidationRisk, getRedemptionRisk } from "@/src/liquity-math";
import { usePrice } from "@/src/prices";
import { riskLevelToStatusMode } from "@/src/uikit-utils";
import { css } from "@/styled-system/css";
import { Button, HFlex, IconBorrow, StatusDot, TokenIcon, TOKENS_BY_SYMBOL } from "@liquity2/uikit";
import * as dn from "dnum";

export function Position({
  troveId,
}: {
  troveId: TroveId;
}) {
  const position = DEMO_MODE && ACCOUNT_POSITIONS.find((position) => (
    position.type === "loan" && position.troveId === troveId
  )) as PositionLoan | undefined;

  const token = position && TOKENS_BY_SYMBOL[position.collateral];

  const collPriceUsd = usePrice(token ? token.symbol : null);

  if (!position || !collPriceUsd || !token) {
    return null;
  }

  const { deposit, borrowed, interestRate } = position;
  const ltv = dn.div(borrowed, dn.mul(deposit, collPriceUsd));
  const redemptionRisk = getRedemptionRisk(interestRate);

  const maxLtv = dn.from(1 / token.collateralRatio, 18);
  const liquidationRisk = getLiquidationRisk(ltv, maxLtv);

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
              color: "strongSurfaceContentAlt",
            })}
          >
            <IconBorrow size={16} />
          </div>
          BOLD loan
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
          <div>
            {dn.format(position.borrowed, {
              digits: 2,
            })}
          </div>
          <TokenIcon symbol="BOLD" size={32} />
        </div>
        <div>
          <Button label="Show details" mode="primary" size="small" />
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
        <GridItem label="Collateral">
          {dn.format(position.deposit, 2)} {TOKENS_BY_SYMBOL[position.collateral].name}
        </GridItem>
        <GridItem label="Liq. price">
          $2,208.5
        </GridItem>
        <GridItem label="Interest rate">
          {dn.format(dn.mul(position.interestRate, 100), 2)}%
        </GridItem>
        <GridItem label="LTV">
          {dn.format(dn.mul(ltv, 100), 2)}%
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
