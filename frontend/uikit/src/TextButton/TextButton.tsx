import type { ComponentPropsWithoutRef } from "react";

import { css } from "../../styled-system/css";

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
        borderRadius: 4,
        cursor: "pointer",
        _focusVisible: {
          outline: "2px solid token(colors.focused)",
        },
        _active: {
          translate: "0 1px",
        },
      })}
    >
      {label}
    </button>
  );
}
