import type { ReactNode } from "react";

import { css } from "@/styled-system/css";

export function WarningBox({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: 16,
        fontSize: 16,
        color: "negativeContent",
        background: "negativeStrong",
        borderRadius: 8,
      })}
    >
      {children}
    </div>
  );
}
