import { css } from "@/styled-system/css";
import { TokenIcon, TokenSymbol } from "@liquity2/uikit";
import type { ComponentProps } from "react";
import { Amount } from "./Amount";

export interface InlineTokenAmountProps extends ComponentProps<typeof Amount> {
  symbol?: TokenSymbol | null;
}

export function InlineTokenAmount({ symbol, ...amountProps }: InlineTokenAmountProps) {
  return (
    <span className={css({ display: "inline-flex", alignItems: "baseline", gap: 3 })}>
      {symbol && (
        <span className={css({ position: "relative", top: 2.5 })}>
          <TokenIcon symbol={symbol} size="mini" />
        </span>
      )}

      <Amount {...amountProps} />
    </span>
  );
}
