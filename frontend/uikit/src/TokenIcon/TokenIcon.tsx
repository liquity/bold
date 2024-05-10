import type { ComponentProps, ReactElement } from "react";

import { Children, createContext, useContext } from "react";
import { match } from "ts-pattern";
import { css } from "../../styled-system/css";

import tokenBold from "./icons/bold.svg";
import tokenEth from "./icons/eth.svg";
import tokenLqty from "./icons/lqty.svg";
import tokenOseth from "./icons/oseth.svg";
import tokenReth from "./icons/reth.svg";
import tokenSweth from "./icons/sweth.svg";
import tokenWsteth from "./icons/wsteth.svg";

export function TokenIcon({
  size = "medium",
  symbol,
}: {
  size?: "medium" | "large" | "small" | number;
  symbol: "BOLD" | "ETH" | "OSETH" | "RETH" | "SWETH" | "WSTETH" | "LQTY";
}) {
  const sizeFromGroup = useContext(TokenIconGroupSize);

  const size_ = match(sizeFromGroup ?? size)
    .with("large", () => 40)
    .with("medium", () => 24)
    .with("small", () => 20)
    .otherwise(() => size);

  const src = match(symbol)
    .with("BOLD", () => tokenBold)
    .with("ETH", () => tokenEth)
    .with("OSETH", () => tokenOseth)
    .with("RETH", () => tokenReth)
    .with("SWETH", () => tokenSweth)
    .with("WSTETH", () => tokenWsteth)
    .with("LQTY", () => tokenLqty)
    .exhaustive();

  return (
    <div
      className={css({
        display: "flex",
      })}
      style={{
        height: size_,
        width: size_,
      }}
    >
      <img
        alt={symbol}
        height={size_}
        src={src}
        title={symbol}
        width={size_}
      />
    </div>
  );
}

type Size = ComponentProps<typeof TokenIcon>["size"];

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
