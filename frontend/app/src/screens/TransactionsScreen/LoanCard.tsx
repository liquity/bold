import type { PositionLoan } from "@/src/types";
import type { ReactNode } from "react";
import type { LoadingState } from "./TransactionsScreen";

import { INFINITY } from "@/src/characters";
import { Spinner } from "@/src/comps/Spinner/Spinner";
import { TagPreview } from "@/src/comps/TagPreview/TagPreview";
import { Value } from "@/src/comps/Value/Value";
import { formatRisk } from "@/src/formatting";
import { fmtnum } from "@/src/formatting";
import { getLoanDetails } from "@/src/liquity-math";
import { getCollToken } from "@/src/liquity-utils";
import { usePrice } from "@/src/services/Prices";
import { riskLevelToStatusMode } from "@/src/uikit-utils";
import { roundToDecimal } from "@/src/utils";
import { css } from "@/styled-system/css";
import { token } from "@/styled-system/tokens";
import {
  Button,
  HFlex,
  IconBorrow,
  IconLeverage,
  StatusDot,
  TokenIcon,
} from "@liquity2/uikit";
import { a, useSpring } from "@react-spring/web";
import * as dn from "dnum";
import { match, P } from "ts-pattern";

const LOAN_CARD_HEIGHT = 246 - 16;
const LOAN_CARD_HEIGHT_REDUCED = 176;

