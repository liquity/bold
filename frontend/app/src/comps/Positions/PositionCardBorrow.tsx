import type { PositionLoan } from "@/src/types";

import { formatLiquidationRisk } from "@/src/formatting";
import { fmtnum } from "@/src/formatting";
import { getLiquidationRisk, getLtv, getRedemptionRisk } from "@/src/liquity-math";
import { usePrice } from "@/src/services/Prices";
import { riskLevelToStatusMode } from "@/src/uikit-utils";
import { css } from "@/styled-system/css";
import { HFlex, IconBorrow, StatusDot, StrongCard, TokenIcon, TOKENS_BY_SYMBOL } from "@liquity2/uikit";
import * as dn from "dnum";
import Link from "next/link";
import { CardRow, CardRows, EditSquare } from "./shared";

export function PositionCardBorrow({
  borrowed,
  collIndex,
  collateral,
  deposit,
  interestRate,
  troveId,
}: Pick<
  PositionLoan,
  | "borrowed"
  | "collIndex"
  | "collateral"
  | "deposit"
  | "interestRate"
  | "troveId"
>) {
  const token = TOKENS_BY_SYMBOL[collateral];
  const collateralPriceUsd = usePrice(token.symbol);

  if (!collateralPriceUsd) {
    return null;
  }

  const ltv = getLtv(deposit, borrowed, collateralPriceUsd);
  const redemptionRisk = getRedemptionRisk(interestRate);

  const maxLtv = dn.from(1 / token.collateralRatio, 18);
  const liquidationRisk = ltv && getLiquidationRisk(ltv, maxLtv);

  const title = [
    `Loan ID: ${troveId}`,
    `Borrowed: ${fmtnum(borrowed, "full")} BOLD`,
    `Collateral: ${fmtnum(deposit, "full")} ${token.name}`,
    `Interest rate: ${fmtnum(interestRate, "full", 100)}%`,
  ];

  return (
    <Link
      href={`/loan?id=${collIndex}:${troveId}`}
      legacyBehavior
      passHref
    >
      <StrongCard
        title={title.join("\n")}
        heading={
          <div
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
                color: "strongSurfaceContentAlt2",
              })}
            >
              <IconBorrow size={16} />
            </div>
            BOLD loan
          </div>
        }
        contextual={<EditSquare />}
        main={{
          value: (
            <HFlex gap={8} alignItems="center" justifyContent="flex-start">
              {fmtnum(borrowed)}
              <TokenIcon
                size={24}
                symbol="BOLD"
              />
            </HFlex>
          ),
          // label: "Total debt",
          label: (
            <div
              className={css({
                display: "flex",
                gap: 8,
                alignItems: "cente",
              })}
            >
              Backed by {deposit ? dn.format(deposit, 2) : "−"} {token.name}
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
                    {formatLiquidationRisk(liquidationRisk)}
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
                    {redemptionRisk === "low" ? "Low" : redemptionRisk === "medium" ? "Medium" : "High"} redemption risk
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