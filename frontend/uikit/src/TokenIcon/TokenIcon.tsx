import type { ComponentProps, ReactElement, ReactNode } from "react";

import { Children } from "react";
import { css } from "../../styled-system/css";
import tokenBold from "./icons/BOLD.svg";
import tokenEth from "./icons/ETH.svg";
import tokenOseth from "./icons/OSETH.svg";
import tokenReth from "./icons/RETH.svg";
import tokenSweth from "./icons/SWETH.svg";
import tokenWsteth from "./icons/WSTETH.svg";

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

export function TokenIcon({ symbol }: { symbol: IconName }) {
  return (
    <img
      title={symbol}
      alt={symbol}
      height={24}
      src={srcFromName(symbol)}
      width={24}
    />
  );
}

TokenIcon.Group = function TokenIconGroup<
  C extends ReactElement<ComponentProps<typeof TokenIcon>>,
>({
  children,
}: {
  children: C | C[];
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        gap: -8,
      }}
    >
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
    </div>
  );
};
