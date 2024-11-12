import type { PositionLoanCommitted } from "@/src/types";

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
  return loanMode === "leverage"
    ? <PositionCardLeverage {...props} />
    : <PositionCardBorrow {...props} />;
}
