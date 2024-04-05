import type { ReactNode } from "react";

import { css } from "@/styled-system/css";
import { Masonry } from "./Masonry";

export function Contract({
  children,
  name,
}: {
  children?: ReactNode;
  name: string;
}) {
  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 40,
        width: "100%",
      })}
    >
      <h1
        className={css({
          width: "100%",
          fontSize: 40,
        })}
      >
        {name}
      </h1>
      <Masonry>
        {children}
      </Masonry>
    </div>
  );
}
