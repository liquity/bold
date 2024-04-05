import type { ReactNode } from "react";

import { useTheme } from "@/src/theme";
import { css } from "@/styled-system/css";

export function MenuItem({
  icon,
  label,
  selected,
}: {
  icon: ReactNode;
  label: string;
  selected?: boolean;
}) {
  const { color } = useTheme();
  return (
    <div
      aria-selected={selected}
      style={{
        color: color(selected ? "accent" : "content"),
      }}
      className={css({
        display: "flex",
        alignItems: "center",
        gap: 12,
        height: 32,
        padding: "0 12px",
        color: "content",
        cursor: "pointer",
        userSelect: "none",
        _active: {
          translate: "0 1px",
        },
      })}
    >
      {label}
      {icon}
    </div>
  );
}
