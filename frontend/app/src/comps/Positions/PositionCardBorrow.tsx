import type { PositionLoanCommitted } from "@/src/types";

import { formatLiquidationRisk } from "@/src/formatting";
import { fmtnum } from "@/src/formatting";
import { getLiquidationRisk, getLtv, getRedemptionRisk } from "@/src/liquity-math";
import { getCollToken, shortenTroveId } from "@/src/liquity-utils";
import { usePrice } from "@/src/services/Prices";
import { riskLevelToStatusMode } from "@/src/uikit-utils";
import { css } from "@/styled-system/css";
import { HFlex, IconBorrow, StatusDot, StrongCard, TokenIcon } from "@liquity2/uikit";
import * as dn from "dnum";
import Link from "next/link";
import { CardRow, CardRows, EditSquare } from "./shared";

export function PositionCardBorrow({
  batchManager,
  borrowed,
  collIndex,
  deposit,
  interestRate,
  troveId,
}: Pick<
  PositionLoanCommitted,
  | "batchManager"
  | "borrowed"
  | "collIndex"
  | "deposit"
  | "interestRate"
  | "troveId"
>) {
  const token = getCollToken(collIndex);
  const collateralPriceUsd = usePrice(token?.symbol ?? null);

  const ltv = collateralPriceUsd && getLtv(deposit, borrowed, collateralPriceUsd);
  const redemptionRisk = getRedemptionRisk(interestRate);

  const maxLtv = token && dn.from(1 / token.collateralRatio, 18);
  const liquidationRisk = ltv && maxLtv && getLiquidationRisk(ltv, maxLtv);

  const title = token
    ? [
      `Loan ID: ${shortenTroveId(troveId)}…`,
      `Borrowed: ${fmtnum(borrowed, "full")} BOLD`,
      `Collateral: ${fmtnum(deposit, "full")} ${token.name}`,
      `Interest rate: ${fmtnum(interestRate, "full", 100)}%`,
    ]
    : [];

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
                color: "white",
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
          label: token && (
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
                    alignItems: "center",
                    gap: 8,
                    fontSize: 14,
                  })}
                >
                  <div
                    className={css({
                      color: "strongSurfaceContentAlt",
                    })}
                  >
                    {batchManager ? "Int. rate" : "Interest rate"}
                  </div>
                  <div
                    className={css({
                      color: "strongSurfaceContent",
                    })}
                  >
                    {dn.format(dn.mul(interestRate, 100), 2)}%
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
                    gridTemplateColumns: "auto auto",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 14,
                  })}
                >
                  <div
                    className={css({
                      flexShrink: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
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
