"use client";

import { EarnPositionSummary } from "@/src/comps/EarnPositionSummary/EarnPositionSummary";
import { Screen } from "@/src/comps/Screen/Screen";
import { ScreenCard } from "@/src/comps/Screen/ScreenCard";
import { Spinner } from "@/src/comps/Spinner/Spinner";
import content from "@/src/content";
import { getBranch, isEarnPositionActive, useEarnPool, useEarnPosition } from "@/src/liquity-utils";
import { useAccount } from "@/src/wagmi-utils";
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
  const earnPosition = useEarnPosition(branch.id, account.address ?? null);
  const earnPool = useEarnPool(branch.id);

  const active = isEarnPositionActive(earnPosition.data ?? null);

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

  return (
    <Screen
      ready={loadingState === "success"}
      back={{
        href: "/earn",
        label: content.earnScreen.backButton,
      }}
      heading={
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: 24,
          })}
        >
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
          {active && (
            <div
              className={css({
                display: "flex",
                flexDirection: "column",
                gap: 32,
                marginBottom: -24,
                padding: 16,
                textAlign: "center",
                textWrap: "balance",
                color: "content",
                background: "infoSurface",
                border: "1px solid token(colors.infoSurfaceBorder)",
                borderRadius: 8,
              })}
            >
              Please withdraw your Earn position. See the top banner for more information.
            </div>
          )}
        </div>
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
            {active
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
                <p
                  className={css({
                    fontSize: 18,
                    textAlign: "center",
                  })}
                >
                  Stability Pool (“Earn”) deposits are disabled, see top banner.
                </p>
              )}
            {tab.action === "deposit" && active && (
              <PanelUpdateDeposit
                branchId={branch.id}
                deposited={earnPool.data.totalDeposited ?? dn.from(0, 18)}
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
