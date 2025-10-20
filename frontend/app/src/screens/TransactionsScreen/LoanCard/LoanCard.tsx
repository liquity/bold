import { useMemo } from "react";
import { getLoanDetails } from "@/src/liquity-math";
import { getCollToken } from "@/src/liquity-utils";
import { usePrice } from "@/src/services/Prices";
import { ClosedLoan } from "@/src/screens/TransactionsScreen/LoanCard/components/ClosedLoan";
import { OpenLoan } from "@/src/screens/TransactionsScreen/LoanCard/components/OpenLoan";
import { LoadingCard } from "@/src/screens/TransactionsScreen/LoanCard/components/LoadingCard";

import type { LoadingState } from "@/src/screens/TransactionsScreen/TransactionsScreen.tsx";
import type { PositionLoan } from "@/src/types";

const LOAN_CARD_HEIGHT = 290;
const LOAN_CARD_HEIGHT_REDUCED = 176;

export function LoanCard({
  leverageMode,
  loadingState,
  loan,
  onRetry,
  prevLoan,
  txPreviewMode = false,
}: {
  leverageMode: boolean;
  loadingState: LoadingState;
  loan: PositionLoan | null;
  onRetry: () => void;
  prevLoan?: PositionLoan | null;
  txPreviewMode?: boolean;
}) {
  const branchId = loan?.branchId ?? prevLoan?.branchId ?? null;
  const collToken = getCollToken(branchId);

  if (!collToken) {
    throw new Error(`Collateral token not found: ${branchId}`);
  }

  const collPriceUsd = usePrice(collToken.symbol);

  const isLoanClosing = prevLoan && !loan;

  const loanDetails =
    loan &&
    getLoanDetails(
      loan.deposit,
      loan.borrowed,
      loan.interestRate,
      collToken.collateralRatio,
      collPriceUsd.data ?? null,
    );

  const prevLoanDetails =
    prevLoan &&
    getLoanDetails(
      prevLoan.deposit,
      prevLoan.borrowed,
      prevLoan.interestRate,
      collToken.collateralRatio,
      collPriceUsd.data ?? null,
    );

  const {
    depositPreLeverage,
    leverageFactor,
    liquidationRisk,
    liquidationPrice,
  } = loanDetails || {};

  const loanDetailsFilled = Boolean(
    typeof leverageFactor === "number" &&
      depositPreLeverage &&
      liquidationRisk &&
      liquidationPrice,
  );

  const loadingStatus = useMemo(() => {
    if (loadingState !== "success") {
      return loadingState;
    }

    if (
      collPriceUsd.status === "pending" ||
      (!isLoanClosing && !loanDetailsFilled)
    ) {
      return "loading";
    }

    return collPriceUsd.status;
  }, [loadingState, collPriceUsd.status, isLoanClosing, loanDetailsFilled]);

  const content = useMemo(() => {
    if (isLoanClosing) {
      return <ClosedLoan prevLoan={prevLoan} collTokenName={collToken.name} />;
    }

    if (loan && loanDetails && loanDetailsFilled) {
      return (
        <OpenLoan
          loan={loan}
          prevLoan={prevLoan}
          prevLoanDetails={prevLoanDetails}
          leverageMode={leverageMode}
          collToken={collToken}
          loanDetails={loanDetails}
        />
      );
    }

    return null;
  }, [
    isLoanClosing,
    prevLoan,
    collToken,
    loan,
    loanDetails,
    loanDetailsFilled,
    leverageMode,
  ]);

  return (
    <LoadingCard
      height={isLoanClosing ? LOAN_CARD_HEIGHT_REDUCED : LOAN_CARD_HEIGHT}
      leverage={leverageMode}
      loadingState={loadingStatus}
      onRetry={onRetry}
      txPreviewMode={txPreviewMode}
    >
      {content}
    </LoadingCard>
  );
}
