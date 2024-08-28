import type { ReactNode } from "react";

import { css } from "@/styled-system/css";
import { HFlex } from "@liquity2/uikit";

const ARROW_RIGHT = "→";

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
    <HFlex
      gap={8}
      style={{
        fontSize,
        fontVariantNumeric: tabularNums ? "tabular-nums" : "inherit",
      }}
    >
      <div className={css({ color: "contentAlt" })}>{before}</div>
      <div className={css({ color: "contentAlt" })}>{ARROW_RIGHT}</div>
      <div>{after}</div>
    </HFlex>
  );
}
