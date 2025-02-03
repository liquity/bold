"use client";

import { EarnPositionSummary } from "@/src/comps/EarnPositionSummary/EarnPositionSummary";
import { Screen } from "@/src/comps/Screen/Screen";
import { ScreenCard } from "@/src/comps/Screen/ScreenCard";
import { Spinner } from "@/src/comps/Spinner/Spinner";
import content from "@/src/content";
import { getCollIndexFromSymbol, useEarnPool, useEarnPosition } from "@/src/liquity-utils";
import { useAccount } from "@/src/services/Ethereum";
import { css } from "@/styled-system/css";
import { HFlex, IconEarn, isCollateralSymbol, Tabs } from "@liquity2/uikit";
import { a, useTransition } from "@react-spring/web";
import * as dn from "dnum";
import { useParams, useRouter } from "next/navigation";
import { match } from "ts-pattern";
import { PanelClaimRewards } from "./PanelClaimRewards";
import { PanelUpdateDeposit } from "./PanelUpdateDeposit";

const TABS = [
  { action: "deposit", label: content.earnScreen.tabs.deposit },
  { action: "claim", label: content.earnScreen.tabs.claim },
] as const;

export function EarnPoolScreen() {
  const router = useRouter();
  const params = useParams();

  const account = useAccount();

  const collateralSymbol = String(params.pool).toUpperCase();
  const isCollSymbolOk = isCollateralSymbol(collateralSymbol);
  const collIndex = getCollIndexFromSymbol(isCollSymbolOk ? collateralSymbol : null);

  const earnPosition = useEarnPosition(collIndex, account.address ?? null);
  const earnPool = useEarnPool(collIndex);

  const hasDeposit = earnPosition.data?.deposit && dn.gt(earnPosition.data.deposit, 0);

  const tab = TABS.find((tab) => tab.action === params.action) ?? TABS[0];

  const loadingState = earnPool.isLoading || earnPosition.status === "pending" ? "loading" : "success";

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

  if (collIndex === null || !isCollSymbolOk) {
    return null;
  }

  return earnPool.data && tab && (
    <Screen
      ready={loadingState === "success"}
      back={{
        href: "/earn",
        label: content.earnScreen.backButton,
      }}
      heading={
        <ScreenCard
          mode={match(loadingState)
            .returnType<"ready" | "loading">()
            .with("success", () => "ready")
            .with("loading", () => "loading")
            .exhaustive()}
          finalHeight={140}
        >
          {loadingState === "success"
            ? (
              <EarnPositionSummary
                earnPosition={earnPosition.data}
                collIndex={collIndex}
              />
            )
            : (
              <>
                <div
                  className={css({
                    position: "absolute",
                    top: 16,
                    left: 16,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    textTransform: "uppercase",
                    userSelect: "none",
                    fontSize: 12,
                  })}
                >
                  <div
                    className={css({
                      display: "flex",
                    })}
                  >
                    <IconEarn size={16} />
                  </div>
                  <div>
                    Earn Pool
                  </div>
                </div>
                <HFlex gap={8}>
                  Fetching {earnPool.data.collateral?.name} Stability Pool…
                  <Spinner size={18} />
                </HFlex>
              </>
            )}
        </ScreenCard>
      }
      className={css({
        position: "relative",
      })}
    >
      {tabsTransition((style, item) => (
        item === "success" && (
          <a.div
            className={css({
              display: "flex",
              flexDirection: "column",
              gap: 24,
              width: "100%",
            })}
            style={{
              opacity: style.opacity,
            }}
          >
            {hasDeposit
              ? (
                <Tabs
                  selected={TABS.indexOf(tab)}
                  onSelect={(index) => {
                    const tab = TABS[index];
                    if (!tab) {
                      throw new Error("Invalid tab index");
                    }
                    router.push(`/earn/${collateralSymbol.toLowerCase()}/${tab.action}`, {
                      scroll: false,
                    });
                  }}
                  items={TABS.map((tab) => ({
                    label: tab.label,
                    panelId: `panel-${tab.action}`,
                    tabId: `tab-${tab.action}`,
                  }))}
                />
              )
              : (
                <h1
                  className={css({
                    fontSize: 24,
                  })}
                >
                  New Stability Pool deposit
                </h1>
              )}
            {tab.action === "deposit" && (
              <PanelUpdateDeposit
                collIndex={collIndex}
                deposited={earnPool.data.totalDeposited ?? dn.from(0, 18)}
                position={earnPosition.data ?? undefined}
              />
            )}
            {tab.action === "claim" && (
              <PanelClaimRewards
                collIndex={collIndex}
                position={earnPosition.data ?? undefined}
              />
            )}
          </a.div>
        )
      ))}
    </Screen>
  );
}
