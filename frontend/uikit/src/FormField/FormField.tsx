"use client";

import type { ReactNode } from "react";

import { css } from "../../styled-system/css";

export function FormField({
  children,
  label,
}: {
  children: ReactNode;
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
      {children}
    </label>
  );
}
