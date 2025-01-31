import type { ReactNode } from "react";

import { css } from "@/styled-system/css";

export function ShadowBox({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      className={css({
        width: "100%",
        background: "background",
        borderWidth: "1px 1px 0",
        borderStyle: "solid",
        borderColor: "gray:50",
        boxShadow: `
          0 2px 2px rgba(0, 0, 0, 0.1),
          0 4px 10px rgba(18, 27, 68, 0.05),
          inset 0 -1px 4px rgba(0, 0, 0, 0.05)
        `,
        borderRadius: 8,
      })}
    >
      {children}
    </div>
  );
}
