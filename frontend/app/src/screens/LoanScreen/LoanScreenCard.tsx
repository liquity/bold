import type { Dnum, LoanDetails, PositionLoan, TroveId } from "@/src/types";
import type { CollateralToken } from "@liquity2/uikit";
import type { ReactNode } from "react";
import type { LoanLoadingState } from "./LoanScreen";

import { INFINITY } from "@/src/characters";
import { ScreenCard } from "@/src/comps/Screen/ScreenCard";
import { Value } from "@/src/comps/Value/Value";
import { CHAIN_BLOCK_EXPLORER } from "@/src/env";
import { formatRisk } from "@/src/formatting";
import { fmtnum } from "@/src/formatting";
import { getLoanDetails } from "@/src/liquity-math";
import { getCollToken, shortenTroveId, useTroveNftUrl } from "@/src/liquity-utils";
import { usePrice } from "@/src/services/Prices";
import { riskLevelToStatusMode } from "@/src/uikit-utils";
import { roundToDecimal } from "@/src/utils";
import { css } from "@/styled-system/css";
import {
  Button,
  Dropdown,
  HFlex,
  IconBorrow,
  IconCopy,
  IconEllipsis,
  IconExternal,
  IconLeverage,
  IconNft,
  shortenAddress,
  StatusDot,
  TokenIcon,
  VFlex,
} from "@liquity2/uikit";
import { a, useTransition } from "@react-spring/web";
import { blo } from "blo";
import * as dn from "dnum";
import Image from "next/image";
import { useEffect, useState } from "react";
import { match, P } from "ts-pattern";

type LoanMode = "borrow" | "leverage";

export function LoanScreenCard({
  onLeverageModeChange,
  mode,
  loadingState,
  loan,
  onRetry,
  troveId,
}: {
  mode: LoanMode;
  loadingState: LoanLoadingState;
  loan: PositionLoan | null;
  onLeverageModeChange: (mode: LoanMode) => void;
  onRetry: () => void;
  troveId: TroveId;
}) {
  const collateral = getCollToken(loan?.collIndex ?? null);
  const collPriceUsd = usePrice(collateral?.symbol ?? null);

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

  const nftUrl = useTroveNftUrl(loan?.collIndex ?? null, troveId);
  const title = mode === "leverage" ? "Leverage loan" : "BOLD loan";

  return (
    <ScreenCard
      mode={match(loadingState)
        .returnType<"ready" | "loading" | "error">()
        .with(P.union("loading", "awaiting-confirmation"), () => "loading")
        .with(P.union("error", "not-found"), () => "error")
        .otherwise(() => "ready")}
    >
      {match(loadingState)
        .with(
          P.union("loading", "awaiting-confirmation"),
          () => (
            <div
              className={css({
                display: "grid",
                placeItems: "center",
                height: "100%",
              })}
            >
              <div
                className={css({
                  position: "absolute",
                  top: 16,
                  left: 16,
                })}
              >
                <LoanCardHeading
                  inheritColor={true}
                  mode={mode}
                  title={title}
                  titleFull={`${title}: ${troveId}`}
                />
              </div>
              <HFlex gap={8}>
                Fetching loan
                <span title={`Loan ${troveId}`}>
                  {shortenTroveId(troveId)}
                </span>
              </HFlex>
            </div>
          ),
        )
        .with("not-found", () => (
          <div
            className={css({
              display: "grid",
              placeItems: "center",
              height: "100%",
            })}
          >
            <div
              className={css({
                position: "absolute",
                top: 16,
                left: 16,
              })}
            >
              <LoanCardHeading
                inheritColor={true}
                mode={mode}
                title={title}
                titleFull={`${title}: ${troveId}`}
              />
            </div>
            <VFlex
              alignItems="center"
              justifyContent="center"
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
                mode="negative"
                label="Try again"
                size="small"
                onClick={onRetry}
              />
            </VFlex>
          </div>
        ))
        .with("error", () => (
          <HFlex gap={8}>
            Error fetching loan{" "}
            <span title={`Loan ${troveId}`}>
              {shortenTroveId(troveId)}
            </span>
            <Button
              mode="primary"
              label="Try again"
              size="small"
              onClick={onRetry}
            />
          </HFlex>
        ))
        .otherwise(() => {
          return loan
            && loanDetails
            && typeof leverageFactor === "number"
            && depositPreLeverage
            && maxLtv
            && liquidationRisk
            && (
              <LoanCard
                collateral={collateral}
                depositPreLeverage={depositPreLeverage}
                leverageFactor={leverageFactor}
                liquidationRisk={liquidationRisk}
                loan={loan}
                loanDetails={loanDetails}
                ltv={ltv ?? null}
                maxLtv={maxLtv}
                mode={mode}
                nftUrl={nftUrl}
                onLeverageModeChange={onLeverageModeChange}
                redemptionRisk={redemptionRisk ?? null}
                troveId={troveId}
              />
            );
        })}
    </ScreenCard>
  );
}

