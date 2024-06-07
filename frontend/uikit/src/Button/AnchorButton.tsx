import type { ComponentPropsWithoutRef } from "react";
import type { ButtonProps } from "./Button";

import { useButtonStyles } from "./Button";

export function AnchorButton({
  size = "medium",
  label,
  maxWidth,
  wide,
  mode = "secondary",
  ...props
}: ComponentPropsWithoutRef<"a"> & ButtonProps) {
  const buttonStyles = useButtonStyles(size, mode);
  return (
    <a
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
}
