import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { forwardRef } from "react";
import { css } from "../../styled-system/css";

export const TextButton = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<"button"> & {
    label: ReactNode;
  }
>(function TextButton({
  label,
  ...props
}, ref) {
  return (
    <button
      ref={ref}
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
});
