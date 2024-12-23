import type { PositionLoanCommitted } from "@/src/types";

import { LoanStatusTag } from "@/src/comps/Tag/LoanStatusTag";
import { getPrefixedTroveId } from "@/src/liquity-utils";
import { useStoredState } from "@/src/services/StoredState";
import { PositionCardBorrow } from "./PositionCardBorrow";
import { PositionCardLeverage } from "./PositionCardLeverage";

export function PositionCardLoan(
  props: Pick<
    PositionLoanCommitted,
    | "type"
    | "batchManager"
    | "borrowed"
    | "collIndex"
    | "deposit"
    | "interestRate"
    | "status"
    | "troveId"
  >,
) {
  const storedState = useStoredState();

  // only works for existing troves
  if (!props.troveId) {
    return null;
  }

  const prefixedTroveId = getPrefixedTroveId(props.collIndex, props.troveId);
  const loanMode = storedState.loanModes[prefixedTroveId] ?? props.type;

  const Card = loanMode === "multiply" ? PositionCardLeverage : PositionCardBorrow;

  return (
    <Card
      {...props}
      statusTag={props.status === "liquidated"
        ? <LoanStatusTag status="liquidated" />
        : props.status === "redeemed"
        ? <LoanStatusTag status="redeemed" />
        : null}
    />
  );
}
