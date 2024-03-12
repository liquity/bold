import type { ComponentPropsWithoutRef } from "react";

import { css } from "@/styled-system/css";

export function InputField({
  label,
  ...props
}: ComponentPropsWithoutRef<"input"> & {
  label: string;
}) {
  return (
    <label
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: 8,
      })}
    >
      <div
        className={css({
          fontSize: 18,
        })}
      >
        {label}
      </div>
      <input
        type="text"
        {...props}
        className={css({
          width: "100%",
          padding: 8,
          height: 60,
          fontSize: 24,
          border: "1px solid",
          borderColor: "#E5E6EE",
        })}
      />
    </label>
  );
}