function LoanCardHeading({
  mode,
  title,
  titleFull,
  inheritColor,
}: {
  mode: LoanMode;
  title: string;
  titleFull?: string;
  inheritColor?: boolean;
}) {
  return (
    <div
      title={titleFull}
      className={css({
        display: "flex",
        alignItems: "center",
        gap: 8,
        textTransform: "uppercase",
        userSelect: "none",
        fontSize: 12,

        "--color-base": "token(colors.strongSurfaceContent)",
        "--color-alt": "token(colors.strongSurfaceContentAlt2)",
      })}
      style={{
        color: inheritColor ? "inherit" : "var(--color-base)",
      }}
    >
      <div
        className={css({
          display: "flex",
        })}
        style={{
          color: inheritColor ? "inherit" : "var(--color-alt)",
        }}
      >
        {mode === "leverage"
          ? <IconLeverage size={16} />
          : <IconBorrow size={16} />}
      </div>
      {title}
    </div>
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
          display: "flex",
          alignItems: "center",
          gap: 8,
          whiteSpace: "nowrap",
          color: "strongSurfaceContentAlt",
        })}
      >
        {label}
      </div>
      <div
        className={css({
          display: "flex",
          alignItems: "center",
          gap: 8,
          whiteSpace: "nowrap",
          color: "strongSurfaceContent",
        })}
      >
        {children}
      </div>
    </div>
  );
}

