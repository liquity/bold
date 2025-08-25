import { GridItemWrapper } from "@/src/screens/TransactionsScreen/LoanCard/components/components/GridItemWrapper";
import { fmtnum } from "@/src/formatting.ts";
import { CrossedText } from "@/src/comps/CrossedText";

import type { FC } from "react";
import type { PositionLoan } from "@/src/types";

interface CollateralCellProps {
  collTokenName: string;
  prevLoan?: PositionLoan;
}

export const CollateralRow: FC<CollateralCellProps> = ({
  collTokenName,
  prevLoan,
}) => (
  <GridItemWrapper label="Collateral">
    <div
      style={{
        color: "var(--colors-positive-alt)",
      }}
    >
      {fmtnum(0)} {collTokenName}
    </div>
    {prevLoan && (
      <CrossedText
        title={`${fmtnum(prevLoan.deposit, "full")} ${collTokenName}`}
      >
        {fmtnum(prevLoan.deposit)} {collTokenName}
      </CrossedText>
    )}
  </GridItemWrapper>
);
