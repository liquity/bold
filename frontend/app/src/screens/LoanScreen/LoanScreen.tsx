"use client";

import type { PositionLoan } from "@/src/types";

import { Position } from "@/src/comps/Position/Position";
import { Screen } from "@/src/comps/Screen/Screen";
import { ACCOUNT_POSITIONS } from "@/src/demo-mode";
import { css } from "@/styled-system/css";
import { IconSettings, Tabs, VFlex } from "@liquity2/uikit";
import { notFound, useRouter, useSearchParams, useSelectedLayoutSegment } from "next/navigation";
import { useMemo, useState } from "react";
import { PanelClosePosition } from "./PanelClosePosition";
import { PanelUpdateBorrowPosition } from "./PanelUpdateBorrowPosition";
import { PanelUpdateLeveragePosition } from "./PanelUpdateLeveragePosition";
import { PanelUpdateRate } from "./PanelUpdateRate";

const TABS = [
  { label: "Collateral & Debt", id: "colldebt" },
  { label: "Interest rate", id: "rate" },
  { label: "Close position", id: "close" },
];

export function LoanScreen() {
  const router = useRouter();
  const action = useSelectedLayoutSegment() ?? "colldebt";
  const searchParams = useSearchParams();
  const trove = useTrove(searchParams.get("id"));

  const [leverageMode, setLeverageMode] = useState(trove?.type === "leverage");

  if (!trove) {
    notFound();
  }

  const tab = TABS.findIndex(({ id }) => id === action);

  return (
    <Screen>
      <VFlex gap={0}>
        <Position
          troveId={trove.troveId}
          leverageMode={leverageMode}
          onLeverageModeChange={setLeverageMode}
        />
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
              router.push(`/loan/${TABS[index].id}?id=${trove.troveId}`, { scroll: false });
            }}
          />
          {action === "colldebt" && (
            leverageMode
              ? <PanelUpdateLeveragePosition loan={trove} />
              : <PanelUpdateBorrowPosition loan={trove} />
          )}
          {action === "rate" && <PanelUpdateRate loan={trove} />}
          {action === "close" && <PanelClosePosition loan={trove} />}
        </VFlex>
      </VFlex>
    </Screen>
  );
}

function useTrove(troveId: string | null) {
  return useMemo(() => {
    if (troveId === null) {
      return null;
    }
    let troveIdInt: bigint;
    try {
      troveIdInt = BigInt(troveId);
    } catch {
      return null;
    }
    const position = ACCOUNT_POSITIONS.find((position) => ((
      position.type === "borrow" || position.type === "leverage"
    ) && position.troveId === troveIdInt)) ?? null;
    return position as PositionLoan | null;
  }, [troveId]);
}
