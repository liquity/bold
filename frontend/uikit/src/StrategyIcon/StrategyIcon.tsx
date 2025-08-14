"use client";

import type { ComponentProps, ReactElement } from "react";
import type { Strategy } from "../types";

import { Children, createContext, useContext } from "react";
import { match } from "ts-pattern";
import { css } from "../../styled-system/css";
import { STRATEGIES_BY_ID } from "../strategies";

export function StrategyIcon({
  size = "medium",
  id,
  title,
}: {
  size?: "medium" | "large" | "small" | "mini" | number;
  id: Strategy["id"];
  title?: string | null;
}) {
  const sizeFromGroup = useContext(StrategyIconGroupSize);

  const size_ = match(sizeFromGroup ?? size)
    .with("large", () => 40)
    .with("medium", () => 24)
    .with("small", () => 20)
    .with("mini", () => 16)
    .otherwise(() => size);

  const strategy = STRATEGIES_BY_ID[id];

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
        alt={strategy.name}
        height={size_}
        src={strategy.icon}
        title={title === undefined ? strategy.name : title ?? undefined}
        width={size_}
        style={{
          borderRadius: "50%",
          backgroundColor: id === "camelot" ? "black" : "transparent",
        }}
      />
    </div>
  );
}

type Size = ComponentProps<typeof StrategyIcon>["size"];

const StrategyIconGroupSize = createContext<Size | undefined>(undefined);

export function StrategyIconGroup<
  C extends ReactElement<ComponentProps<typeof StrategyIcon>>,
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
      <StrategyIconGroupSize.Provider value={size}>
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
      </StrategyIconGroupSize.Provider>
    </div>
  );
}

StrategyIcon.Group = StrategyIconGroup;