export function LoanCard({
  leverageMode,
  loadingState,
  loan,
  onRetry,
  prevLoan,
  txPreviewMode = false,
}: {
  leverageMode: boolean;
  loadingState: LoadingState;
  loan: PositionLoan | null;
  onRetry: () => void;
  prevLoan?: PositionLoan | null;
  txPreviewMode?: boolean;
}) {
  const collToken = getCollToken(
    loan?.collIndex ?? prevLoan?.collIndex ?? null
  );

  if (!collToken) {
    return null;
  }

  const collPriceUsd = usePrice(collToken.symbol);

  const isLoanClosing = prevLoan && !loan;

  const loanDetails =
    loan &&
    getLoanDetails(
      loan.deposit,
      loan.borrowed,
      loan.interestRate,
      collToken.collateralRatio,
      collPriceUsd
    );

  const prevLoanDetails =
    prevLoan &&
    getLoanDetails(
      prevLoan.deposit,
      prevLoan.borrowed,
      prevLoan.interestRate,
      collToken.collateralRatio,
      collPriceUsd
    );

  const {
    ltv,
    depositPreLeverage,
    leverageFactor,
    redemptionRisk,
    liquidationRisk,
  } = loanDetails || {};

  const maxLtv = dn.div(dn.from(1, 18), collToken.collateralRatio);

  return (
    <LoadingCard
      height={isLoanClosing ? LOAN_CARD_HEIGHT_REDUCED : LOAN_CARD_HEIGHT}
      leverage={leverageMode}
      loadingState={loadingState}
      onRetry={onRetry}
      txPreviewMode={txPreviewMode}
    >
      {isLoanClosing ? (
        <>
          <TotalDebt
            positive
            loan={{
              ...prevLoan,
              deposit: dn.from(0, 18),
              borrowed: dn.from(0, 18),
            }}
            prevLoan={prevLoan}
          />
          <div
            className={css({
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
              paddingTop: 32,
            })}
          >
            <GridItem label='Collateral'>
              <div
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                })}
              >
                <div
                  style={{
                    color: "var(--colors-positive-alt)",
                  }}
                >
                  {fmtnum(0)} {collToken.name}
                </div>
                {prevLoan && (
                  <div
                    title={`${fmtnum(prevLoan.deposit, "full")} ${
                      collToken.name
                    }`}
                    className={css({
                      color: "contentAlt",
                      textDecoration: "line-through",
                    })}
                  >
                    {fmtnum(prevLoan.deposit)} {collToken.name}
                  </div>
                )}
              </div>
            </GridItem>
          </div>
        </>
      ) : (
        loan &&
        loanDetails &&
        typeof leverageFactor === "number" &&
        depositPreLeverage &&
        maxLtv &&
        liquidationRisk && (
          <>
            {leverageMode ? (
              <LeveragedExposure
                loan={loan}
                loanDetails={loanDetails}
                prevLoanDetails={prevLoanDetails ?? null}
              />
            ) : (
              <TotalDebt loan={loan} prevLoan={prevLoan} />
            )}
            <div
              className={css({
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 12,
                paddingTop: 32,
              })}
            >
              {leverageMode ? (
                <GridItem label='Net value'>
                  <div
                    className={css({
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    })}
                  >
                    <Value
                      negative={loanDetails.status === "underwater"}
                      title={`${fmtnum(depositPreLeverage, "full")} ${
                        collToken.name
                      }`}
                    >
                      {fmtnum(depositPreLeverage)} {collToken.name}
                    </Value>
                    {prevLoanDetails?.depositPreLeverage &&
                      !dn.eq(
                        prevLoanDetails.depositPreLeverage,
                        depositPreLeverage
                      ) && (
                        <div
                          title={`${fmtnum(
                            prevLoanDetails.depositPreLeverage,
                            "full"
                          )} ${collToken.name}`}
                          className={css({
                            color: "contentAlt",
                            textDecoration: "line-through",
                          })}
                        >
                          {fmtnum(prevLoanDetails.depositPreLeverage)}{" "}
                          {collToken.name}
                        </div>
                      )}
                  </div>
                </GridItem>
              ) : (
                <GridItem label='Collateral'>
                  <div
                    className={css({
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    })}
                  >
                    <div
                      title={`${fmtnum(loan.deposit, "full")} ${
                        collToken.name
                      }`}
                    >
                      {fmtnum(loan.deposit)} {collToken.name}
                    </div>
                    {prevLoan && !dn.eq(prevLoan.deposit, loan.deposit) && (
                      <div
                        title={`${fmtnum(prevLoan.deposit, "full")} ${
                          collToken.name
                        }`}
                        className={css({
                          color: "contentAlt",
                          textDecoration: "line-through",
                        })}
                      >
                        {fmtnum(prevLoan.deposit)} {collToken.name}
                      </div>
                    )}
                  </div>
                </GridItem>
              )}
              <GridItem label='Liq. price' title='Liquidation price'>
                <div
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  })}
                >
                  <Value negative={ltv && dn.gt(ltv, maxLtv)}>
                    ${fmtnum(loanDetails.liquidationPrice)}
                  </Value>
                  {loanDetails?.liquidationPrice &&
                    prevLoanDetails?.liquidationPrice &&
                    !dn.eq(
                      prevLoanDetails.liquidationPrice,
                      loanDetails.liquidationPrice
                    ) && (
                      <div
                        className={css({
                          color: "contentAlt",
                          textDecoration: "line-through",
                        })}
                      >
                        ${fmtnum(prevLoanDetails.liquidationPrice)}
                      </div>
                    )}
                </div>
              </GridItem>
              <GridItem label='Interest rate'>
                <div
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  })}
                >
                  <div>{fmtnum(dn.mul(loan.interestRate, 100))}%</div>
                  {loan.batchManager && (
                    <div
                      title={`Interest rate delegate: ${loan.batchManager}`}
                      className={css({
                        display: "flex",
                        alignItems: "center",
                        height: 16,
                        padding: "0 6px",
                        fontSize: 10,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        color: "content",
                        background: "brandCyan",
                        borderRadius: 20,
                      })}
                    >
                      delegated
                    </div>
                  )}
                  {prevLoan &&
                    !dn.eq(prevLoan.interestRate, loan.interestRate) && (
                      <div
                        className={css({
                          color: "contentAlt",
                          textDecoration: "line-through",
                        })}
                      >
                        {fmtnum(dn.mul(prevLoan.interestRate, 100))}%
                      </div>
                    )}
                </div>
              </GridItem>
              <GridItem label='LTV' title='Loan-to-value ratio'>
                <div
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  })}
                >
                  <div
                    className={css({
                      "--status-positive": "token(colors.positiveAlt)",
                      "--status-warning": "token(colors.warning)",
                      "--status-negative": "token(colors.negative)",
                    })}
                    style={{
                      color:
                        liquidationRisk === "low"
                          ? "var(--status-positive)"
                          : liquidationRisk === "medium"
                          ? "var(--status-warning)"
                          : "var(--status-negative)",
                    }}
                  >
                    {ltv && fmtnum(dn.mul(ltv, 100))}%
                  </div>
                  {ltv &&
                    prevLoanDetails?.ltv &&
                    !dn.eq(prevLoanDetails.ltv, ltv) && (
                      <div
                        className={css({
                          color: "contentAlt",
                          textDecoration: "line-through",
                        })}
                      >
                        {prevLoanDetails.ltv &&
                          fmtnum(dn.mul(prevLoanDetails.ltv, 100))}
                        %
                      </div>
                    )}
                </div>
              </GridItem>
              <GridItem label='Liquidation risk'>
                <HFlex gap={8} alignItems='center' justifyContent='flex-start'>
                  <StatusDot
                    mode={riskLevelToStatusMode(liquidationRisk)}
                    size={8}
                  />
                  {formatRisk(liquidationRisk)}
                  {prevLoanDetails &&
                    liquidationRisk !== prevLoanDetails.liquidationRisk && (
                      <>
                        <StatusDot
                          mode={riskLevelToStatusMode(
                            prevLoanDetails.liquidationRisk
                          )}
                          size={8}
                        />
                        <div
                          className={css({
                            color: "contentAlt",
                            textDecoration: "line-through",
                          })}
                        >
                          {formatRisk(prevLoanDetails.liquidationRisk)}
                        </div>
                      </>
                    )}
                </HFlex>
              </GridItem>
              {redemptionRisk && (
                <GridItem label='Redemption risk'>
                  <HFlex
                    gap={8}
                    alignItems='center'
                    justifyContent='flex-start'
                  >
                    <StatusDot
                      mode={riskLevelToStatusMode(redemptionRisk)}
                      size={8}
                    />
                    {formatRisk(redemptionRisk)}
                    {prevLoanDetails &&
                      redemptionRisk !== prevLoanDetails.redemptionRisk && (
                        <>
                          <StatusDot
                            mode={riskLevelToStatusMode(
                              prevLoanDetails.redemptionRisk
                            )}
                            size={8}
                          />
                          <div
                            className={css({
                              color: "contentAlt",
                              textDecoration: "line-through",
                            })}
                          >
                            {formatRisk(prevLoanDetails.redemptionRisk)}
                          </div>
                        </>
                      )}
                  </HFlex>
                </GridItem>
              )}
            </div>
          </>
        )
      )}
    </LoadingCard>
  );
}

