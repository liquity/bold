import type { ReactNode } from "react";

import { css } from "@/styled-system/css";

export function InfoBox(props: {
  title?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 16,
        color: "infoSurfaceContent",
        background: "infoSurface",
        border: "1px solid token(colors.infoSurfaceBorder)",
        borderRadius: 8,
      })}
    >
      {props.title && (
        <header className={css({ display: "flex", flexDirection: "column", fontSize: 16 })}>
          <h1 className={css({ fontWeight: 600 })}>{props.title}</h1>
        </header>
      )}

      {props.children}
    </section>
  );
}
