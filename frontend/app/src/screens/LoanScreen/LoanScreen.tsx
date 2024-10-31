"use client";

import { Screen } from "@/src/comps/Screen/Screen";
import { getPrefixedTroveId, parsePrefixedTroveId } from "@/src/liquity-utils";
import { useStoredState } from "@/src/services/StoredState";
import { useLoanById } from "@/src/subgraph-hooks";
import { isPrefixedtroveId } from "@/src/types";
import { css } from "@/styled-system/css";
import { Tabs } from "@liquity2/uikit";
import { a, useTransition } from "@react-spring/web";
import { notFound, useRouter, useSearchParams, useSelectedLayoutSegment } from "next/navigation";
import { match, P } from "ts-pattern";
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
  | "awaiting-confirmation"
  | "error"
  | "loading"
  | "not-found"
  | "success";

export const LOAN_STATES: LoanLoadingState[] = [
  "success",
  "loading",
  "awaiting-confirmation",
  "error",
  "not-found",
];

export function LoanScreen() {
  const router = useRouter();
  const action = useSelectedLayoutSegment() ?? "colldebt";
  const searchParams = useSearchParams();
  const paramPrefixedId = searchParams.get("id");
  const storedState = useStoredState();

  if (!isPrefixedtroveId(paramPrefixedId)) {
    notFound();
  }

  const loan = useLoanById(paramPrefixedId);
  const loanMode = storedState.loanModes[paramPrefixedId] ?? loan.data?.type ?? "borrow";
  const { troveId } = parsePrefixedTroveId(paramPrefixedId);

  const tab = TABS.findIndex(({ id }) => id === action);

  const loadingState = match(loan)
    .returnType<LoanLoadingState>()
    .with({ status: "error" }, () => "error")
    .with(
      P.union(
        { status: "pending" },
        { fetchStatus: "fetching", data: null },
      ),
      () => "loading",
    )
    .with({ data: null }, () => "not-found")
    .with({ data: P.nonNullable }, () => "success")
    .otherwise(() => "error");

  const tabsTransition = useTransition(loadingState, {
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
          mode={loanMode}
          loadingState={loadingState}
          loan={loan.data ?? null}
          onLeverageModeChange={() => {
            storedState.setState(({ loanModes }) => {
              return {
                loanModes: {
                  ...loanModes,
                  [paramPrefixedId]: loanMode === "borrow" ? "leverage" : "borrow",
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
      {tabsTransition((style, item) => (
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
                <Tabs
                  items={TABS.map(({ label, id }) => ({
                    label,
                    panelId: `p-${id}`,
                    tabId: `t-${id}`,
                  }))}
                  selected={tab}
                  onSelect={(index) => {
                    if (!loan.data) {
                      return;
                    }
                    const id = getPrefixedTroveId(loan.data.collIndex, loan.data.troveId);
                    router.push(
                      `/loan/${TABS[index].id}?id=${id}`,
                      { scroll: false },
                    );
                  }}
                />
                {action === "colldebt" && (
                  loanMode === "leverage"
                    ? <PanelUpdateLeveragePosition loan={loan.data} />
                    : <PanelUpdateBorrowPosition loan={loan.data} />
                )}
                {action === "rate" && <PanelUpdateRate loan={loan.data} />}
                {action === "close" && <PanelClosePosition loan={loan.data} />}
              </a.div>
            )
          ))
        )
      ))}
    </Screen>
  );
}
