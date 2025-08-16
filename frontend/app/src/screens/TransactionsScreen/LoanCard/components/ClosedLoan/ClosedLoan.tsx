import * as dn from "dnum";
import { css } from "@/styled-system/css";
import { TotalDebt } from "@/src/screens/TransactionsScreen/LoanCard/components/components/TotalDebt";
import {
  CollateralRow
} from './components/CollateralRow';

import type { FC } from "react";
import type { PositionLoan } from "@/src/types.ts";

interface ClosedLoanProps {
  prevLoan: PositionLoan;
  collTokenName: string;
}

export const ClosedLoan: FC<ClosedLoanProps> = ({ prevLoan, collTokenName }) => (
  <>
    <TotalDebt
      positive
      loan={{
        ...prevLoan,
        deposit: dn.from(0, 18),
        borrowed: dn.from(0, 18),
      }}
      prevLoan={prevLoan}
    />
    <div
      className={css({
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: 12,
        paddingTop: 32,
      })}
    >
      <CollateralRow collTokenName={collTokenName} prevLoan={prevLoan} />
    </div>
  </>
);
