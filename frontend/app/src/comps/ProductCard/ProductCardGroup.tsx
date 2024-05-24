import type { ReactNode } from "react";

import { css } from "@/styled-system/css";

export function ProductCardGroup({
  children,
  description,
  icon,
  name,
  summary,
}: {
  children: ReactNode;
  description: ReactNode;
  icon: ReactNode;
  name: ReactNode;
  summary?: {
    label: ReactNode;
    value: ReactNode;
  };
}) {
  return (
    <section
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: 48,
      })}
    >
      <header
        className={css({
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        })}
      >
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: 16,
            color: "content",
          })}
        >
          <h1
            className={css({
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontSize: 24,
            })}
          >
            {icon}
            {name}
          </h1>
          <p
            className={css({
              maxWidth: 328,
              fontSize: 14,
              color: "contentAlt",
            })}
          >
            {description}
          </p>
        </div>
        {summary && (
          <div
            className={css({
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              justifyContent: "center",
              gap: 0,
              height: 72,
              padding: "0 16px",
              background: "secondary",
              borderRadius: 8,
            })}
          >
            <div
              className={css({
                color: "contentAlt",
                fontSize: 14,
              })}
            >
              {summary.label}
            </div>
            <div
              className={css({
                color: "accent",
                fontSize: 20,
              })}
            >
              {summary.value}
            </div>
          </div>
        )}
      </header>
      <div
        className={css({
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
        })}
      >
        {children}
      </div>
    </section>
  );
}
