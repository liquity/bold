import type { ReactNode } from "react";

import { Button } from "@/src/comps/Button/Button";
import { css } from "@/styled-system/css";

export function ContractAction({
  children,
  onSubmit,
  title,
}: {
  children?: ReactNode;
  onSubmit?: () => void;
  title: string;
}) {
  return (
    <section
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: 40,
        width: "100%",
        padding: 40,
        background: "#F7F7FF",
      })}
    >
      <h1
        className={css({
          fontSize: 32,
        })}
      >
        {title}
      </h1>
      <form
        onSubmit={e => {
          e.preventDefault();
          onSubmit?.();
        }}
        className={css({
          display: "flex",
          flexDirection: "column",
          width: "100%",
          gap: 16,
        })}
      >
        {children}
        <div
          className={css({
            display: "flex",
            justifyContent: "flex-end",
            paddingTop: 16,
          })}
        >
          <Button label={title} />
        </div>
      </form>
    </section>
  );
}
