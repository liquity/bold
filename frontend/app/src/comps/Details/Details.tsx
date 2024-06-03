import type { ReactNode } from "react";

import { css } from "@/styled-system/css";

export function Details({
  items,
}: {
  items: Array<{
    label: ReactNode;
    value: ReactNode;
  }>;
}) {
  return (
    <div
      className={css({
        display: "grid",
        width: "100%",
        padding: 24,
        background: "#F8F6F4",
        borderRadius: 8,
      })}
      style={{
        gridTemplateColumns: `repeat(${items.length}, 1fr)`,
      }}
    >
      {items.map(({ label, value }) => (
        <div
          key={`${label}${value}`}
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
          <div>
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}
