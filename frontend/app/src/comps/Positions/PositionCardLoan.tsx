import type { PositionLoanCommitted } from "@/src/types";

import { LoanStatusTag } from "@/src/comps/Tag/LoanStatusTag";
import { getPrefixedTroveId, useLoan } from "@/src/liquity-utils";
import { useStoredState } from "@/src/services/StoredState";
import { PositionCardBorrow } from "./PositionCardBorrow";
import { PositionCardLeverage } from "./PositionCardLeverage";

export function PositionCardLoan(
  props: Pick<
    PositionLoanCommitted,
    | "type"
    | "batchManager"
    | "borrowed"
    | "branchId"
    | "deposit"
    | "interestRate"
    | "status"
    | "troveId"
  >,
) {
  const storedState = useStoredState();

  const loan = useLoan(props.branchId, props.troveId);

  const prefixedTroveId = getPrefixedTroveId(props.branchId, props.troveId);
  const loanMode = storedState.loanModes[prefixedTroveId] ?? props.type;

  const Card = loanMode === "multiply" ? PositionCardLeverage : PositionCardBorrow;

  return (
    <Card
      {...props}
      debt={loan.data?.borrowed ?? null}
      statusTag={props.status === "liquidated"
        ? <LoanStatusTag status="liquidated" />
        : props.status === "redeemed"
        ? <LoanStatusTag status="redeemed" />
        : null}
    />
  );
}
