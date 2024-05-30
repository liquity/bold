import type { ReactNode } from "react";

import { css } from "@/styled-system/css";

export function Screen({
  children,
  subtitle,
  title,
  width = 534,
}: {
  children: ReactNode;
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
        gap: 64,
        width: "100%",
        padding: 24,
      })}
    >
      {title && (
        <header
          className={css({
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          })}
        >
          <h1
            className={css({
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              paddingBottom: 12,
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
          gap: 48,
        })}
        style={{
          width,
        }}
      >
        {children}
      </div>
    </div>
  );
}
