"use client";

import type { ComponentProps, ReactElement } from "react";
import type { ExternalToken, TokenSymbol } from "../tokens";

import { Children, createContext, useContext, useEffect, useState } from "react";
import { match } from "ts-pattern";
import { css } from "../../styled-system/css";
import tokenDefault from "../token-icons/default.svg";
import { TOKENS_BY_SYMBOL } from "../tokens";

export function TokenIcon({
  size = "medium",
  symbol,
  title,
  token,
}:
  & {
    size?: "medium" | "large" | "small" | "mini" | number;
    title?: string | null;
  }
  & (
    | { symbol: TokenSymbol; token?: never }
    | { symbol?: never; token: ExternalToken }
  ))
{
  const sizeFromGroup = useContext(TokenIconGroupSize);

  const size_ = match(sizeFromGroup ?? size)
    .with("large", () => 40)
    .with("medium", () => 24)
    .with("small", () => 20)
    .with("mini", () => 16)
    .otherwise(() => size);

  const token_ = symbol
    ? TOKENS_BY_SYMBOL[symbol]
    : token;

  const tokenUrl = token_.icon;
  const [tokenUrlReady, setUrl] = useState(tokenDefault);
  useEffect(() => {
    const img = new Image();
    img.src = tokenUrl;
    img.onload = () => setUrl(tokenUrl);
    img.onerror = () => setUrl(tokenDefault);
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [tokenUrl]);

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
        alt={token_.name}
        height={size_}
        src={tokenUrlReady}
        title={title === undefined ? token_.name : title ?? undefined}
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
      className={css({
        display: "flex",
        justifyContent: "center",
        gap: 0,
      })}
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
