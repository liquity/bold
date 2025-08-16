import { GridItemWrapper } from "@/src/screens/TransactionsScreen/LoanCard/components/components/GridItemWrapper";
import { CrossedText } from '@/src/screens/TransactionsScreen/LoanCard/components/components/CrossedText';
import { fmtnum } from "@/src/formatting.ts";
import * as dn from "dnum";

import type { Dnum } from "dnum";
import type { FC } from "react";

interface CollateralCellProps {
  deposit: Dnum;
  prevDeposit?: Dnum;
  collTokenName: string;
}

export const CollateralCell: FC<CollateralCellProps> = ({
  deposit,
  prevDeposit,
  collTokenName,
}) => {
  return (
    <GridItemWrapper label="Collateral">
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
