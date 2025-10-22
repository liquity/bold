"use client";

import type { Dnum, PositionLoanCommitted } from "@/src/types";

import { useBreakpoint } from "@/src/breakpoints";
import { InlineTokenAmount } from "@/src/comps/Amount/InlineTokenAmount";
import { Field } from "@/src/comps/Field/Field";
import { LinkTextButton } from "@/src/comps/LinkTextButton/LinkTextButton";
import { Screen } from "@/src/comps/Screen/Screen";
import content from "@/src/content";
import { TROVE_EXPLORER_0, TROVE_EXPLORER_1 } from "@/src/env";
import { fmtnum, formatDate } from "@/src/formatting";
import {
  getCollToken,
  getPrefixedTroveId,
  parsePrefixedTroveId,
  useCollateralSurplus,
  useLoan,
} from "@/src/liquity-utils";
import { usePrice } from "@/src/services/Prices";
import { useStoredState } from "@/src/services/StoredState";
import { useTransactionFlow } from "@/src/services/TransactionFlow";
import { isPrefixedtroveId } from "@/src/types";
import { useAccount } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";
import { addressesEqual, Button, IconExternal, InfoTooltip, Tabs, TokenIcon } from "@liquity2/uikit";
import { a, useTransition } from "@react-spring/web";
import * as dn from "dnum";
import { notFound, useRouter, useSearchParams, useSelectedLayoutSegment } from "next/navigation";
import { useState } from "react";
import { match, P } from "ts-pattern";
import { LoanScreenCard } from "./LoanScreenCard";
import { PanelClosePosition } from "./PanelClosePosition";
import { PanelInterestRate } from "./PanelInterestRate";
import { PanelUpdateBorrowPosition } from "./PanelUpdateBorrowPosition";
import { PanelUpdateLeveragePosition } from "./PanelUpdateLeveragePosition";

const troveExplorers = [
  ...(TROVE_EXPLORER_0 ? [TROVE_EXPLORER_0] : []),
  ...(TROVE_EXPLORER_1 ? [TROVE_EXPLORER_1] : []),
];

function TroveExplorerLink(props: {
  troveExplorer: { name: string; url: string };
  collTokenName: string;
  troveId: bigint;
  last?: boolean;
}) {
  const href = props.troveExplorer.url
    .replace("{branch}", props.collTokenName)
    .replace("{troveId}", props.troveId.toString());

  return (
    <LinkTextButton
      label={<>{props.troveExplorer.name} {props.last && <IconExternal size={16} />}</>}
      href={href}
      external
    />
  );
}

const TABS = [
  {
    label: "Update Loan",
    labelCompact: "Update",
    id: "colldebt",
  },
  {
    label: "Interest rate",
    labelCompact: "Rate",
    id: "rate",
  },
  {
    label: "Close loan",
    labelCompact: "Close",
    id: "close",
  },
];

function TroveHistoryLinksDrawer({
  collTokenName,
  troveId,
}: {
  collTokenName: string;
  troveId: bigint;
}) {
  return (
    troveExplorers.length > 0 && (
      <div
        className={css({
          width: "100%",
          display: "flex",
          justifyContent: "left",
          alignItems: "center",
          gap: 16,
          marginTop: -22,
          height: 60,
          padding: "12px 16px",
          whiteSpace: "nowrap",
          background: "token(colors.fieldSurface)",
          borderRadius: 8,
          userSelect: "none",
        })}
      >
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 18,
            fontSize: 14,
          })}
        >
          <span>
            Loan History:
          </span>
          {troveExplorers[0] && troveExplorers[1]
            ? (
              <>
                <TroveExplorerLink
                  troveExplorer={troveExplorers[0]}
                  collTokenName={collTokenName}
                  troveId={troveId}
                />{" "}
                |{" "}
                <TroveExplorerLink
                  troveExplorer={troveExplorers[1]}
                  collTokenName={collTokenName}
                  troveId={troveId}
                  last
                />
              </>
            )
            : troveExplorers[0] && (
              <TroveExplorerLink
                troveExplorer={troveExplorers[0]}
                collTokenName={collTokenName}
                troveId={troveId}
                last
              />
            )}
        </div>
      </div>
    )
  );
}

