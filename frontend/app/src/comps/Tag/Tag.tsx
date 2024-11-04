import { css } from "@/styled-system/css";
import type { ReactNode } from "react";

export function Tag({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <div
      title={title}
      className={css({
        display: "inline-flex",
        alignItems: "center",
        height: 22,
        padding: 6,
        fontSize: 14,
        color: "infoSurfaceContent",
        background: "infoSurface",
        border: "1px solid token(colors.infoSurfaceBorder)",
        borderRadius: 8,
        userSelect: "none",
      })}
    >
      {children}
    </div>
  );
}
