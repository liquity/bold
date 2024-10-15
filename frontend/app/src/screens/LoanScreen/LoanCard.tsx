import type { PositionLoan, TroveId } from "@/src/types";
import type { ReactNode } from "react";
import type { LoanLoadingState } from "./LoanScreen";

import { INFINITY } from "@/src/characters";
import { ScreenCard } from "@/src/comps/Screen/ScreenCard";
import { Spinner } from "@/src/comps/Spinner/Spinner";
import { Value } from "@/src/comps/Value/Value";
import { formatRisk } from "@/src/formatting";
import { fmtnum } from "@/src/formatting";
import { getLoanDetails } from "@/src/liquity-math";
import { shortenTroveId } from "@/src/liquity-utils";
import { usePrice } from "@/src/services/Prices";
import { riskLevelToStatusMode } from "@/src/uikit-utils";
import { roundToDecimal } from "@/src/utils";
import { css } from "@/styled-system/css";
import {
  Button,
  HFlex,
  IconBorrow,
  IconLeverage,
  StatusDot,
  TokenIcon,
  TOKENS_BY_SYMBOL,
  VFlex,
} from "@liquity2/uikit";
import * as dn from "dnum";
import { match, P } from "ts-pattern";

export function LoanCard({
  leverageMode,
  loadingState,
  loan,
  onLeverageModeChange,
  onRetry,
  troveId,
}: {
  leverageMode: boolean;
  loadingState: LoanLoadingState;
  loan: PositionLoan | null;
  onLeverageModeChange: (leverageMode: boolean) => void;
  onRetry: () => void;
  troveId: TroveId;
}) {
  const collateral = loan && TOKENS_BY_SYMBOL[loan.collateral];
  const collPriceUsd = usePrice(collateral ? collateral.symbol : null);

  const loanDetails = loan && collateral && getLoanDetails(
    loan.deposit,
    loan.borrowed,
    loan.interestRate,
    collateral.collateralRatio,
    collPriceUsd,
  );

  const {
    ltv,
    depositPreLeverage,
    leverageFactor,
    redemptionRisk,
    liquidationRisk,
  } = loanDetails || {};

  const maxLtv = collateral && dn.div(
    dn.from(1, 18),
    collateral.collateralRatio,
  );

  const title = leverageMode ? "Leverage loan" : "BOLD loan";

  return (
    <ScreenCard
      heading={
        <div
          title={loan ? `${title}: ${troveId}` : undefined}
          className={css({
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "strongSurfaceContent",
            fontSize: 12,
            textTransform: "uppercase",
            userSelect: "none",
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
          {title}
        </div>
      }
      ready={loadingState === "success"}
    >
      {match(loadingState)
        .with(
          P.union(
            "loading",
            "awaiting-confirmation",
          ),
          () => (
            <HFlex gap={8}>
              Fetching loan
              <span title={`Loan ${troveId}`}>
                {shortenTroveId(troveId)}…
              </span>
              <Spinner size={18} />
            </HFlex>
          ),
        )
        .with("not-found", () => (
          <VFlex
            gap={16}
            className={css({
              padding: 16,
            })}
          >
            <div>
              Loan{" "}
              <span title={`Loan ${troveId}`}>
                {shortenTroveId(troveId)}
              </span>{" "}
              not found.
            </div>
            <Button
              mode="primary"
              label="Try again"
              size="small"
              onClick={onRetry}
            />
          </VFlex>
        ))
        .with("error", () => (
          <HFlex gap={8}>
            Error fetching loan{" "}
            <span title={`Loan ${troveId}`}>
              {shortenTroveId(troveId)}
            </span>.
            <Button
              mode="primary"
              label="Try again"
              size="small"
              onClick={onRetry}
            />
          </HFlex>
        ))
        .otherwise(() => (
          loan
          && loanDetails
          && collateral
          && typeof leverageFactor === "number"
          && depositPreLeverage
          && maxLtv
          && liquidationRisk
          && (
            <>
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
                        title={`${fmtnum(loan.deposit, "full")} ${collateral}`}
                        className={css({
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                        })}
                      >
                        <div>{fmtnum(loan.deposit)}</div>
                        <TokenIcon symbol={collateral.symbol} size={32} />
                        <div
                          className={css({
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                          })}
                        >
                          <div>
                            <Value
                              negative={loanDetails.status === "underwater" || loanDetails.status === "liquidatable"}
                              title={`Leverage factor: ${
                                loanDetails.status === "underwater" || leverageFactor === null
                                  ? INFINITY
                                  : `${roundToDecimal(leverageFactor, 3)}x`
                              }`}
                              className={css({
                                fontSize: 16,
                              })}
                            >
                              {loanDetails.status === "underwater" || leverageFactor === null
                                ? INFINITY
                                : `${roundToDecimal(leverageFactor, 1)}x`}
                            </Value>
                          </div>
                        </div>
                      </div>
                    )
                    : (
                      <div
                        title={`${fmtnum(loan.borrowed)} BOLD`}
                        className={css({
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                        })}
                      >
                        {fmtnum(loan.borrowed)}
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
                    <GridItem label="Net value">
                      <Value
                        negative={loanDetails.status === "underwater"}
                        title={`${fmtnum(depositPreLeverage)} ${collateral.name}`}
                      >
                        {fmtnum(depositPreLeverage)} {collateral.name}
                      </Value>
                    </GridItem>
                  )
                  : (
                    <GridItem label="Collateral">
                      <div title={`${fmtnum(loan.deposit, "full")} ${collateral.name}`}>
                        {fmtnum(loan.deposit)} {collateral.name}
                      </div>
                    </GridItem>
                  )}
                <GridItem label="Liq. price" title="Liquidation price">
                  <Value negative={ltv && dn.gt(ltv, maxLtv)}>
                    ${fmtnum(loanDetails.liquidationPrice)}
                  </Value>
                </GridItem>
                <GridItem label="Interest rate">
                  {fmtnum(loan.interestRate, 2, 100)}%
                </GridItem>
                <GridItem label="LTV" title="Loan-to-value ratio">
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
                    {fmtnum(ltv, "2z", 100)}%
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
            </>
          )
        ))}
    </ScreenCard>
  );
}

function GridItem({
  children,
  label,
  title,
}: {
  children: ReactNode;
  label: string;
  title?: string;
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
        title={title}
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
