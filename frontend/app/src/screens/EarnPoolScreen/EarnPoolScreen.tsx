"use client";

import { NBSP } from "@/src/characters";
import { useBreakpointName } from "@/src/breakpoints";
import { Screen } from "@/src/comps/Screen/Screen";
import { WHITE_LABEL_CONFIG } from "@/src/white-label.config";
import content from "@/src/content";
import { DNUM_0 } from "@/src/dnum-utils";
import { getBranch, useEarnPool, useEarnPosition } from "@/src/liquity-utils";
import { useWait } from "@/src/react-utils";
import { useAccount } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";
import { isCollateralSymbol, Tabs, TokenIcon } from "@liquity2/uikit";
import { a, useTransition } from "@react-spring/web";
import { useParams, useRouter } from "next/navigation";
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
  const isMobile = breakpointName === "small";

  return (
    <>
      <div
        className={css({
          position: "relative",
          width: "100%",
          marginTop: -96,
          paddingTop: 96,
          marginBottom: -180,
        })}
      >
        <div
          className={`borrow-heading-background ${css({
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "100vw",
            height: "100%",
            zIndex: -1,
            backgroundPosition: "center top",
            _after: {
              content: '""',
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "50%",
              background: "linear-gradient(to bottom, transparent, black)",
            },
          })}`}
        />
        
        <div
          className={css({
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px 0 80px",
            minHeight: "420px",
            maxWidth: "1200px",
            margin: "0 auto",
            width: "100%",
          })}
        >
          <h1
            className={`font-audiowide ${css({
              color: "white",
              fontSize: { base: '28px', medium: '37px' },
              textAlign: "center",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 0,
            })}`}
          >
            Deposit{" "}
            <span
              className={css({
                display: "inline-flex",
                alignItems: "center",
                whiteSpace: "nowrap",
              })}
            >
              {WHITE_LABEL_CONFIG.tokens.mainToken.symbol}{NBSP}<TokenIcon symbol={WHITE_LABEL_CONFIG.tokens.mainToken.symbol} size={isMobile ? 32 : 46} />
            </span>
            <br />
            <span
              className={css({
                display: "inline-flex",
                alignItems: "center",
                whiteSpace: "nowrap",
                fontSize: { base: '17px', medium: '20px' },
                gap: "8px",
              })}
            >
              with
              <TokenIcon symbol={collateralSymbol} />
            </span>
          </h1>
        </div>
      </div>

      <Screen
        ready={loadingState === "success"}
        back={{
          href: "/earn",
          label: content.earnScreen.backButton,
        }}
        heading={null}
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
    </>
  );
}
