import type { TokenSymbol } from "@/src/types";
import type { ComponentProps } from "react";

import { Amount } from "@/src/comps/Amount/Amount";
import { fmtnum } from "@/src/formatting";
import { css } from "@/styled-system/css";
import { TokenIcon } from "@liquity2/uikit";

const SIZES = {
  normal: {
    iconSize: 16,
    fontSize: 14,
    gap: 4,
  },
};

export function TokenAmount({
  symbol,
  size = "normal",
  value,
  ...amountProps
}: {
  symbol: TokenSymbol;
  size?: "normal";
} & ComponentProps<typeof Amount>) {
  const { iconSize, fontSize, gap } = SIZES[size];
  return (
    <div
      title={fmtnum(value, {
        preset: "full",
        suffix: ` ${symbol}`,
      })}
      className={css({
        display: "grid",
        gridAutoFlow: "column",
        alignItems: "center",
        gap: 4,
        overflow: "hidden",
        minWidth: 0,
        userSelect: "none",
      })}
      style={{
        gap,
      }}
    >
      <TokenIcon
        title={null}
        symbol={symbol}
        size={iconSize}
      />
      <div
        className={css({
          display: "grid",
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        })}
        style={{
          fontSize,
        }}
      >
        <Amount
          {...amountProps}
          title={null}
          value={value}
        />
      </div>
    </div>
  );
}
