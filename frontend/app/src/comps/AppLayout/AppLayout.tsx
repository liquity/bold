"use client";

import type { ReactNode } from "react";

import { Banner } from "@/Banner";
import { LegacyPositionsBanner } from "@/src/comps/LegacyPositionsBanner/LegacyPositionsBanner";
import { SafetyModeBanner } from "@/src/comps/SafetyModeBanner/SafetyModeBanner";
import { ShutdownModeBanner } from "@/src/comps/ShutdownModeBanner/ShutdownModeBanner";
import { SubgraphDownBanner } from "@/src/comps/SubgraphDownBanner/SubgraphDownBanner";
import { V1StabilityPoolBanner } from "@/src/comps/V1StabilityPoolBanner/V1StabilityPoolBanner";
import { V1StakingBanner } from "@/src/comps/V1StakingBanner/V1StakingBanner";
import { LEGACY_CHECK, SAFETY_MODE_CHECK, SUBGRAPH_CHECK, V1_STABILITY_POOL_CHECK, V1_STAKING_CHECK } from "@/src/env";
import { css } from "@/styled-system/css";
import { BottomBar } from "./BottomBar";
import { TopBar } from "./TopBar";

export const LAYOUT_WIDTH = 1092;

export function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      className={css({
        position: "relative",
        zIndex: 1,
        display: "grid",
        gridTemplateRows: "auto 1fr",
        minHeight: "100vh",
        minWidth: "fit-content",
        height: "100%",
        background: "background",
      })}
    >
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          width: "100%",
        })}
      >
        {V1_STAKING_CHECK && <V1StakingBanner />}
        {V1_STABILITY_POOL_CHECK && <V1StabilityPoolBanner />}
        {LEGACY_CHECK && <LegacyPositionsBanner />}
        {SUBGRAPH_CHECK && <SubgraphDownBanner />}
        {SAFETY_MODE_CHECK && <SafetyModeBanner />}
        {SAFETY_MODE_CHECK && <ShutdownModeBanner />}
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: 1,
            width: "100%",
          })}
        >
          <Banner />
        </div>
      </div>
      <div
        className={css({
          display: "grid",
          gridTemplateRows: "auto 1fr auto",
          gap: {
            base: 24,
            large: 48,
          },
          maxWidth: `calc(${LAYOUT_WIDTH}px + 48px)`,
          margin: "0 auto",
          width: "100%",
        })}
      >
        <TopBar />
        <div
          className={css({
            width: "100%",
            minHeight: 0,
            padding: {
              base: "0 12px",
              medium: "0 24px",
            },
            medium: {
              maxWidth: "100%",
            },
          })}
        >
          {children}
        </div>
        <BottomBar />
      </div>
    </div>
  );
}
