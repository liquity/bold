import type { ReactNode } from "react";

import { ARROW_RIGHT } from "@/src/characters";
import { css } from "@/styled-system/css";

export function ValueUpdate({
  after,
  before,
  fontSize = 16,
  tabularNums = true,
}: {
  after: ReactNode;
  before: ReactNode;
  fontSize?: number;
  tabularNums?: boolean;
}) {
  return (
    <div
      className={css({
        display: "grid",
        gridTemplateColumns: "auto auto auto",
        gap: 8,
        width: "100%",
        userSelect: "none",
        "--color-dimmed": "token(colors.contentAlt)",
      })}
      style={{
        fontSize,
        fontVariantNumeric: tabularNums ? "tabular-nums" : "inherit",
      }}
    >
      <SingleValue dimmed>{before}</SingleValue>
      <div className={css({ color: "var(--color-dimmed)" })}>
        {ARROW_RIGHT}
      </div>
      <SingleValue>{after}</SingleValue>
    </div>
  );
}

function SingleValue({
  children,
  dimmed,
}: {
  children: ReactNode;
  dimmed?: boolean;
}) {
  return (
    <div
      className={css({
        display: "flex",
        alignItems: "center",
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      })}
      style={{
        color: dimmed ? "var(--color-dimmed)" : undefined,
      }}
    >
      {children}
    </div>
  );
}
