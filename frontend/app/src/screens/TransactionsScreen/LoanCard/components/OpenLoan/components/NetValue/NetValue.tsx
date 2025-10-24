import { CrossedText } from "@/src/comps/CrossedText";
import { Value } from "@/src/comps/Value/Value";
import { fmtnum } from "@/src/formatting";
import { getLoanDetails } from "@/src/liquity-math";
import { getCollToken } from "@/src/liquity-utils";
import { roundToDecimal } from "@/src/utils";
import { css } from "@/styled-system/css";
import { TokenIcon } from "@liquity2/uikit";
import * as dn from "dnum";

import type { PositionLoan } from "@/src/types";
import type { FC } from "react";

interface NetValueProps {
  loan: PositionLoan;
  loanDetails: ReturnType<typeof getLoanDetails>;
  prevLoanDetails: null | ReturnType<typeof getLoanDetails>;
  isSuccess?: boolean;
}

export const NetValue: FC<NetValueProps> = ({
  loanDetails,
  loan,
  prevLoanDetails,
  isSuccess,
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
          title={`${fmtnum(loanDetails.depositPreLeverage)} ${collToken.name}`}
          className={css({
            display: "flex",
            alignItems: "center",
            gap: 12,
          })}
        >
          <div>{fmtnum(loanDetails.depositPreLeverage)}</div>

          {prevLoanDetails?.depositPreLeverage && loanDetails.depositPreLeverage
            && !dn.eq(prevLoanDetails.depositPreLeverage, loanDetails.depositPreLeverage) && (
            <CrossedText title={`${fmtnum(prevLoanDetails.depositPreLeverage, "full")} BOLD`}>
              {fmtnum(prevLoanDetails.depositPreLeverage)}
            </CrossedText>
          )}

          <TokenIcon symbol={collToken.symbol} size={32} />

          <div
            className={css({
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 16,
            })}
          >
            {loanDetails.leverageFactor !== null && (
              <Value
                negative={loanDetails.status === "underwater" || loanDetails.status === "liquidatable"}
                title={`Multiply: ${roundToDecimal(loanDetails.leverageFactor, 1)}x`}
                className={css({ fontSize: 16 })}
              >
                {roundToDecimal(loanDetails.leverageFactor, 1)}x
              </Value>
            )}

            {prevLoanDetails
              && prevLoanDetails.leverageFactor !== null
              && prevLoanDetails.leverageFactor !== loanDetails.leverageFactor && !isSuccess && (
              <CrossedText>
                {roundToDecimal(prevLoanDetails.leverageFactor, 1)}x
              </CrossedText>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
