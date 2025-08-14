"use client";

import type { CollIndex } from "@/src/types";

import { EarnPositionSummary } from "@/src/comps/EarnPositionSummary/EarnPositionSummary";
import { YusndPositionSummary } from "@/src/comps/EarnPositionSummary/YusndPositionSummary";
import { Screen } from "@/src/comps/Screen/Screen";
import content from "@/src/content";
import { getContracts } from "@/src/contracts";
import { useEarnPosition } from "@/src/liquity-utils";
import { useAccount } from "@/src/services/Arbitrum";
import { css } from "@/styled-system/css";
import { StrategyIcon, StrategyIconGroup, StrategyId, TokenIcon } from "@liquity2/uikit";
import { a, useTransition } from "@react-spring/web";
import { isYusndEnabled, useYusndPosition } from "@/src/yusnd";
import { BREAKPOINTS, useBreakpointName } from "@/src/breakpoints";
import { PartnerStrategySummary } from "@/src/comps/EarnPositionSummary/PartnerStrategySummary";
import { SubScreen } from "@/src/comps/Screen/SubScreen";

type PoolId = CollIndex | "yusnd";

export function EarnPoolsListScreen() {
  const { collaterals } = getContracts();
  const bpName = useBreakpointName();

  let pools: PoolId[] = collaterals.map((c) => c.collIndex);
  let strategies: StrategyId[] = ["bunni", "camelot", "spectra", "teller"];

  if (isYusndEnabled()) {
    pools = ["yusnd", ...pools];
  }

  const poolsTransition = useTransition(
    pools,
    {
      from: { opacity: 0, transform: "scale(1.1) translateY(64px)" },
      enter: { opacity: 1, transform: "scale(1) translateY(0px)" },
      leave: { opacity: 0, transform: "scale(1) translateY(0px)" },
      trail: 80,
      config: {
        mass: 1,
        tension: 1800,
        friction: 140,
      },
    }
  );

  const strategiesTransition = useTransition(
    strategies,
    {
      from: { opacity: 0, transform: "scale(1.1) translateY(64px)" },
      enter: { opacity: 1, transform: "scale(1) translateY(0px)" },
      leave: { opacity: 0, transform: "scale(1) translateY(0px)" },
      trail: 80,
      config: {
        mass: 1,
        tension: 1800,
        friction: 140,
      },
    }
  );

  return (
    <Screen
      heading={{
        title: (
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            })}
          >
            {content.earnHome.headline(
              <TokenIcon.Group>
                {[
                  "USND" as const,
                  ...collaterals.map((coll) => coll.symbol),
                ].map((symbol) => (
                  <TokenIcon key={symbol} symbol={symbol} />
                ))}
              </TokenIcon.Group>,
              <TokenIcon symbol='USND' />
            )}
          </div>
        ),
        subtitle: content.earnHome.subheading,
      }}
      // width={67 * 8}
      width={BREAKPOINTS[bpName]}
      gap={16}
    >
      <div className={css({
        display: "grid",
        gridTemplateColumns: bpName === "large" ? "repeat(2, 1fr)" : "repeat(1, 1fr)",
        gap: 16,
      })}>
        {poolsTransition((style, poolId) => (
          <a.div style={style}>
            {poolId === "yusnd"
                ? <YusndPool />
                : <EarnPool collIndex={poolId} />}
          </a.div>
        ))}
      </div>
      <SubScreen
        heading={{
          title: (
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              })}
            >
              {content.earnHome.strategySection.headline(
                <StrategyIconGroup>
                  {[
                    "bunni" as const,
                    "camelot" as const,
                    "spectra" as const,
                    "teller" as const,
                  ].map((strategy) => (
                    <StrategyIcon key={strategy} id={strategy} />
                  ))}
                </StrategyIconGroup>,
              )}
            </div>
          ),
          subtitle: content.earnHome.strategySection.subheading,
        }}
        gap={32}
        paddingTop={24}
      >
        <div className={css({
          display: "grid",
          gridTemplateColumns: bpName === "large" ? "repeat(4, 1fr)" : "repeat(2, 1fr)",
          gap: 16,
        })}>
          {strategiesTransition((style, strategyId) => (
            <a.div style={style}>
              <PartnerStrategySummary strategy={strategyId} />
            </a.div>
          ))}
        </div>
      </SubScreen>
    </Screen>
  );
}

function EarnPool({ collIndex }: { collIndex: CollIndex }) {
  const account = useAccount();
  const earnPosition = useEarnPosition(collIndex, account.address ?? null);
  return (
    <EarnPositionSummary
      collIndex={collIndex}
      earnPosition={earnPosition.data}
      linkToScreen
    />
  );
}

function YusndPool() {
  const account = useAccount();
  const yusndPosition = useYusndPosition(account.address ?? null);
  return (
    <YusndPositionSummary
      linkToScreen
      yusndPosition={yusndPosition.data ?? null}
    />
  );
}