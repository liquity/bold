import type { ReactNode } from "react";

import { css } from "@/styled-system/css";
import { Children } from "react";

export function Masonry({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      className={css({
        width: "100%",
        columnCount: 2,
        columnGap: 40,
      })}
    >
      {Children.map(children, (child, index) => (
        <div
          key={index}
          className={css({
            breakInside: "avoid",
            marginBottom: 40,
          })}
        >
          {child}
        </div>
      ))}
    </div>
  );
}
