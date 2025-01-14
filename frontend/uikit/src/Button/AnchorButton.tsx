"use client";

import type { ComponentPropsWithRef } from "react";
import type { ButtonProps } from "./Button";

import { forwardRef } from "react";
import { useButtonStyles } from "./Button";

export const AnchorButton = forwardRef<
  HTMLAnchorElement,
  ComponentPropsWithRef<"a"> & ButtonProps & {
    external?: boolean;
  }
>(function AnchorButton({
  external,
  label,
  maxWidth,
  mode = "secondary",
  shape,
  size = "medium",
  wide,
  ...props
}, ref) {
  const buttonStyles = useButtonStyles({ mode, shape, size });
  const externalProps = !external ? {} : {
    target: "_blank",
    rel: "noopener noreferrer",
  };
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
      {...externalProps}
      {...props}
    >
      {label}
    </a>
  );
});
