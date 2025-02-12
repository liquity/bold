"use client";

import type { CollIndex } from "@/src/types";

import { EarnPositionSummary } from "@/src/comps/EarnPositionSummary/EarnPositionSummary";
import { Screen } from "@/src/comps/Screen/Screen";
import content from "@/src/content";
import { getContracts } from "@/src/contracts";
import { useEarnPosition } from "@/src/liquity-utils";
import { useAccount } from "@/src/services/Arbitrum";
import { css } from "@/styled-system/css";
import { TokenIcon } from "@liquity2/uikit";
import { a, useTransition } from "@react-spring/web";

export function EarnPoolsListScreen() {
  const { collaterals } = getContracts();

  const poolsTransition = useTransition(
    collaterals.map((c) => c.collIndex),
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
                  "USDN" as const,
                  ...collaterals.map((coll) => coll.symbol),
                ].map((symbol) => (
                  <TokenIcon key={symbol} symbol={symbol} />
                ))}
              </TokenIcon.Group>,
              <TokenIcon symbol='USDN' />
            )}
          </div>
        ),
        subtitle: content.earnHome.subheading,
      }}
      width={67 * 8}
      gap={16}
    >
      {poolsTransition((style, collIndex) => (
        <a.div style={style}>
          <EarnPool collIndex={collIndex} />
        </a.div>
      ))}
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
