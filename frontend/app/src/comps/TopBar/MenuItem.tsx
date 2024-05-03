import type { ReactNode } from "react";

import { css } from "@/styled-system/css";
import { token } from "@/styled-system/tokens";

export function MenuItem({
  icon,
  label,
  selected,
}: {
  icon: ReactNode;
  label: string;
  selected?: boolean;
}) {
  return (
    <div
      aria-selected={selected}
      className={css({
        display: "flex",
        alignItems: "center",
        gap: 12,
        height: "100%",
        color: "content",
        cursor: "pointer",
        userSelect: "none",
      })}
      style={{
        color: token(`colors.${selected ? "selected" : "interactive"}`),
      }}
    >
      <div
        className={css({
          display: "grid",
          placeItems: "center",
          width: 24,
          height: 24,
        })}
      >
        {icon}
      </div>
      {label}
    </div>
  );
}
