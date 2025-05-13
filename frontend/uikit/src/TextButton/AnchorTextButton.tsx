"use client";

import type { ComponentPropsWithRef, ComponentType } from "react";
import type { TextButtonProps } from "./TextButton";

import { createElement } from "react";
import { cx } from "../../styled-system/css";
import { useTextButtonStyles } from "./TextButton";

export function AnchorTextButton({
  AnchorComponent,
  className,
  external,
  label,
  ref,
  size,
  ...props
}: ComponentPropsWithRef<"a"> & TextButtonProps & {
  AnchorComponent?: ComponentType<ComponentPropsWithRef<"a">>;
  external?: boolean;
}) {
  const textButtonStyles = useTextButtonStyles(size);
  const externalProps = !external ? {} : {
    target: "_blank",
    rel: "noopener noreferrer",
  };
  return createElement(AnchorComponent ?? "a", {
    className: cx(textButtonStyles.className, className),
    ref,
    ...externalProps,
    ...props,
  }, label);
}
