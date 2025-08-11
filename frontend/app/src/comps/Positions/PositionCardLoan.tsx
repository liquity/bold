import * as dn from "dnum";

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
    | "branchId"
    | "deposit"
    | "interestRate"
    | "status"
    | "troveId"
    | "indexedDebt"
  >,
) {
  const storedState = useStoredState();
  const prefixedTroveId = getPrefixedTroveId(props.branchId, props.troveId);
  const loanMode = storedState.loanModes[prefixedTroveId] ?? props.type;

  const Card = loanMode === "multiply" ? PositionCardLeverage : PositionCardBorrow;

  return (
    <Card
      {...props}
      debt={!props.borrowed || props.status === "liquidated"
        ? null
        : props.borrowed}
      deposit={!props.deposit || props.status === "liquidated"
        ? null
        : props.deposit}
      liquidated={props.status === "liquidated"}
      statusTag={props.status === "liquidated"
        ? <LoanStatusTag status="liquidated" />
        : props.status === "redeemed"
        ? (
          <LoanStatusTag
            status={dn.eq(props.indexedDebt, 0)
              ? "fully-redeemed"
              : "partially-redeemed"}
          />
        )
        : null}
    />
  );
}
