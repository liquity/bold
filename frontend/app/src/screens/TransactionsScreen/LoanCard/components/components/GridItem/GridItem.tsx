import { css } from "@/styled-system/css";

import type { FC, PropsWithChildren } from "react";

interface GridItemProps extends PropsWithChildren {
  label: string;
  title?: string;
}

export const GridItem: FC<GridItemProps> = ({ label, title, children }) => (
  <div
    className={css({
      display: "grid",
      gap: 4,
      fontSize: 14,
    })}
  >
    <div
      title={title}
      className={css({
        minWidth: 0,
        color: "strongSurfaceContentAlt",
      })}
    >
      <div
        title={label}
        className={css({
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
        })}
      >
        {label}
      </div>
    </div>
    <div
      className={css({
        color: "strongSurfaceContent",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      })}
    >
      {children}
    </div>
  </div>
);
