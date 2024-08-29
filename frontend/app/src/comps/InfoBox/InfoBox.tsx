import type { ReactNode } from "react";

import { css } from "@/styled-system/css";

export function InfoBox({
  children,
  gap = 16,
}: {
  children: ReactNode;
  gap?: number;
}) {
  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        padding: 16,
        fontSize: 16,
        background: "infoSurface",
        border: "1px solid token(colors.infoSurfaceBorder)",
        borderRadius: 8,
      })}
      style={{
        gap,
      }}
    >
      {children}
    </div>
  );
}
