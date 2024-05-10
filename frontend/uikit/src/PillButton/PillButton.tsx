import type { ComponentPropsWithoutRef } from "react";

import { css } from "../../styled-system/css";

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
      <div
        className={css({
          width: 12,
          height: 12,
          borderRadius: "50%",
          "--warn-color-low": "token(colors.positive)",
          "--warn-color-medium": "token(colors.warning)",
          "--warn-color-high": "token(colors.negative)",
        })}
        style={{
          background: `var(--warn-color-${warnLevel})`,
        }}
      />
      <div>
        {label}
      </div>
    </button>
  );
}
