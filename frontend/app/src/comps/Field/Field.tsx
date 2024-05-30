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
        <div
          className={css({
            color: "contentAlt",
          })}
        >
          {label}
        </div>
      )}
      <div
        className={css({
          display: "flex",
          alignItems: "center",
        })}
      >
        {value}
      </div>
    </div>
  );
}

export function FieldInfoWarnLevel({
  label,
  level,
}: {
  label: ReactNode;
  level: "low" | "medium" | "high";
}) {
  return (
    <FieldInfo
      value={
        <div
          className={css({
            display: "flex",
            gap: 8,
            alignItems: "center",
          })}
        >
          <div
            className={css({
              width: 12,
              height: 12,
              "--warn-color-low": "token(colors.positive)",
              "--warn-color-medium": "token(colors.warning)",
              "--warn-color-high": "token(colors.negative)",
              borderRadius: "50%",
            })}
            style={{
              background: `var(--warn-color-${level})`,
            }}
          />
          {label}
        </div>
      }
    />
  );
}