function LoanCard({
  ...props
}: {
  mode: LoanMode;
  loan: PositionLoan;
  loanDetails: LoanDetails;
  collateral: CollateralToken;
  leverageFactor: number | null;
  depositPreLeverage: Dnum;
  ltv: Dnum | null;
  maxLtv: Dnum;
  liquidationRisk: "low" | "medium" | "high";
  redemptionRisk: "low" | "medium" | "high" | null;
  troveId: TroveId;
  nftUrl: string | null;
  onLeverageModeChange: (mode: LoanMode) => void;
}) {
  const [notifyCopy, setNotifyCopy] = useState(false);

  useEffect(() => {
    if (!notifyCopy) {
      return;
    }
    const timeout = setTimeout(() => {
      setNotifyCopy(false);
    }, 500);
    return () => {
      clearTimeout(timeout);
    };
  }, [notifyCopy]);

  const notifyCopyTransition = useTransition(notifyCopy, {
    from: { opacity: 0, transform: "scale(0.9)" },
    enter: { opacity: 1, transform: "scale(1)" },
    leave: { opacity: 0, transform: "scale(1)" },
    config: {
      mass: 1,
      tension: 2000,
      friction: 80,
    },
  });

  // const cardTransitionRef = useSpringRef();
  const cardTransition = useTransition(props, {
    // ref: cardTransitionRef,
    keys: (props) => props.mode,
    initial: {
      transform: `
        scale(1)
        translate3d(0, 0px, 0)
      `,
    },
    from: {
      transform: `
        scale(0.6)
        translate3d(0, 80px, 0)
      `,
    },
    enter: {
      transform: `
        scale(1)
        translate3d(0, 0px, 0)
      `,
    },
    leave: {
      transform: `
        scale(0.9)
        translate3d(0, 10px, 0)
      `,
    },
    config: {
      mass: 1,
      tension: 2400,
      friction: 160,
    },
  });

  return (
    <div
      className={css({
        position: "relative",
        width: "100%",
        height: "100%",
      })}
    >
      {cardTransition((style, {
        mode,
        onLeverageModeChange,
        loan,
        loanDetails,
        collateral,
        leverageFactor,
        depositPreLeverage,
        ltv,
        maxLtv,
        liquidationRisk,
        redemptionRisk,
        troveId,
        nftUrl,
      }) => {
        const title = mode === "leverage" ? "Leverage loan" : "BOLD loan";
        return (
          <a.div
            className={css({
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              willChange: "transform",
            })}
            style={style}
          >
            <section
              className={css({
                position: "absolute",
                inset: 0,
                padding: "16px 16px 24px",
                background: "strongSurface",
                color: "strongSurfaceContent",
                borderRadius: 8,
                userSelect: "none",
              })}
            >
              <h1
                className={css({
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 4,
                  paddingBottom: 12,
                })}
              >
                <LoanCardHeading
                  inheritColor={false}
                  mode={mode}
                  title={title}
                  titleFull={`${title}: ${troveId}`}
                />
                <div
                  className={css({
                    position: "absolute",
                    top: 16,
                    right: 16,
                  })}
                >
                  {notifyCopyTransition((style, show) => (
                    show && (
                      <a.div
                        className={css({
                          position: "absolute",
                          top: 0,
                          bottom: 0,
                          right: "calc(100% + 16px)",
                          display: "grid",
                          placeItems: "center",
                          fontSize: 12,
                          textTransform: "uppercase",
                          whiteSpace: "nowrap",
                        })}
                        style={{
                          ...style,
                        }}
                      >
                        Copied
                      </a.div>
                    )
                  ))}
                  <Dropdown
                    buttonDisplay={
                      <div
                        className={css({
                          display: "grid",
                          placeItems: "center",
                          width: 28,
                          height: 28,
                          color: "strongSurfaceContent",
                          borderRadius: "50%",
                          _groupActive: {
                            translate: "0 1px",
                            boxShadow: `0 1px 1px rgba(0, 0, 0, 0.1)`,
                          },
                          _groupFocusVisible: {
                            outline: "2px solid token(colors.focused)",
                          },
                          _groupExpanded: {
                            color: "strongSurface",
                            background: "secondaryActive",
                          },
                        })}
                      >
                        <IconEllipsis size={24} />
                      </div>
                    }
                    items={[
                      {
                        icon: (
                          <div
                            className={css({
                              color: "accent",
                            })}
                          >
                            {mode === "leverage"
                              ? <IconBorrow size={16} />
                              : <IconLeverage size={16} />}
                          </div>
                        ),
                        label: mode === "leverage"
                          ? "View as loan"
                          : "View as leverage",
                      },
                      {
                        icon: (
                          <div
                            className={css({
                              color: "accent",
                            })}
                          >
                            <IconCopy size={16} />
                          </div>
                        ),
                        label: "Copy public link",
                      },
                      {
                        icon: (
                          <Image
                            alt=""
                            width={16}
                            height={16}
                            src={blo(loan.borrower)}
                            className={css({
                              display: "block",
                              borderRadius: 2,
                            })}
                          />
                        ),
                        label: `Owner ${shortenAddress(loan.borrower, 4)}`,
                        value: (
                          <div
                            className={css({
                              color: "contentAlt",
                            })}
                          >
                            <IconExternal size={16} />
                          </div>
                        ),
                      },
                      {
                        icon: (
                          <div
                            className={css({
                              color: "accent",
                            })}
                          >
                            <IconNft size={16} />
                          </div>
                        ),
                        label: "Open NFT",
                        value: (
                          <div
                            className={css({
                              color: "contentAlt",
                            })}
                          >
                            <IconExternal size={16} />
                          </div>
                        ),
                      },
                    ]}
                    selected={0}
                    onSelect={(index) => {
                      if (index === 0) {
                        onLeverageModeChange(mode === "leverage" ? "borrow" : "leverage");
                      }
                      if (index === 1) {
                        navigator.clipboard.writeText(window.location.href);
                        setNotifyCopy(true);
                      }
                      if (index === 2) {
                        window.open(`${CHAIN_BLOCK_EXPLORER?.url}address/${loan.borrower}`);
                      }
                      if (index === 3 && nftUrl) {
                        window.open(nftUrl);
                      }
                    }}
                  />
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
                  {mode === "leverage"
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
              </div>
              <div
                className={css({
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 12,
                  paddingTop: 32,
                })}
              >
                {mode === "leverage"
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
            </section>
          </a.div>
        );
      })}
    </div>
  );
}
