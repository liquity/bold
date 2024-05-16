import type { ComponentPropsWithoutRef } from "react";

import { match, P } from "ts-pattern";
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
  size?: "mini" | "small" | "medium" | "large";
  label: string;
  maxWidth?: number;
  wide?: boolean;
  mode?: "primary" | "secondary" | "tertiary" | "positive" | "negative";
}) {
  const { color } = useTheme();

  const geometry = match(size)
    .with("mini", () => ({
      height: 26,
      padding: "0 6px",
      fontSize: 14,
      borderRadius: 8,
    }))
    .with("small", () => ({
      height: 34,
      padding: "0 8px",
      fontSize: 14,
      borderRadius: 8,
    }))
    .with("medium", () => ({
      height: 40,
      padding: "0 14px",
      fontSize: 16,
      borderRadius: 20,
    }))
    .with("large", () => ({
      height: 74,
      padding: "0 30px",
      fontSize: 24,
      borderRadius: 120,
    }))
    .exhaustive();

  const colors = match(mode)
    .with("primary", () => ({
      "--color": color("accentContent"),
      "--background": color("accent"),
      "--backgroundHover": color("accentHint"),
      "--backgroundPressed": color("accentActive"),
    }))
    .with(P.union("secondary", "tertiary"), (mode) => ({
      "--color": color("secondaryContent"),
      "--background": mode === "secondary" ? color("secondary") : "transparent",
      "--backgroundHover": color("secondaryHint"),
      "--backgroundPressed": color("secondaryActive"),
    }))
    .with("negative", () => ({
      "--color": color("negativeContent"),
      "--background": color("negative"),
      "--backgroundHover": color("negativeHint"),
      "--backgroundPressed": color("negativeActive"),
    }))
    .with("positive", () => ({
      "--color": color("positiveContent"),
      "--background": color("positive"),
      "--backgroundHover": color("positiveHint"),
      "--backgroundPressed": color("positiveActive"),
    }))
    .exhaustive();

  return (
    <button
      className={css({
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        whiteSpace: "nowrap",
        cursor: "pointer",
        transition: "background 50ms",
        _enabled: {
          color: "var(--color)",
          background: {
            base: "var(--background)",
            _hover: "var(--backgroundHover)",
            _active: "var(--backgroundPressed)",
          },
        },
        _disabled: {
          color: "disabledContent",
          background: "disabledSurface",
          cursor: "not-allowed",
          border: "1px solid token(colors.disabledBorder)",
        },
        _active: {
          _enabled: {
            translate: "0 1px",
          },
        },
        _focusVisible: {
          outline: "2px solid token(colors.focused)",
        },
      })}
      style={{
        maxWidth,
        width: wide ? "100%" : undefined,
        outlineOffset: mode === "primary" ? 2 : 0, // primary mode background === focus ring color
        ...colors,
        ...geometry,
      }}
      {...props}
    >
      <span
        style={{
          // prevents a jump due to the border when the button gets disabled
          padding: props.disabled ? 0 : "0 1px",
        }}
      >
        {label}
      </span>
    </button>
  );
}
