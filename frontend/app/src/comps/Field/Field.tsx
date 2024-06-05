import type { ReactNode } from "react";

import { css } from "@/styled-system/css";
import { StatusDot } from "@liquity2/uikit";
import { match } from "ts-pattern";

export function Field({
  field,
  footerEnd,
  footerStart,
  label,
}: {
  field: ReactNode;
  footerStart?: ReactNode;
  footerEnd?: ReactNode;
  label?: ReactNode;
}) {
  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: 16,
      })}
    >
      {label
        ? (
          <div
            className={css({
              display: "flex",
              flexDirection: "column",
              gap: 8,
            })}
          >
            <div
              className={css({
                color: "contentAlt",
              })}
            >
              {label}
            </div>
            {field}
          </div>
        )
        : field}
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

function FooterInfo({
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

function FooterInfoWarnLevel({
  label,
  level,
}: {
  label: ReactNode;
  level: "low" | "medium" | "high";
}) {
  return (
    <FooterInfo
      value={
        <div
          className={css({
            display: "flex",
            gap: 8,
            alignItems: "center",
          })}
        >
          <StatusDot
            mode={match(level)
              .with("low", () => "positive" as const)
              .with("medium", () => "warning" as const)
              .with("high", () => "negative" as const)
              .exhaustive()}
          />
          {label}
        </div>
      }
    />
  );
}

Field.FooterInfo = FooterInfo;
Field.FooterInfoWarnLevel = FooterInfoWarnLevel;
