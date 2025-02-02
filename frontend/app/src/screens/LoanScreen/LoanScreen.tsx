"use client";

import type { PositionLoanCommitted } from "@/src/types";

import { Field } from "@/src/comps/Field/Field";
import { Screen } from "@/src/comps/Screen/Screen";
import content from "@/src/content";
import { getCollateralContract } from "@/src/contracts";
import { dnum18 } from "@/src/dnum-utils";
import { fmtnum } from "@/src/formatting";
import { getCollToken, getPrefixedTroveId, parsePrefixedTroveId, useLoan } from "@/src/liquity-utils";
import { useAccount } from "@/src/services/Ethereum";
import { usePrice } from "@/src/services/Prices";
import { useStoredState } from "@/src/services/StoredState";
import { useTransactionFlow } from "@/src/services/TransactionFlow";
import { isPrefixedtroveId } from "@/src/types";
import { css } from "@/styled-system/css";
import { Button, InfoTooltip, Tabs, TokenIcon } from "@liquity2/uikit";
import { a, useTransition } from "@react-spring/web";
import * as dn from "dnum";
import { notFound, useRouter, useSearchParams, useSelectedLayoutSegment } from "next/navigation";
import { match, P } from "ts-pattern";
import { useReadContract } from "wagmi";
import { LoanScreenCard } from "./LoanScreenCard";
import { PanelClosePosition } from "./PanelClosePosition";
import { PanelUpdateBorrowPosition } from "./PanelUpdateBorrowPosition";
import { PanelUpdateLeveragePosition } from "./PanelUpdateLeveragePosition";
import { PanelUpdateRate } from "./PanelUpdateRate";

const TABS = [
  { label: "Update Loan", id: "colldebt" },
  { label: "Interest rate", id: "rate" },
  { label: "Close loan", id: "close" },
];

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

  if (!isPrefixedtroveId(paramPrefixedId)) {
    notFound();
  }
  const { troveId, collIndex } = parsePrefixedTroveId(paramPrefixedId);

  const loan = useLoan(collIndex, troveId);
  const loanMode = storedState.loanModes[paramPrefixedId] ?? loan.data?.type ?? "borrow";

  const collToken = getCollToken(loan.data?.collIndex ?? null);
  const collPriceUsd = usePrice(collToken?.symbol ?? null);

  const fullyRedeemed = loan.data
    && loan.data.status === "redeemed"
    && dn.eq(loan.data.borrowed, 0);

  const loadingState = match([loan, collPriceUsd.data ?? null])
    .returnType<LoanLoadingState>()
    .with(
      P.union(
        [P.any, null],
        [{ status: "pending" }, P.any],
        [{ fetchStatus: "fetching", data: null }, P.any],
      ),
      () => "loading",
    )
    .with([{ status: "error" }, P.any], () => "error")
    .with([{ data: null }, P.any], () => "not-found")
    .with([{ data: P.nonNullable }, P.any], () => "success")
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
        />
      }
    >
      {contentTransition((style, item) => (
        item === "success" && loan.data && (
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
                  ? <ClaimCollateralSurplus loan={loan.data} />
                  : (
                    <>
                      {loan.data.status === "redeemed" && (
                        <div
                          className={css({
                            display: "flex",
                            alignItems: "center",
                            height: 64,
                            padding: 16,
                            background: "infoSurface",
                            border: "1px solid token(colors.infoSurfaceBorder)",
                            borderRadius: 8,
                          })}
                        >
                          <div
                            className={css({
                              display: "flex",
                              gap: 8,
                            })}
                          >
                            {fullyRedeemed
                              ? "This loan has been fully redeemed."
                              : "This loan has been partially redeemed."}
                            <InfoTooltip content={content.generalInfotooltips.redeemedLoan} />
                          </div>
                        </div>
                      )}
                      <Tabs
                        items={TABS.map(({ label, id }) => ({
                          label,
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
                            loan.data.collIndex,
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
                      {action === "rate" && <PanelUpdateRate loan={loan.data} />}
                      {action === "close" && <PanelClosePosition loan={loan.data} />}
                    </>
                  )}
              </a.div>
            )
          ))
        )
      ))}
    </Screen>
  );
}

function ClaimCollateralSurplus({
  loan,
}: {
  loan: PositionLoanCommitted;
}) {
  const account = useAccount();
  const txFlow = useTransactionFlow();
  const collToken = getCollToken(loan.collIndex);
  if (!collToken) {
    throw new Error(`collToken not found for index ${loan.collIndex}`);
  }

  const csp = getCollateralContract(loan.collIndex, "CollSurplusPool");
  if (!csp) {
    throw new Error("Collateral surplus pool not found for collateral index: " + loan.collIndex);
  }

  const collPriceUsd = usePrice(collToken.symbol);

  const collSurplus = useReadContract({
    ...csp,
    functionName: "getCollateral",
    args: [loan.borrower],
    query: {
      enabled: Boolean(loan.borrower),
      select: dnum18,
    },
  });

  const collSurplusUsd = collPriceUsd.data && collSurplus.data
    ? dn.mul(collSurplus.data, collPriceUsd.data)
    : null;

  // const isOwner = account.address && addressesEqual(account.address, loan.borrower);
  const isOwner = true;

  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: 40,
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
          <>
            The collateral has been deducted from this position.
          </>
          {isOwner && (
            <>
              You can claim back the excess collateral accross your liquidated {collToken.name} loans.
            </>
          )}
        </div>
      </section>
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
              <div>{fmtnum(collSurplus.data ?? 0)}</div>
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
                  background: "fieldSurface",
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
      {isOwner && (
        <Button
          disabled={!collSurplus.data || dn.eq(collSurplus.data, 0) || !isOwner}
          mode="primary"
          size="large"
          label="Claim remaining collateral"
          onClick={() => {
            if (account.address) {
              txFlow.start({
                flowId: "claimCollateralSurplus",
                backLink: [
                  `/loan?id=${loan.collIndex}:${loan.troveId}`,
                  "Back to the loan",
                ],
                successLink: ["/", "Go to the dashboard"],
                successMessage: "The loan position has been closed successfully.",

                borrower: loan.borrower,
                collIndex: loan.collIndex,
                collSurplus: collSurplus.data ?? dnum18(0),
              });
            }
          }}
        />
      )}
    </div>
  );
}
