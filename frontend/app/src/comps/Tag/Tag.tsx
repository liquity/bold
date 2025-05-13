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
  size?: "mini" | "small" | "medium";
  css?: Parameters<typeof css>[0];
}) {
  return (
    <div
      title={title}
      className={css({
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        color: "infoSurfaceContent",
        background: "infoSurface",
        border: "1px solid token(colors.infoSurfaceBorder)",
        borderRadius: 8,
        whiteSpace: "nowrap",
        userSelect: "none",
      }, cssProp)}
      style={getStyles(size)}
    >
      {children}
    </div>
  );
}

function getStyles(size: Parameters<typeof Tag>[0]["size"]) {
  if (size === "mini") {
    return {
      height: 12,
      padding: "0 4px 0.5px",
      fontSize: 9,
    };
  }
  if (size === "small") {
    return {
      height: 16,
      padding: "0 4px 1px",
      fontSize: 12,
    };
  }
  if (size === "medium") {
    return {
      height: 22,
      padding: 6,
      fontSize: 14,
    };
  }
  throw new Error(`Invalid size: ${size}`);
}
