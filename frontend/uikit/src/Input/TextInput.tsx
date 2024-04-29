import type { ComponentPropsWithoutRef } from "react";

import { css } from "../../styled-system/css";

export function TextInput({
  onChange,
  ...props
}: Omit<ComponentPropsWithoutRef<"input">, "onChange"> & {
  onChange?: (value: string) => void;
}) {
  return (
    <input
      type="text"
      {...props}
      onChange={(event) => {
        onChange?.(event.target.value);
      }}
      className={css({
        width: "100%",
        padding: 8,
        height: 60,
        fontSize: 24,
        background: "#FFFFFF",
        border: "1px solid",
        borderColor: "#E5E6EE",
        borderRadius: 4,
      })}
    />
  );
}
