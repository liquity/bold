import type { ComponentPropsWithoutRef } from "react";

import { match } from "ts-pattern";
import { css } from "../../styled-system/css";
import { useTheme } from "../Theme/Theme";

export function Button({
  size = "medium",
  label,
  maxWidth,
  wide,
  mode = "secondary",
  ...props
}: ComponentPropsWithoutRef<"button"> & {
  size?: "medium" | "large";
  label: string;
  maxWidth?: number;
  wide?: boolean;
  mode?: "primary" | "secondary" | "positive" | "negative";
}) {
  const { color } = useTheme();

  const geometry = match(size)
    .with("medium", () => ({
      height: 40,
      padding: "0 16px",
      fontSize: 14,
      borderRadius: 20,
    }))
    .with("large", () => ({
      height: 74,
      padding: "0 32px",
      fontSize: 24,
      borderRadius: 120,
    }))
    .exhaustive();

  const colors = match(mode)
    .with("secondary", () => ({
      color: color("secondaryContent"),
      background: color("secondary"),
    }))
    .with("primary", () => ({
      color: color("accentContent"),
      background: color("accent"),
    }))
    .with("positive", () => ({
      color: color("positiveContent"),
      background: color("positive"),
    }))
    .with("negative", () => ({
      color: color("negativeContent"),
      background: color("negative"),
    }))
    .exhaustive();

  return (
    <button
      {...props}
      className={css({
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        whiteSpace: "nowrap",
        color: "white",
        cursor: "pointer",
        _active: {
          _enabled: {
            translate: "0 1px",
          },
        },
        _disabled: {
          background: "rain",
          cursor: "not-allowed",
        },
        _focusVisible: {
          outline: "2px solid token(colors.focused)",
        },
      })}
      style={{
        maxWidth,
        width: wide ? "100%" : undefined,
        ...colors,
        ...geometry,
      }}
    >
      {label}
    </button>
  );
}
