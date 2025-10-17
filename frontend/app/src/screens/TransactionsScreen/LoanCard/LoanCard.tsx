import { getLoanDetails } from "@/src/liquity-math";
import { getCollToken } from "@/src/liquity-utils";
import { ClosedLoan } from "@/src/screens/TransactionsScreen/LoanCard/components/ClosedLoan";
import { LoadingCard } from "@/src/screens/TransactionsScreen/LoanCard/components/LoadingCard";
import { OpenLoan } from "@/src/screens/TransactionsScreen/LoanCard/components/OpenLoan";
import { usePrice } from "@/src/services/Prices";
import { useMemo } from "react";

import type { LoadingState } from "@/src/screens/TransactionsScreen/TransactionsScreen.tsx";
import { useTransactionFlow } from "@/src/services/TransactionFlow";
import type { PositionLoan, PositionLoanCommitted } from "@/src/types";

const LOAN_CARD_HEIGHT = 290;
const LOAN_CARD_HEIGHT_REDUCED = 176;

export function LoanCard({
  leverageMode,
  loadingState,
  loan,
  onRetry,
  prevLoan,
  txPreviewMode = false,
  displayAllDifferences = true,
}: {
  leverageMode: boolean;
  loadingState: LoadingState;
  loan: PositionLoan | null;
  onRetry: () => void;
  prevLoan?: PositionLoanCommitted | null;
  txPreviewMode?: boolean;
  displayAllDifferences?: boolean;
}) {
  const branchId = loan?.branchId ?? prevLoan?.branchId ?? null;
  const collToken = getCollToken(branchId);

  const {
    currentStep: step,
    currentStepIndex,
    flow,
  } = useTransactionFlow();

  const isLastStep = flow?.steps && currentStepIndex === flow.steps.length - 1;
  const isSuccess = isLastStep && step?.status === "confirmed";

  if (!collToken) {
    throw new Error(`Collateral token not found: ${branchId}`);
  }

  const collPriceUsd = usePrice(collToken.symbol);

  const isLoanClosing = prevLoan && !loan;

  const loanDetails = loan
    && getLoanDetails(
      loan.deposit,
      loan.borrowed,
      loan.interestRate,
      collToken.collateralRatio,
      collPriceUsd.data ?? null,
    );

  const prevLoanDetails = prevLoan
    && getLoanDetails(
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
    typeof leverageFactor === "number"
      && depositPreLeverage
      && liquidationRisk
      && liquidationPrice,
  );

  const loadingStatus = useMemo(() => {
    if (loadingState !== "success") {
      return loadingState;
    }

    if (
      collPriceUsd.status === "pending"
      || (!isLoanClosing && !loanDetailsFilled)
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
          isSuccess={!displayAllDifferences && Boolean(isSuccess)}
        />
      );
    }

    return null;
  }, [
    isLoanClosing,
    loan,
    loanDetails,
    loanDetailsFilled,
    prevLoan,
    collToken,
    prevLoanDetails,
    leverageMode,
    displayAllDifferences,
    isSuccess,
  ]);

  return (
    <LoadingCard
      height={isLoanClosing ? LOAN_CARD_HEIGHT_REDUCED : LOAN_CARD_HEIGHT}
      leverage={leverageMode}
      loadingState={loadingStatus}
      onRetry={onRetry}
      txPreviewMode={txPreviewMode}
      isSuccess={!displayAllDifferences && Boolean(isSuccess)}
    >
      {content}
    </LoadingCard>
  );
}
