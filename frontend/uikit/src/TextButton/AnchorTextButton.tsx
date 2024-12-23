"use client";

import type { ComponentPropsWithRef } from "react";
import type { TextButtonProps } from "./TextButton";

import { forwardRef } from "react";
import { cx } from "../../styled-system/css";
import { useTextButtonStyles } from "./TextButton";

export const AnchorTextButton = forwardRef<
  HTMLAnchorElement,
  ComponentPropsWithRef<"a"> & TextButtonProps & {
    external?: boolean;
  }
>(function AnchorTextButton({
  external,
  label,
  size,
  className,
  ...props
}, ref) {
  const textButtonStyles = useTextButtonStyles(size);
  const externalProps = !external ? {} : {
    target: "_blank",
    rel: "noopener noreferrer",
  };
  return (
    <a
      ref={ref}
      className={cx(
        textButtonStyles.className,
        className,
      )}
      {...externalProps}
      {...props}
    >
      {label}
    </a>
  );
});
