import type { ReactNode } from "react";

import { css } from "@/styled-system/css";

export function Field({
  field,
  footerStart,
  footerEnd,
}: {
  field: ReactNode;
  footerStart?: ReactNode;
  footerEnd?: ReactNode;
}) {
  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: 16,
      })}
    >
      {field}
      <div
        className={css({
          display: "flex",
          justifyContent: "space-between",
        })}
      >
        <div
          className={css({
            display: "flex",
            gap: 16,
          })}
        >
          {footerStart}
        </div>
        <div
          className={css({
            display: "flex",
            gap: 16,
          })}
        >
          {footerEnd}
        </div>
      </div>
    </div>
  );
}

export function FieldInfo({
  label,
  value,
}: {
  label?: ReactNode;
  value: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
      }}
    >
      {label && (
        <span className={css({ color: "contentAlt" })}>
          {label}
        </span>
      )}
      <span>{value}</span>
    </div>
  );
}
