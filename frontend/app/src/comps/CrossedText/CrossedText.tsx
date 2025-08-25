import { css } from "@/styled-system/css";

import type { FC, PropsWithChildren } from "react";

interface CrossedTextProps extends PropsWithChildren {
  title?: string;
}

export const CrossedText: FC<CrossedTextProps> = ({ children, title }) => (
  <div
    title={title}
    className={css({
      color: "contentAlt",
      textDecoration: "line-through",
    })}
  >
    {children}
  </div>
);
