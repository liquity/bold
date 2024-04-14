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
    <section>
      <h1
        className={css({
          width: "100%",
          padding: "40px 0 20px",
          fontSize: 32,
        })}
      >
        {name}
      </h1>
      <Masonry>
        {children}
      </Masonry>
    </section>
  );
}