function TotalDebt({
  positive,
  loan,
  prevLoan,
}: {
  positive?: boolean;
  loan: PositionLoan;
  prevLoan?: PositionLoan | null;
}) {
  return (
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
          fontSize: 28,
          lineHeight: 1,
          gap: 12,
        })}
      >
        <div
          title={`${fmtnum(loan.borrowed, "full")} USDN`}
          className={css({
            display: "flex",
            alignItems: "center",
            gap: 12,
          })}
        >
          <div
            style={{
              color: positive ? "var(--colors-positive-alt)" : undefined,
            }}
          >
            {fmtnum(loan.borrowed)}
          </div>
          <TokenIcon symbol='USDN' size={32} />
          {prevLoan && !dn.eq(prevLoan.borrowed, loan.borrowed) && (
            <div
              title={`${fmtnum(prevLoan.borrowed, "full")} USDN`}
              className={css({
                color: "contentAlt",
                textDecoration: "line-through",
              })}
            >
              {fmtnum(prevLoan.borrowed)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LeveragedExposure({
  loan,
  loanDetails,
  prevLoanDetails,
}: {
  loan: PositionLoan;
  loanDetails: ReturnType<typeof getLoanDetails>;
  prevLoanDetails: null | ReturnType<typeof getLoanDetails>;
}) {
  const collToken = getCollToken(loan.collIndex);
  if (!collToken) {
    return null;
  }
  return (
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
          fontSize: 28,
          lineHeight: 1,
          gap: 12,
        })}
      >
        <div
          title={`${fmtnum(loan.deposit, "full")} ${collToken.name}`}
          className={css({
            display: "flex",
            alignItems: "center",
            gap: 12,
          })}
        >
          <div>{fmtnum(loan.deposit)}</div>
          <TokenIcon symbol={collToken.symbol} size={32} />
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 16,
            })}
          >
            <Value
              negative={
                loanDetails.status === "underwater" ||
                loanDetails.status === "liquidatable"
              }
              title={`Leverage factor: ${
                loanDetails.status === "underwater" ||
                loanDetails.leverageFactor === null
                  ? INFINITY
                  : `${roundToDecimal(loanDetails.leverageFactor, 3)}x`
              }`}
              className={css({
                fontSize: 16,
              })}
            >
              {loanDetails.status === "underwater" ||
              loanDetails.leverageFactor === null
                ? INFINITY
                : `${roundToDecimal(loanDetails.leverageFactor, 1)}x`}
            </Value>
            {prevLoanDetails &&
              prevLoanDetails.leverageFactor !== loanDetails.leverageFactor && (
                <div
                  className={css({
                    color: "contentAlt",
                    textDecoration: "line-through",
                  })}
                >
                  {prevLoanDetails.leverageFactor === null
                    ? INFINITY
                    : `${roundToDecimal(prevLoanDetails.leverageFactor, 1)}x`}
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingCard({
  children,
  height,
  leverage,
  loadingState,
  onRetry,
  txPreviewMode,
}: {
  children: ReactNode;
  height: number;
  leverage: boolean;
  loadingState: LoadingState;
  onRetry: () => void;
  txPreviewMode?: boolean;
}) {
  const title = leverage ? "Leverage loan" : "USDN loan";

  const spring = useSpring({
    to: match(loadingState)
      .with(P.union("loading", "error", "not-found"), (s) => ({
        cardtransform: "scale3d(0.95, 0.95, 1)",
        containerHeight:
          window.innerHeight -
          120 - // top bar
          24 * 2 - // padding
          48 - // bottom bar 1
          40,
          // - 40 // bottom bar 2
        cardHeight: s === "error" || s === "not-found" ? 180 : 120,
        cardBackground: token("colors.blue:50"),
        cardColor: token("colors.blue:950"),
      }))
      .otherwise(() => ({
        cardtransform: "scale3d(1, 1, 1)",
        containerHeight: height,
        cardHeight: height,
        cardBackground: token("colors.position"),
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
        width: "100%",
      })}
      style={{
        height: spring.containerHeight,
      }}
    >
      <a.section
        className={css({
          overflow: "hidden",
          width: "100%",
          padding: "16px 16px 0",
          borderRadius: 8,
          userSelect: "none",
        })}
        style={{
          height: loadingState === "success" ? height : spring.cardHeight,
          color: spring.cardColor,
          background: spring.cardBackground,
          transform: spring.cardtransform,
          willChange: "transform",
        }}
      >
        {txPreviewMode && loadingState === "success" && <TagPreview />}
        <h1
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
              {leverage ? (
                <div
                  className={css({
                    display: "flex",
                    color: "brandGreen",
                  })}
                >
                  <IconLeverage size={16} />
                </div>
              ) : (
                <IconBorrow size={16} />
              )}
            </div>
            {title}
          </div>
        </h1>
        {match(loadingState)
          .with("loading", () => (
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
              Fetching
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
              <div>Error fetching data</div>
              <Button
                mode='primary'
                label='Try again'
                size='small'
                onClick={onRetry}
              />
            </div>
          ))
          .otherwise(() => (
            <div>{children}</div>
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
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        })}
      >
        {children}
      </div>
    </div>
  );
}
