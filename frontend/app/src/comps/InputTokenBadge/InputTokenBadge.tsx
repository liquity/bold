import type { ReactNode } from "react";

import { css } from "@/styled-system/css";

export function InputTokenBadge({
  background = true,
  icon,
  label,
}: {
  background?: boolean;
  icon?: ReactNode;
  label: ReactNode;
}) {
  return (
    <div
      className={css({
        display: "flex",
        alignItems: "center",
        gap: 8,
        height: 40,
        fontSize: 24,
        userSelect: "none",
      })}
      style={{
        paddingLeft: icon ? 8 : 16,
        background: background ? "#FFF" : "transparent",
        borderRadius: background ? 20 : 0,
        padding: background ? "0 16px" : 0,
      }}
    >
      {icon}
      <div>
        {label}
      </div>
    </div>
  );
}
