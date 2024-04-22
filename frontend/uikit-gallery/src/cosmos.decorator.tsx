import type { ReactNode } from "react";

import { css } from "../styled-system/css";

export default function FixtureDecorator({ children }: { children: ReactNode }) {
  return (
    <div
      className={css({
        display: "grid",
        placeItems: "center",
        width: "100vw",
        height: "100vh",
      })}
    >
      {children}
    </div>
  );
}
