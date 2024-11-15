"use client";

import type { CollIndex } from "@/src/types";

import { EarnPositionSummary } from "@/src/comps/EarnPositionSummary/EarnPositionSummary";
import { Screen } from "@/src/comps/Screen/Screen";
import content from "@/src/content";
import { getContracts } from "@/src/contracts";
import { useEarnPosition } from "@/src/liquity-utils";
import { useAccount } from "@/src/services/Ethereum";
import { css } from "@/styled-system/css";
import { TokenIcon } from "@liquity2/uikit";

export function EarnPoolsListScreen() {
  const { collaterals } = getContracts();
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
                {["BOLD" as const, ...collaterals.map((coll) => coll.symbol)].map((symbol) => (
                  <TokenIcon
                    key={symbol}
                    symbol={symbol}
                  />
                ))}
              </TokenIcon.Group>,
              <TokenIcon symbol="BOLD" />,
            )}
          </div>
        ),
        subtitle: content.earnHome.subheading,
      }}
      width={67 * 8}
      gap={16}
    >
      {collaterals.map(({ collIndex }) => (
        <EarnPool
          key={collIndex}
          collIndex={collIndex}
        />
      ))}
    </Screen>
  );
}

function EarnPool({
  collIndex,
}: {
  collIndex: CollIndex;
}) {
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
