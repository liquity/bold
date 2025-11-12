import type { TokenSymbol } from "@/src/types";

import { Amount } from "@/src/comps/Amount/Amount";
import { css } from "@/styled-system/css";
import { TokenIcon } from "@liquity2/uikit";
import type { Dnum } from "dnum";
import { ReactNode } from "react";

export function Rewards({
  amount,
  amountUsd,
  label,
  symbol,
}: {
  amount: Dnum;
  amountUsd: Dnum;
  label: ReactNode;
  symbol: TokenSymbol;
}) {
  return (
    <div
      className={css({
        display: "grid",
        gap: 24,
        medium: {
          gridTemplateColumns: "1.3fr 1fr",
        },
        alignItems: "start",
        padding: "24px 0",
        borderBottom: "1px solid token(colors.separator)",
      })}
    >
      <div className={css({ paddingTop: 8 })}>{label}</div>
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
        })}
      >
        <div
          className={css({
            display: "flex",
            justifyContent: "flex-start",
            alignItems: "center",
            gap: 8,
            fontSize: 20,
            medium: {
              justifyContent: "flex-end",
              fontSize: 28,
            },
          })}
        >
          <Amount value={amount} />
          <TokenIcon symbol={symbol} size={24} />
        </div>

        <div
          className={css({
            color: "contentAlt",
            textAlign: "right",
            paddingRight: 34,
          })}
        >
          <Amount prefix="$" value={amountUsd} />
        </div>
      </div>
    </div>
  );
}
