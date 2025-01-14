import type { DecoratorProps } from "react-cosmos-core";

import { css } from "../styled-system/css";

export default function FixtureDecorator({ children }: DecoratorProps) {
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
