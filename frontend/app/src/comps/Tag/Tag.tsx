import type { ReactNode } from "react";

import { css } from "@/styled-system/css";

export function Tag({
  children,
  title,
  size = "medium",
  css: cssProp = {},
}: {
  children: ReactNode;
  title?: string;
  size?: "small" | "medium";
  css?: Parameters<typeof css>[0];
}) {
  return (
    <div
      title={title}
      className={css({
        display: "inline-flex",
        alignItems: "center",
        color: "infoSurfaceContent",
        background: "infoSurface",
        border: "1px solid token(colors.infoSurfaceBorder)",
        borderRadius: 8,
        userSelect: "none",
      }, cssProp)}
      style={{
        height: size === "small" ? 16 : 22,
        fontSize: size === "small" ? 12 : 14,
        padding: size === "small" ? "0 4px 1px" : 6,
      }}
    >
      {children}
    </div>
  );
}
