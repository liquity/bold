import { css } from "@/styled-system/css";
import { fmtnum } from "@/src/formatting.ts";
import * as dn from "dnum";
import { TokenIcon } from "@liquity2/uikit";
import { CrossedText } from "@/src/screens/TransactionsScreen/LoanCard/components/components/CrossedText";

import type { FC } from "react";
import type { PositionLoan } from "@/src/types.ts";

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
        title={`${fmtnum(loan.borrowed, "full")} BOLD`}
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
        <TokenIcon symbol="BOLD" size={32} />
        {prevLoan && !dn.eq(prevLoan.borrowed, loan.borrowed) && (
          <CrossedText title={`${fmtnum(prevLoan.borrowed, "full")} BOLD`}>
            {fmtnum(prevLoan.borrowed)}
          </CrossedText>
        )}
      </div>
    </div>
  </div>
);
