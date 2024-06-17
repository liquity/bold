import type { ComponentPropsWithRef } from "react";
import type { ButtonProps } from "./Button";

import { forwardRef } from "react";
import { useButtonStyles } from "./Button";

export const AnchorButton = forwardRef<HTMLAnchorElement, ComponentPropsWithRef<"a"> & ButtonProps>(
  function AnchorButton({
    size = "medium",
    label,
    maxWidth,
    wide,
    mode = "secondary",
    ...props
  }, ref) {
    const buttonStyles = useButtonStyles(size, mode);
    return (
      <a
        ref={ref}
        className={buttonStyles.className}
        style={{
          display: "inline-flex",
          maxWidth,
          width: wide ? "100%" : undefined,
          ...buttonStyles.styles,
        }}
        {...props}
      >
        {label}
      </a>
    );
  },
);
