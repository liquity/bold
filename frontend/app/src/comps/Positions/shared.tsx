import type { ReactNode } from "react";

import { css } from "@/styled-system/css";
import { IconEdit } from "@liquity2/uikit";

export function CardRows({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: 4,
      })}
    >
      {children}
    </div>
  );
}

export function CardRow({
  start,
  end,
}: {
  start?: ReactNode;
  end?: ReactNode;
}) {
  return (
    <div
      className={css({
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 8,
        color: "strongSurfaceContent",
        whiteSpace: "nowrap",
      })}
    >
      <div>{start}</div>
      <div>{end}</div>
    </div>
  );
}

export function EditSquare() {
  return (
    <div
      className={css({
        display: "grid",
        placeItems: "center",
        width: 32,
        height: 32,
        color: "#F0F3FE",
        background: "rgba(247, 247, 255, 0.1)",
        borderRadius: 8,
      })}
    >
      <IconEdit size={24} />
    </div>
  );
}
