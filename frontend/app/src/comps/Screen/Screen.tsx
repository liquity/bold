import type { ReactNode } from "react";

import { css } from "@/styled-system/css";

export function Screen({
  children,
  gap = 48,
  subtitle,
  title,
  width = 534,
}: {
  children: ReactNode;
  gap?: number;
  subtitle?: ReactNode;
  title?: ReactNode;
  width?: number;
}) {
  return (
    <div
      className={css({
        flexGrow: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
        padding: 24,
        gap: 56,
      })}
    >
      {title && (
        <header
          className={css({
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
          })}
        >
          <h1
            className={css({
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
            })}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              className={css({
                color: "contentAlt",
              })}
            >
              {subtitle}
            </p>
          )}
        </header>
      )}
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
        })}
        style={{
          gap,
          width,
        }}
      >
        {children}
      </div>
    </div>
  );
}
