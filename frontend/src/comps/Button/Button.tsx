import type { ComponentPropsWithoutRef } from "react";

import { css } from "@/styled-system/css";

export function Button({
  label,
  maxWidth,
  ...props
}: ComponentPropsWithoutRef<"button"> & {
  label: string;
  maxWidth?: number;
}) {
  return (
    <button
      {...props}
      className={css({
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: 74,
        color: "white",
        fontSize: 24,
        background: "#121B44",
        borderRadius: 120,
        cursor: "pointer",
        _active: {
          translate: "0 1px",
        },
      })}
      style={{ maxWidth }}
    >
      {label}
    </button>
  );
}
