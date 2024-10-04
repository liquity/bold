"use client";

import { EarnPosition } from "@/src/comps/EarnPosition/EarnPosition";
import { Screen } from "@/src/comps/Screen/Screen";
import content from "@/src/content";
import { useCollateralContracts } from "@/src/contracts";
import { useAccount } from "@/src/services/Ethereum";
import { css } from "@/styled-system/css";
import { TokenIcon } from "@liquity2/uikit";

export function EarnPoolsListScreen() {
  const account = useAccount();
  const collSymbols = useCollateralContracts().map((coll) => coll.symbol);
  return (
    <Screen
      title={
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
      }
      subtitle={content.earnHome.subheading}
      width={67 * 8}
      gap={16}
    >
      {collSymbols.map((symbol) => (
        <EarnPosition
          key={symbol}
          address={account?.address}
          collSymbol={symbol}
          linkToScreen
        />
      ))}
    </Screen>
  );
}