export type LoanLoadingState =
  | "error"
  | "loading"
  | "not-found"
  | "success";

export function LoanScreen() {
  const router = useRouter();
  const action = useSelectedLayoutSegment() ?? "colldebt";
  const searchParams = useSearchParams();
  const paramPrefixedId = searchParams.get("id");
  const storedState = useStoredState();

  const [compactMode, setCompactMode] = useState(false);
  useBreakpoint(({ medium }) => {
    setCompactMode(!medium);
  });

  if (!isPrefixedtroveId(paramPrefixedId)) {
    notFound();
  }
  const { troveId, branchId } = parsePrefixedTroveId(paramPrefixedId);

  const loan = useLoan(branchId, troveId);
  const loanMode = storedState.loanModes[paramPrefixedId] ?? loan.data?.type ?? "borrow";

  const collToken = getCollToken(loan.data?.branchId ?? null);
  const collPriceUsd = usePrice(collToken?.symbol ?? null);

  const fullyRedeemed = loan.data
    && loan.data.status === "redeemed"
    && dn.eq(loan.data.recordedDebt, 0);

  const isLiquidated = loan.data?.status === "liquidated";
  const account = useAccount();

  const collSurplus = useCollateralSurplus(
    loan.data?.borrower ?? null,
    branchId,
  );

  const loadingState = match([
    loan,
    collPriceUsd.data ?? null,
    // only include collSurplus in loading check if the loan is liquidated
    isLiquidated ? collSurplus : { status: "success" },
  ])
    .returnType<LoanLoadingState>()
    .with(
      P.union(
        [P.any, null, P.any],
        [{ status: "pending" }, P.any, P.any],
        [{ fetchStatus: "fetching", data: null }, P.any, P.any],
        [P.any, P.any, { status: "pending" }],
        [P.any, P.any, { fetchStatus: "fetching", data: undefined }],
      ),
      () => "loading",
    )
    .with([{ status: "error" }, P.any, P.any], () => "error")
    .with([P.any, P.any, { status: "error" }], () => "error")
    .with([{ data: null }, P.any, P.any], () => "not-found")
    .with([{ data: P.nonNullable }, P.any, P.any], () => "success")
    .otherwise(() => "error");

  const contentTransition = useTransition(loadingState, {
    from: { opacity: 0 },
    enter: { opacity: 1 },
    leave: { opacity: 0 },
    config: {
      mass: 1,
      tension: 2000,
      friction: 120,
    },
  });

  const modeTransition = useTransition(loanMode, {
    from: { translateY: 0 },
    enter: { translateY: 0 },
    leave: { translateY: 0 },
    config: {
      mass: 1,
      tension: 2000,
      friction: 120,
    },
    immediate: true,
  });

  return (
    <Screen
      ready={loadingState === "success"}
      back={{
        href: "/",
        label: "Back",
      }}
      heading={
        <>
          <LoanScreenCard
            collateral={collToken}
            collPriceUsd={collPriceUsd.data ?? null}
            loadingState={loadingState}
            loan={loan.data ?? null}
            mode={loanMode}
            onLeverageModeChange={() => {
              storedState.setState(({ loanModes }) => {
                return {
                  loanModes: {
                    ...loanModes,
                    [paramPrefixedId]: loanMode === "borrow" ? "multiply" : "borrow",
                  },
                };
              });
            }}
            onRetry={() => {
              loan.refetch();
            }}
            troveId={troveId}
            collSurplusOnChain={collSurplus.data ?? null}
          />
          <TroveHistoryLinksDrawer
            collTokenName={collToken?.name ?? ""}
            troveId={BigInt(troveId)}
          />
        </>
      }
    >
      {contentTransition((style, contentStatus) =>
        contentStatus === "success" && (
          // this <div> is only needed to prevent a warning when contentTransition
          // would otherwise try to pass a ref to a fragment (for internal tracking),
          // which is not allowed
          <div
            className={css({
              display: "flex",
              flexDirection: "column",
              width: "100%",
            })}
          >
            {loan.data && (
              modeTransition((modeStyle) => (
                loan.data && (
                  <a.div
                    className={css({
                      display: "flex",
                      flexDirection: "column",
                      gap: 32,
                    })}
                    style={{
                      opacity: style.opacity,
                      translateY: modeStyle.translateY,
                    }}
                  >
                    {loan.data.status === "liquidated"
                      ? (
                        <ClaimCollateralSurplus
                          accountAddress={account.address ?? null}
                          collSurplus={collSurplus.data ?? null}
                          loan={loan.data}
                        />
                      )
                      : (
                        <>
                          {loan.data.status === "redeemed" && (
                            <div
                              className={css({
                                display: "flex",
                                flexDirection: "column",
                                padding: 16,
                                gap: 8,
                                background: "infoSurface",
                                border: "1px solid token(colors.infoSurfaceBorder)",
                                borderRadius: 8,
                              })}
                            >
                              <p
                                className={css({
                                  display: "flex",
                                  gap: 8,
                                })}
                              >
                                {fullyRedeemed
                                  ? <>Loan fully redeemed.</>
                                  : <>Loan partially redeemed.</>}
                                <InfoTooltip content={content.generalInfotooltips.redeemedLoan} />
                              </p>

                              <p>
                                {loan.data.redemptionCount}{" "}
                                {loan.data.redemptionCount === 1 ? <>redemption</> : <>redemptions</>}{" "}
                                since last user action on{" "}
                                <time
                                  dateTime={formatDate(new Date(loan.data.lastUserActionAt), "iso")}
                                  title={formatDate(new Date(loan.data.lastUserActionAt), "iso")}
                                >
                                  {formatDate(new Date(loan.data.lastUserActionAt), "short")}
                                </time>.
                                <br />
                                <InlineTokenAmount
                                  symbol="BOLD"
                                  value={loan.data.redeemedDebt}
                                  suffix=" BOLD"
                                />{" "}
                                repaid in exchange for{" "}
                                <InlineTokenAmount
                                  symbol={collToken?.symbol}
                                  value={loan.data.redeemedColl}
                                  suffix={` ${collToken?.name}`}
                                />.
                              </p>

                              {collToken && troveExplorers.length > 0 && (
                                <p>
                                  See Loan History on {troveExplorers[0] && troveExplorers[1]
                                    ? (
                                      <>
                                        <TroveExplorerLink
                                          troveExplorer={troveExplorers[0]}
                                          collTokenName={collToken.name}
                                          troveId={BigInt(troveId)}
                                        />{" "}
                                        or{" "}
                                        <TroveExplorerLink
                                          troveExplorer={troveExplorers[1]}
                                          collTokenName={collToken.name}
                                          troveId={BigInt(troveId)}
                                          last
                                        />
                                      </>
                                    )
                                    : troveExplorers[0] && (
                                      <TroveExplorerLink
                                        troveExplorer={troveExplorers[0]}
                                        collTokenName={collToken.name}
                                        troveId={BigInt(troveId)}
                                        last
                                      />
                                    )}
                                </p>
                              )}
                            </div>
                          )}
                          <Tabs
                            items={TABS.map(({ label, labelCompact, id }) => ({
                              label: compactMode ? labelCompact : label,
                              panelId: `p-${id}`,
                              tabId: `t-${id}`,
                            }))}
                            selected={TABS.findIndex(({ id }) => id === action)}
                            onSelect={(index) => {
                              if (!loan.data) {
                                return;
                              }
                              const tab = TABS[index];
                              if (!tab) {
                                throw new Error("Invalid tab index");
                              }
                              const id = getPrefixedTroveId(
                                loan.data.branchId,
                                loan.data.troveId,
                              );
                              router.push(
                                `/loan/${tab.id}?id=${id}`,
                                { scroll: false },
                              );
                            }}
                          />

                          {action === "colldebt" && (
                            loanMode === "multiply"
                              ? <PanelUpdateLeveragePosition loan={loan.data} />
                              : <PanelUpdateBorrowPosition loan={loan.data} />
                          )}
                          {action === "rate" && <PanelInterestRate loan={loan.data} loanMode={loanMode} />}
                          {action === "close" && <PanelClosePosition loan={loan.data} loanMode={loanMode} />}
                        </>
                      )}
                  </a.div>
                )
              ))
            )}
          </div>
        )
      )}
    </Screen>
  );
}

