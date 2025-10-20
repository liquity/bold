import { css } from "@/styled-system/css";
import { fmtnum } from "@/src/formatting";
import * as dn from "dnum";
import { TokenIcon } from "@liquity2/uikit";
import { CrossedText } from "@/src/comps/CrossedText";
import { WHITE_LABEL_CONFIG } from "@/src/white-label.config";

import type { FC } from "react";
import type { PositionLoan } from "@/src/types";

interface TotalDebtProps {
  positive?: boolean;
  loan: PositionLoan;
  prevLoan?: PositionLoan | null;
}

export const TotalDebt: FC<TotalDebtProps> = ({ positive, loan, prevLoan }) => (
  <div
    className={css({
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    })}
  >
    <div
      className={css({
        display: "flex",
        alignItems: "center",
        fontSize: 28,
        lineHeight: 1,
        gap: 12,
      })}
    >
      <div
        title={`${fmtnum(loan.borrowed, "full")} ${WHITE_LABEL_CONFIG.tokens.mainToken.symbol}`}
        className={css({
          display: "flex",
          alignItems: "center",
          gap: 12,
        })}
      >
        <div
          style={{
            color: positive ? "var(--colors-positive-alt)" : undefined,
          }}
        >
          {fmtnum(loan.borrowed)}
        </div>
        <TokenIcon symbol={WHITE_LABEL_CONFIG.tokens.mainToken.symbol} size={32} />
        {prevLoan && !dn.eq(prevLoan.borrowed, loan.borrowed) && (
          <CrossedText title={`${fmtnum(prevLoan.borrowed, "full")} ${WHITE_LABEL_CONFIG.tokens.mainToken.symbol}`}>
            {fmtnum(prevLoan.borrowed)}
          </CrossedText>
        )}
      </div>
    </div>
  </div>
);
