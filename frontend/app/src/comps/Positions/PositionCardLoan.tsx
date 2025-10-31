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
    | "recordedDebt"
    | "isZombie"
    | "liquidatedColl"
    | "liquidatedDebt"
    | "collSurplus"
    | "priceAtLiquidation"
  > & {
    collSurplusOnChain: dn.Dnum | null;
  },
) {
  const storedState = useStoredState();
  const prefixedTroveId = getPrefixedTroveId(props.branchId, props.troveId);
  const loanMode = storedState.loanModes[prefixedTroveId] ?? props.type;
  const Card = loanMode === "multiply" ? PositionCardLeverage : PositionCardBorrow;

  return (
    <Card
      {...props}
      statusTag={props.status === "liquidated"
        ? <LoanStatusTag status="liquidated" />
        : props.status === "redeemed"
        ? (
          <LoanStatusTag
            status={dn.eq(props.recordedDebt, 0)
              ? "fully-redeemed"
              : "partially-redeemed"}
          />
        )
        : null}
    />
  );
}
