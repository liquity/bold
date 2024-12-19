"use client";

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

import { css, cx } from "../../styled-system/css";

export function VFlex({
  alignItems,
  children,
  className,
  gap = 8,
  justifyContent,
  style = {},
  ...props
}: {
  alignItems?: CSSProperties["alignItems"];
  children: ReactNode;
  gap?: number;
  justifyContent?: CSSProperties["justifyContent"];
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        className,
        css({
          display: "flex",
          flexDirection: "column",
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
