"use client";

import { EarnPositionSummary } from "@/src/comps/EarnPositionSummary/EarnPositionSummary";
import { Screen } from "@/src/comps/Screen/Screen";
import content from "@/src/content";
import { getContracts } from "@/src/contracts";
import { useAccount } from "@/src/services/Ethereum";
import { css } from "@/styled-system/css";
import { TokenIcon } from "@liquity2/uikit";

export function EarnPoolsListScreen() {
  const account = useAccount();

  const { collaterals } = getContracts();
  const collSymbols = collaterals.map((coll) => coll.symbol);

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
                {["BOLD" as const, ...collSymbols].map((symbol) => (
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
      {collSymbols.map((symbol) => (
        <EarnPositionSummary
          key={symbol}
          address={account?.address}
          collSymbol={symbol}
          linkToScreen
        />
      ))}
    </Screen>
  );
}
