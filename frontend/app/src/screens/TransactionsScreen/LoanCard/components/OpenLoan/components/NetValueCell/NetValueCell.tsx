import { Value } from "@/src/comps/Value/Value";
import * as dn from "dnum";
import { fmtnum } from "@/src/formatting";
import { GridItemWrapper } from "@/src/screens/TransactionsScreen/LoanCard/components/components/GridItemWrapper";
import { CrossedText } from "@/src/comps/CrossedText";

import type { Dnum } from "dnum";
import type { LoanDetails } from "@/src/types";
import type { FC } from "react";

interface NetValueCellProps {
  depositPreLeverage: Dnum;
  prevDepositPreLeverage?: LoanDetails["depositPreLeverage"];
  collTokenName: string;
  isUnderwater: boolean;
}

export const NetValueCell: FC<NetValueCellProps> = ({
  depositPreLeverage,
  prevDepositPreLeverage,
  collTokenName,
  isUnderwater,
}) => (
  <GridItemWrapper label="Net value">
    <Value
      negative={isUnderwater}
      title={`${fmtnum(depositPreLeverage, "full")} ${collTokenName}`}
    >
      {fmtnum(depositPreLeverage)} {collTokenName}
    </Value>

    {prevDepositPreLeverage &&
      !dn.eq(prevDepositPreLeverage, depositPreLeverage) && (
        <CrossedText
          title={`${fmtnum(prevDepositPreLeverage, "full")} ${collTokenName}`}
        >
          {fmtnum(prevDepositPreLeverage)} {collTokenName}
        </CrossedText>
      )}
  </GridItemWrapper>
);
