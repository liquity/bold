"use client";

import type { StatusMode } from "../types";

import { css } from "../../styled-system/css";

export function StatusDot({
  size = 12,
  mode,
}: {
  size?: number;
  mode: StatusMode;
}) {
  return (
    <div
      className={css({
        borderRadius: "50%",
        "--status-dot-positive": "token(colors.positiveAlt)",
        "--status-dot-warning": "token(colors.warning)",
        "--status-dot-negative": "token(colors.negative)",
        "--status-dot-neutral": "token(colors.contentAlt2)",
      })}
      style={{
        background: `var(--status-dot-${mode})`,
        height: size,
        width: size,
      }}
    />
  );
}
