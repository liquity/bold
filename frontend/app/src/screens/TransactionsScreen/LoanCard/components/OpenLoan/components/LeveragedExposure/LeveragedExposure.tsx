import { getCollToken } from "@/src/liquity-utils.ts";
import { css } from "@/styled-system/css";
import { fmtnum } from "@/src/formatting.ts";
import { Value } from "@/src/comps/Value/Value.tsx";
import { INFINITY } from "@/src/characters.ts";
import { roundToDecimal } from "@/src/utils.ts";
import { getLoanDetails } from "@/src/liquity-math.ts";
import { TokenIcon } from "@liquity2/uikit";
import { CrossedText } from '@/src/screens/TransactionsScreen/LoanCard/components/components/CrossedText';

import type { FC } from "react";
import type { PositionLoan } from "@/src/types.ts";

interface LeveragedExposureProps {
  loan: PositionLoan;
  loanDetails: ReturnType<typeof getLoanDetails>;
  prevLoanDetails: null | ReturnType<typeof getLoanDetails>;
}

export const LeveragedExposure: FC<LeveragedExposureProps> = ({
  loanDetails,
  loan,
  prevLoanDetails,
}) => {
  const collToken = getCollToken(loan.branchId);

  if (!collToken) {
    return null;
  }

  return (
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
          title={`${fmtnum(loan.deposit, "full")} ${collToken.name}`}
          className={css({
            display: "flex",
            alignItems: "center",
            gap: 12,
          })}
        >
          <div>{fmtnum(loan.deposit)}</div>
          <TokenIcon symbol={collToken.symbol} size={32} />
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 16,
            })}
          >
            <Value
              negative={
                loanDetails.status === "underwater" ||
                loanDetails.status === "liquidatable"
              }
              title={`Multiply factor: ${
                loanDetails.status === "underwater" ||
                loanDetails.leverageFactor === null
                  ? INFINITY
                  : `${roundToDecimal(loanDetails.leverageFactor, 3)}x`
              }`}
              className={css({
                fontSize: 16,
              })}
            >
              {loanDetails.status === "underwater" ||
              loanDetails.leverageFactor === null
                ? INFINITY
                : `${roundToDecimal(loanDetails.leverageFactor, 1)}x`}
            </Value>
            {prevLoanDetails &&
              prevLoanDetails.leverageFactor !== loanDetails.leverageFactor && (
                <CrossedText>
                  {prevLoanDetails.leverageFactor === null
                    ? INFINITY
                    : `${roundToDecimal(prevLoanDetails.leverageFactor, 1)}x`}
                </CrossedText>
              )}
          </div>
        </div>
      </div>
    </div>
  );
};
