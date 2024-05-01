import type { ComponentProps, ReactElement } from "react";

import { Children, createContext, useContext } from "react";
import { css } from "../../styled-system/css";
import tokenBold from "./icons/bold.svg";
import tokenEth from "./icons/eth.svg";
import tokenOseth from "./icons/oseth.svg";
import tokenReth from "./icons/reth.svg";
import tokenSweth from "./icons/sweth.svg";
import tokenWsteth from "./icons/wsteth.svg";

export type IconName = "BOLD" | "ETH" | "OSETH" | "RETH" | "SWETH" | "WSTETH";

function srcFromName(name: IconName) {
  if (name === "BOLD") return tokenBold;
  if (name === "ETH") return tokenEth;
  if (name === "OSETH") return tokenOseth;
  if (name === "RETH") return tokenReth;
  if (name === "SWETH") return tokenSweth;
  if (name === "WSTETH") return tokenWsteth;
  throw new Error(`Unsupported token icon: ${name}`);
}

type Size = "medium" | "large" | number;

function getSizeValue(size: Size) {
  if (size === "large") return 40;
  if (size === "medium") return 24;
  return size;
}

export function TokenIcon({
  size = "medium",
  symbol,
}: {
  size?: Size;
  symbol: IconName;
}) {
  const sizeFromGroup = useContext(TokenIconGroupSize);
  const sizeValue = getSizeValue(sizeFromGroup ?? size);
  return (
    <img
      alt={symbol}
      height={sizeValue}
      src={srcFromName(symbol)}
      title={symbol}
      width={sizeValue}
    />
  );
}

const TokenIconGroupSize = createContext<Size | undefined>(undefined);

export function TokenIconGroup<
  C extends ReactElement<ComponentProps<typeof TokenIcon>>,
>({
  children,
  size,
}: {
  children: C | C[];
  size?: Size;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        gap: 0,
      }}
    >
      <TokenIconGroupSize.Provider value={size}>
        {Children.map(children, (child) => (
          <div
            className={css({
              marginLeft: -4,
              _firstOfType: {
                marginLeft: 0,
              },
            })}
          >
            {child}
          </div>
        ))}
      </TokenIconGroupSize.Provider>
    </div>
  );
}

TokenIcon.Group = TokenIconGroup;
