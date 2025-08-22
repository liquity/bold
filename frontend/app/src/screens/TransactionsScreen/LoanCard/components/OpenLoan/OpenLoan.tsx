import { TotalDebt } from "@/src/screens/TransactionsScreen/LoanCard/components/components/TotalDebt";
import { css } from "@/styled-system/css";
import { GridItem } from "@/src/screens/TransactionsScreen/LoanCard/components/components/GridItem";
import { Value } from "@/src/comps/Value/Value.tsx";
import { fmtnum, formatRisk } from "@/src/formatting.ts";
import * as dn from "dnum";
import { riskLevelToStatusMode } from "@/src/uikit-utils.tsx";
import { LeveragedExposure } from "./components/LeveragedExposure";
import { getLoanDetails } from "@/src/liquity-math.ts";
import { useRedemptionRisk } from "@/src/liquity-utils.ts";
import { HFlex, StatusDot } from "@liquity2/uikit";
import { useMemo } from "react";
import { NetValueCell } from "@/src/screens/TransactionsScreen/LoanCard/components/OpenLoan/components/NetValueCell";
import { CollateralCell } from "@/src/screens/TransactionsScreen/LoanCard/components/OpenLoan/components/CollateralCell";
import { GridItemWrapper } from "@/src/screens/TransactionsScreen/LoanCard/components/components/GridItemWrapper";
import { CrossedText } from "@/src/screens/TransactionsScreen/LoanCard/components/components/CrossedText";

import type { LoanDetails, PositionLoan } from "@/src/types.ts";
import type { CollateralToken } from "@liquity2/uikit";
import type { FC } from "react";

interface OpenLoanProps {
  loan: PositionLoan;
  loanDetails: LoanDetails;
  prevLoanDetails?: ReturnType<typeof getLoanDetails> | null;
  prevLoan?: PositionLoan | null;
  leverageMode: boolean;
  collToken: CollateralToken;
}

export const OpenLoan: FC<OpenLoanProps> = ({
  prevLoan,
  loan,
  prevLoanDetails,
  leverageMode,
  collToken,
  loanDetails,
}) => {
  const redemptionRisk = useRedemptionRisk(
    loan?.branchId ?? 0,
    loan?.interestRate ?? null,
  );
  const prevRedemptionRisk = useRedemptionRisk(
    prevLoan?.branchId ?? 0,
    prevLoan?.interestRate ?? null,
  );

  const maxLtv = useMemo(() => {
    return dn.div(dn.from(1, 18), collToken.collateralRatio);
  }, [collToken.collateralRatio]);

  const { ltv, depositPreLeverage, liquidationRisk, liquidationPrice } =
    loanDetails;

  if (!depositPreLeverage) {
    return null;
  }

  return (
    <>
      {leverageMode ? (
        <LeveragedExposure
          loan={loan}
          loanDetails={loanDetails}
          prevLoanDetails={prevLoanDetails ?? null}
        />
      ) : (
        <TotalDebt loan={loan} prevLoan={prevLoan} />
      )}
      <div
        className={css({
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 12,
          paddingTop: 32,
        })}
      >
        {leverageMode ? (
          <NetValueCell
            depositPreLeverage={depositPreLeverage}
            prevDepositPreLeverage={prevLoanDetails?.depositPreLeverage}
            collTokenName={collToken.name}
            isUnderwater={loanDetails.status === "underwater"}
          />
        ) : (
          <CollateralCell
            collTokenName={collToken.name}
            deposit={loan.deposit}
            prevDeposit={prevLoan?.deposit}
          />
        )}
        <GridItemWrapper label="Liq. price" title="Liquidation price">
          <Value negative={ltv && dn.gt(ltv, maxLtv)}>
            {fmtnum(liquidationPrice, { preset: "2z", prefix: "$" })}
          </Value>
          {liquidationPrice &&
            prevLoanDetails?.liquidationPrice &&
            !dn.eq(prevLoanDetails.liquidationPrice, liquidationPrice) && (
              <CrossedText>
                {fmtnum(prevLoanDetails.liquidationPrice, {
                  preset: "2z",
                  prefix: "$",
                })}
              </CrossedText>
            )}
        </GridItemWrapper>
        <GridItemWrapper label="Interest rate">
          <div>{fmtnum(loan.interestRate, "pct2z")}%</div>
          {loan.batchManager && (
            <div
              title={`Interest rate delegate: ${loan.batchManager}`}
              className={css({
                display: "flex",
                alignItems: "center",
                height: 16,
                padding: "0 6px",
                fontSize: 10,
                fontWeight: 600,
                textTransform: "uppercase",
                color: "content",
                background: "brandCyan",
                borderRadius: 20,
              })}
            >
              delegated
            </div>
          )}
          {prevLoan && !dn.eq(prevLoan.interestRate, loan.interestRate) && (
            <CrossedText>{fmtnum(prevLoan.interestRate, "pct2z")}%</CrossedText>
          )}
        </GridItemWrapper>
        <GridItemWrapper label="LTV" title="Loan-to-value ratio">
          <div
            className={css({
              "--status-positive": "token(colors.positiveAlt)",
              "--status-warning": "token(colors.warning)",
              "--status-negative": "token(colors.negative)",
            })}
            style={{
              color:
                liquidationRisk === "low"
                  ? "var(--status-positive)"
                  : liquidationRisk === "medium"
                    ? "var(--status-warning)"
                    : "var(--status-negative)",
            }}
          >
            {fmtnum(ltv, "pct2z")}%
          </div>
          {ltv && prevLoanDetails?.ltv && !dn.eq(prevLoanDetails.ltv, ltv) && (
            <CrossedText>{fmtnum(prevLoanDetails.ltv, "pct2z")}%</CrossedText>
          )}
        </GridItemWrapper>
        <GridItem label="Liquidation risk">
          <HFlex gap={8} alignItems="center" justifyContent="flex-start">
            <StatusDot mode={riskLevelToStatusMode(liquidationRisk)} size={8} />
            {formatRisk(liquidationRisk)}
            {prevLoanDetails &&
              liquidationRisk !== prevLoanDetails.liquidationRisk && (
                <>
                  <StatusDot
                    mode={riskLevelToStatusMode(
                      prevLoanDetails.liquidationRisk,
                    )}
                    size={8}
                  />
                  <CrossedText>
                    {formatRisk(prevLoanDetails.liquidationRisk)}
                  </CrossedText>
                </>
              )}
          </HFlex>
        </GridItem>
        {redemptionRisk.data && (
          <GridItem label="Redemption risk">
            <HFlex gap={8} alignItems="center" justifyContent="flex-start">
              <StatusDot
                mode={riskLevelToStatusMode(redemptionRisk.data)}
                size={8}
              />
              {formatRisk(redemptionRisk.data)}
              {prevRedemptionRisk.data &&
                redemptionRisk.data !== prevRedemptionRisk.data && (
                  <>
                    <StatusDot
                      mode={riskLevelToStatusMode(prevRedemptionRisk.data)}
                      size={8}
                    />
                    <CrossedText>
                      {formatRisk(prevRedemptionRisk.data)}
                    </CrossedText>
                  </>
                )}
            </HFlex>
          </GridItem>
        )}
      </div>
    </>
  );
};
