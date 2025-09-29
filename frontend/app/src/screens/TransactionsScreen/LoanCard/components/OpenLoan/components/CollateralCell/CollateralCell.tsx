import { CrossedText } from "@/src/comps/CrossedText";
import { fmtnum } from "@/src/formatting";
import { GridItemWrapper } from "@/src/screens/TransactionsScreen/LoanCard/components/components/GridItemWrapper";
import * as dn from "dnum";

import type { Dnum } from "dnum";
import type { FC } from "react";

interface CollateralCellProps {
  leverageMode: boolean;
  deposit: Dnum;
  prevDeposit?: Dnum;
  collTokenName: string;
}

export const CollateralCell: FC<CollateralCellProps> = ({
  leverageMode,
  deposit,
  prevDeposit,
  collTokenName,
}) => {
  return (
    <GridItemWrapper label={leverageMode ? "Exposure" : "Collateral"}>
      <div title={`${fmtnum(deposit, "full")} ${collTokenName}`}>
        {fmtnum(deposit)} {collTokenName}
      </div>

      {prevDeposit && !dn.eq(prevDeposit, deposit) && (
        <CrossedText
          title={`${fmtnum(prevDeposit, "full")} ${collTokenName}`}
        >
          {fmtnum(prevDeposit)} {collTokenName}
        </CrossedText>
      )}
    </GridItemWrapper>
  );
};