function ClaimCollateralSurplus({
  accountAddress,
  collSurplus,
  loan,
}: {
  accountAddress: null | `0x${string}`;
  collSurplus: null | Dnum;
  loan: PositionLoanCommitted;
}) {
  const txFlow = useTransactionFlow();
  const collToken = getCollToken(loan.branchId);
  const collPriceUsd = usePrice(collToken.symbol);

  const isOwner = accountAddress && (
    addressesEqual(accountAddress, loan.borrower)
  );

  const collSurplusUsd = collPriceUsd.data && collSurplus
    ? dn.mul(collSurplus, collPriceUsd.data)
    : null;

  if (!collSurplus || dn.eq(collSurplus, 0)) {
    return null;
  }

  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: 16,
      })}
    >
      <section
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: "12px 16px",
          fontSize: 16,
          color: "negativeInfoSurfaceContentAlt",
          background: "negativeInfoSurface",
          border: "1px solid token(colors.negativeInfoSurfaceBorder)",
          borderRadius: 8,
        })}
      >
        <h1
          className={css({
            color: "negativeInfoSurfaceContent",
          })}
        >
          This loan has been liquidated
        </h1>
        <div>
          The collateral has been deducted from this position.
          {isOwner && (
            <>
              You can claim back the excess collateral from your liquidated {collToken.name}{" "}
              loan. If you have multiple liquidated positions on the same branch, you can claim the surplus from all of
              them at once.
            </>
          )}
        </div>
      </section>
      {isOwner && (
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: 16,
            padding: 16,
            background: "fieldSurface",
            borderRadius: 8,
          })}
        >
          <Field
            label="Remaining collateral"
            field={
              <div
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  justifyContent: "space-between",
                })}
              >
                <div
                  className={css({
                    display: "flex",
                    gap: 16,
                    fontSize: 28,
                    lineHeight: 1,
                  })}
                >
                  <div>{fmtnum(collSurplus)}</div>
                </div>
                <div>
                  <div
                    className={css({
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      height: 40,
                      padding: "0 16px 0 8px",
                      fontSize: 24,
                      background: "background",
                      borderRadius: 20,
                      userSelect: "none",
                    })}
                  >
                    <TokenIcon symbol={collToken.symbol} />
                    <div>{collToken.name}</div>
                  </div>
                </div>
              </div>
            }
            footer={{
              start: (
                <Field.FooterInfo
                  label={fmtnum(collSurplusUsd, { preset: "2z", prefix: "$" })}
                  value={null}
                />
              ),
            }}
          />
          <Button
            disabled={!accountAddress || !collSurplus || dn.eq(collSurplus, 0)}
            mode="primary"
            size="medium"
            label="Claim remaining collateral"
            onClick={() => {
              if (accountAddress && collSurplus) {
                txFlow.start({
                  flowId: "claimCollateralSurplus",
                  backLink: [`/loan?id=${loan.branchId}:${loan.troveId}`, "Back to loan"],
                  successLink: ["/", "Go to the dashboard"],
                  successMessage: "Collateral surplus has been claimed successfully.",
                  borrower: accountAddress,
                  branchId: loan.branchId,
                  collSurplus,
                });
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
