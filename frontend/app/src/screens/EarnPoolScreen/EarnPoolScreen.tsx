"use client";

import { useBreakpointName } from "@/src/breakpoints";
import { EarnPositionSummary } from "@/src/comps/EarnPositionSummary/EarnPositionSummary";
import { Screen } from "@/src/comps/Screen/Screen";
import { ScreenCard } from "@/src/comps/Screen/ScreenCard";
import { Spinner } from "@/src/comps/Spinner/Spinner";
import content from "@/src/content";
import { DNUM_0 } from "@/src/dnum-utils";
import { getBranch, getCollToken, useEarnPool, useEarnPosition } from "@/src/liquity-utils";
import { useWait } from "@/src/react-utils";
import { useAccount } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";
import { HFlex, IconEarn, isCollateralSymbol, Tabs } from "@liquity2/uikit";
import { a, useTransition } from "@react-spring/web";
import { useParams, useRouter } from "next/navigation";
import { match } from "ts-pattern";
import { PanelClaimRewards } from "./PanelClaimRewards";
import { PanelUpdateDeposit } from "./PanelUpdateDeposit";

const TABS = [
  { action: "deposit", label: content.earnScreen.tabs.deposit },
  { action: "claim", label: content.earnScreen.tabs.claim },
] as const;

export function EarnPoolScreen() {
  const params = useParams();

  const collateralSymbol = String(params.pool).toUpperCase();
  if (!isCollateralSymbol(collateralSymbol)) {
    throw new Error("Invalid collateral symbol");
  }

  const tab = TABS.find((tab) => tab.action === params.action) ?? TABS[0];
  if (!tab) {
    throw new Error("Invalid tab action: " + params.action);
  }

  const router = useRouter();
  const account = useAccount();

  const branch = getBranch(collateralSymbol);
  const collToken = getCollToken(branch.id);
  const earnPosition = useEarnPosition(branch.id, account.address ?? null);
  const earnPool = useEarnPool(branch.id);
  const ready = useWait(500);

  const loadingState = !ready || earnPool.isLoading || earnPosition.isLoading ? "loading" : "success";

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

  const breakpointName = useBreakpointName();

  return (
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
          finalHeight={breakpointName === "large" ? 140 : 248}
        >
          {loadingState === "success"
            ? (
              <EarnPositionSummary
                earnPosition={earnPosition.data ?? null}
                branchId={branch.id}
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
                  <HFlex gap={8}>
                    Fetching {collToken.name} Stability Pool…
                    <Spinner size={18} />
                  </HFlex>
                </div>
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
            {tab.action === "deposit" && (
              <PanelUpdateDeposit
                branchId={branch.id}
                poolDeposit={earnPool.data?.totalDeposited ?? DNUM_0}
                position={earnPosition.data ?? undefined}
              />
            )}
            {tab.action === "claim" && (
              <PanelClaimRewards
                branchId={branch.id}
                position={earnPosition.data ?? undefined}
              />
            )}
          </a.div>
        )
      ))}
    </Screen>
  );
}
