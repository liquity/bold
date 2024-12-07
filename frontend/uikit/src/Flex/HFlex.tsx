"use client";

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

import { css, cx } from "../../styled-system/css";

export function HFlex({
  alignItems = "center",
  children,
  className,
  gap = 8,
  justifyContent = "center",
  style = {},
  ...props
}: {
  alignItems?: CSSProperties["alignItems"];
  children: ReactNode;
  className?: string;
  gap?: number;
  justifyContent?: CSSProperties["justifyContent"];
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        className,
        css({
          display: "flex",
          flexDirection: "row",
        }),
      )}
      style={{
        ...style,
        alignItems,
        gap,
        justifyContent,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
