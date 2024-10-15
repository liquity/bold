"use client";

import { Screen } from "@/src/comps/Screen/Screen";
import { LOAN_SCREEN_MANUAL_LOADING_STATE } from "@/src/demo-mode/demo-data";
import { getPrefixedTroveId, parsePrefixedTroveId } from "@/src/liquity-utils";
import { useLoanById } from "@/src/subgraph-hooks";
import { isPrefixedtroveId } from "@/src/types";
import { css } from "@/styled-system/css";
import { Button, IconSettings, Tabs, VFlex } from "@liquity2/uikit";
import { a, useTransition } from "@react-spring/web";
import { notFound, useRouter, useSearchParams, useSelectedLayoutSegment } from "next/navigation";
import { useState } from "react";
import { match, P } from "ts-pattern";
import { LoanCard } from "./LoanCard";
import { PanelClosePosition } from "./PanelClosePosition";
import { PanelUpdateBorrowPosition } from "./PanelUpdateBorrowPosition";
import { PanelUpdateLeveragePosition } from "./PanelUpdateLeveragePosition";
import { PanelUpdateRate } from "./PanelUpdateRate";

const TABS = [
  { label: "Collateral & Debt", id: "colldebt" },
  { label: "Interest rate", id: "rate" },
  { label: "Close position", id: "close" },
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

  if (!isPrefixedtroveId(paramPrefixedId)) {
    notFound();
  }

  const { troveId } = parsePrefixedTroveId(paramPrefixedId);
  const loan = useLoanById(paramPrefixedId);

  if (loan.isLoadingError || !paramPrefixedId) {
    notFound();
  }

  const tab = TABS.findIndex(({ id }) => id === action);
  const [leverageMode, setLeverageMode] = useState(false);

  const [forcedLoadingState, setForcedLoadingState] = useState<LoanLoadingState | null>(null);

  const loadingState = forcedLoadingState ?? match(loan)
    .returnType<LoanLoadingState>()
    .with({ status: "error" }, () => "error")
    .with({ status: "pending" }, () => "loading")
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

  return (
    <Screen>
      {LOAN_SCREEN_MANUAL_LOADING_STATE && (
        <div
          className={css({
            position: "fixed",
            zIndex: 2,
            // bottom: 39,
            bottom: 0,
            left: 0,
            right: 0,
            display: "flex",
            alignItems: "center",
            gap: 8,
            height: 48,
            padding: "12px 32px",
            fontSize: 14,
            color: "contentAlt",
            background: "background",
            border: "1px solid token(colors.border)",
          })}
        >
          loan state: {LOAN_STATES.map((s) => (
            <Button
              key={s}
              label={s}
              size="mini"
              onClick={() => {
                setForcedLoadingState(s);
              }}
            />
          ))}
        </div>
      )}
      <VFlex gap={0}>
        <LoanCard
          leverageMode={leverageMode}
          loadingState={loadingState}
          loan={loan.data ?? null}
          onLeverageModeChange={setLeverageMode}
          onRetry={() => {
            loan.refetch();
          }}
          troveId={troveId}
        />
        {tabsTransition((style, item) => (
          item === "success" && loan.data && (
            <a.div
              style={{
                opacity: style.opacity,
              }}
            >
              <div
                className={css({
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 16,
                  height: 48 + 24 + 24,
                  paddingTop: 48,
                  paddingBottom: 24,
                  fontSize: 20,
                })}
              >
                <div>Manage your position</div>
                <div
                  className={css({
                    color: "contentAlt",
                    cursor: "pointer",
                  })}
                >
                  <IconSettings />
                </div>
              </div>
              <VFlex gap={32}>
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
                  leverageMode
                    ? <PanelUpdateLeveragePosition loan={loan.data} />
                    : <PanelUpdateBorrowPosition loan={loan.data} />
                )}
                {action === "rate" && <PanelUpdateRate loan={loan.data} />}
                {action === "close" && <PanelClosePosition loan={loan.data} />}
              </VFlex>
            </a.div>
          )
        ))}
      </VFlex>
    </Screen>
  );
}
