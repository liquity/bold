"use client";

import type { ComponentPropsWithoutRef } from "react";

import { useId } from "react";
import { css, cx } from "../../styled-system/css";

export function TextInput({
  onChange,
  className,
  ...props
}: Omit<ComponentPropsWithoutRef<"input">, "onChange"> & {
  onChange?: (value: string) => void;
}) {
  const id = useId();
  return (
    <input
      type="text"
      {...props}
      onChange={(event) => {
        onChange?.(event.target.value);
      }}
      name={`input-${id}`}
      className={cx(
        css({
          width: "100%",
          padding: 8,
          height: 48,
          fontSize: 14,
          background: "fieldSurface",
          border: "1px solid",
          borderColor: "fieldBorder",
          borderRadius: 8,
          _focusVisible: {
            outlineOffset: -1,
            outline: "2px solid token(colors.fieldBorderFocused)",
          },
          _placeholder: {
            color: "contentAlt",
          },
        }),
        className,
      )}
    />
  );
}
