"use client";

import type { ComponentPropsWithoutRef } from "react";

import { match } from "ts-pattern";
import { css } from "../../styled-system/css";
import { StatusDot } from "../StatusDot/StatusDot";

export function PillButton({
  label,
  warnLevel,
  ...props
}: ComponentPropsWithoutRef<"button"> & {
  label: string;
  warnLevel: "low" | "medium" | "high";
}) {
  return (
    <button
      {...props}
      className={css({
        display: "flex",
        alignItems: "center",
        gap: 8,
        height: 24,
        padding: "0 10px",
        fontSize: 14,
        fontWeight: 500,
        color: "content",
        background: "controlSurface",
        border: "1px dashed token(colors.controlBorder)",
        borderRadius: 12,
        cursor: "pointer",
        _focusVisible: {
          outline: "2px solid token(colors.focused)",
          outlineOffset: -1,
        },
        _active: {
          translate: "0 1px",
        },
      })}
    >
      <StatusDot
        mode={match(warnLevel)
          .with("low", () => "positive" as const)
          .with("medium", () => "warning" as const)
          .with("high", () => "negative" as const)
          .exhaustive()}
      />
      <div>
        {label}
      </div>
    </button>
  );
}
