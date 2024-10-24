import type { PositionLoan } from "@/src/types";

import { getPrefixedTroveId } from "@/src/liquity-utils";
import { useStoredState } from "@/src/services/StoredState";
import { PositionCardBorrow } from "./PositionCardBorrow";
import { PositionCardLeverage } from "./PositionCardLeverage";

export function PositionCardLoan(
  props: Pick<
    PositionLoan,
    | "batchManager"
    | "borrowed"
    | "collIndex"
    | "collateral"
    | "deposit"
    | "interestRate"
    | "troveId"
  >,
) {
  const storedState = useStoredState();
  const prefixedTroveId = getPrefixedTroveId(props.collIndex, props.troveId);
  const loanMode = storedState.loanModes[prefixedTroveId] ?? "borrow";
  return loanMode === "leverage"
    ? <PositionCardLeverage {...props} />
    : <PositionCardBorrow {...props} />;
}
