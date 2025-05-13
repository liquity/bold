"use client";

import type { ComponentPropsWithoutRef, ReactNode, Ref } from "react";

import { css, cx } from "../../styled-system/css";

export type TextButtonProps = {
  label: ReactNode;
  size?: "small" | "medium" | "large";
};

export function TextButton({
  className,
  label,
  ref,
  size,
  style,
  ...props
}:
  & ComponentPropsWithoutRef<"button">
  & TextButtonProps
  & {
    ref?: Ref<HTMLButtonElement>;
  })
{
  const textButtonStyles = useTextButtonStyles(size);
  return (
    <button
      ref={ref}
      className={cx(
        textButtonStyles.className,
        className,
      )}
      style={{
        ...textButtonStyles.style,
        ...style,
      }}
      {...props}
    >
      {label}
    </button>
  );
}

export function useTextButtonStyles(size: TextButtonProps["size"] = "medium") {
  const className = css({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontWeight: 500,
    color: "accent",
    borderRadius: 4,
    cursor: "pointer",
    _focusVisible: {
      outline: "2px solid token(colors.focused)",
    },
    _active: {
      translate: "0 1px",
    },
  });

  const style = {
    fontSize: size === "large"
      ? 24
      : size === "small"
      ? 14
      : 16,
  };

  return {
    className,
    style,
  };
}
