"use client";

import type { ComponentProps, ReactElement } from "react";
import type { Token } from "../types";

import { Children, createContext, useContext } from "react";
import { match } from "ts-pattern";
import { css } from "../../styled-system/css";
import { TOKENS_BY_SYMBOL } from "../tokens";

export function TokenIcon({
  size = "medium",
  symbol,
  title,
}: {
  size?: "medium" | "large" | "small" | "mini" | number;
  symbol: Token["symbol"];
  title?: string | null;
}) {
  const sizeFromGroup = useContext(TokenIconGroupSize);

  const size_ = match(sizeFromGroup ?? size)
    .with("large", () => 40)
    .with("medium", () => 24)
    .with("small", () => 20)
    .with("mini", () => 16)
    .otherwise(() => size);

  const token = TOKENS_BY_SYMBOL[symbol];

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
        alt={token.name}
        height={size_}
        src={token.icon}
        title={title === undefined ? token.name : title ?? undefined}
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
        {Children.map(children, (child, index) => (
          <div
            key={index}
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
