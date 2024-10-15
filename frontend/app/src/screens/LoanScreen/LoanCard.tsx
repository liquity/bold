import type { PositionLoan, TroveId } from "@/src/types";
import type { ReactNode } from "react";
import type { LoanLoadingState } from "./LoanScreen";

import { INFINITY } from "@/src/characters";
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
import { token } from "@/styled-system/tokens";
import { Button, HFlex, IconBorrow, IconLeverage, StatusDot, TokenIcon, TOKENS_BY_SYMBOL } from "@liquity2/uikit";
import { a, useSpring } from "@react-spring/web";
import * as dn from "dnum";
import { match, P } from "ts-pattern";

const LOAN_CARD_HEIGHT = 246;

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

  return (
    <LoadingCard
      leverage={leverageMode}
      troveId={troveId}
      loan={loan}
      loadingState={loadingState}
      onRetry={onRetry}
    >
      {loan
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
        )}
    </LoadingCard>
  );
}

function LoadingCard({
  children,
  leverage,
  loadingState,
  loan,
  onRetry,
  troveId,
}: {
  children: ReactNode;
  leverage: boolean;
  loadingState: LoanLoadingState;
  loan: PositionLoan | null;
  onRetry: () => void;
  troveId: TroveId;
}) {
  const title = leverage ? "Leverage loan" : "BOLD loan";
  const titleFull = loan && `${title}: ${troveId}`;

  const spring = useSpring({
    to: match(loadingState)
      .with(
        P.union(
          "loading",
          "error",
          "awaiting-confirmation",
          "not-found",
        ),
        (s) => ({
          cardtransform: "scale3d(0.95, 0.95, 1)",
          containerHeight: (
            window.innerHeight
            - 120 // top bar
            - 24 * 2 // padding
            - 48 // bottom bar 1
            - 40
            // - 40 // bottom bar 2
          ),
          cardHeight: s === "error" || s === "not-found" ? 180 : 120,
          cardBackground: token("colors.blue:50"),
          cardColor: token("colors.blue:950"),
        }),
      )
      .otherwise(() => ({
        cardtransform: "scale3d(1, 1, 1)",
        containerHeight: LOAN_CARD_HEIGHT,
        cardHeight: LOAN_CARD_HEIGHT,
        cardBackground: token("colors.blue:950"),
        cardColor: token("colors.white"),
      })),
    config: {
      mass: 1,
      tension: 2000,
      friction: 120,
    },
  });

  return (
    <a.div
      className={css({
        display: "flex",
        justifyContent: "center",
        flexDirection: "column",
      })}
      style={{
        height: spring.containerHeight,
      }}
    >
      <a.section
        className={css({
          overflow: "hidden",
          width: "100%",
          padding: "16px 16px 24px",
          borderRadius: 8,
          userSelect: "none",
        })}
        style={{
          height: loadingState === "success" ? LOAN_CARD_HEIGHT : spring.cardHeight,
          color: spring.cardColor,
          background: spring.cardBackground,
          transform: spring.cardtransform,
          willChange: "transform",
        }}
      >
        <h1
          title={titleFull ?? undefined}
          className={css({
            display: "flex",
            alignItems: "center",
            gap: 4,
            paddingBottom: 12,
          })}
          style={{
            opacity: Number(loadingState === "success"),
            pointerEvents: loadingState === "success" ? "auto" : "none",
          }}
        >
          <div
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
              {leverage
                ? <IconLeverage size={16} />
                : <IconBorrow size={16} />}
            </div>
            {title}
          </div>
        </h1>
        {match(loadingState)
          .with(P.union("loading", "awaiting-confirmation"), () => (
            <div
              className={css({
                position: "absolute",
                inset: 0,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 8,
                fontSize: 18,
              })}
            >
              Fetching loan
              <span title={`Loan ${troveId}`}>
                {shortenTroveId(troveId)}…
              </span>
              <Spinner size={18} />
            </div>
          ))
          .with("error", () => (
            <div
              className={css({
                position: "absolute",
                inset: 0,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                flexDirection: "column",
                gap: 16,
                fontSize: 18,
                padding: 16,
              })}
            >
              <div>
                Error fetching loan{" "}
                <span title={`Loan ${troveId}`}>
                  {shortenTroveId(troveId)}
                </span>.
              </div>
              <Button
                mode="primary"
                label="Try again"
                size="small"
                onClick={onRetry}
              />
            </div>
          ))
          .with("not-found", () => (
            <div
              className={css({
                position: "absolute",
                inset: 0,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                flexDirection: "column",
                gap: 16,
                fontSize: 18,
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
            </div>
          ))
          .otherwise(() => (
            <div>
              {children}
            </div>
          ))}
      </a.section>
    </a.div>
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
