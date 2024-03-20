import type { ComponentPropsWithoutRef } from "react";

import { css } from "@/styled-system/css";

export function TextButton({
  label,
  ...props
}: ComponentPropsWithoutRef<"button"> & {
  label: string;
}) {
  return (
    <button
      {...props}
      className={css({
        display: "inline",
        fontSize: 16,
        color: "accent",
        cursor: "pointer",
        _active: {
          transform: "translateY(1px)",
        },
      })}
    >
      {label}
    </button>
  );
}
