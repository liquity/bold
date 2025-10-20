import { css } from "@/styled-system/css";
import { GridItem } from '@/src/screens/TransactionsScreen/LoanCard/components/components/GridItem';

import type { FC, PropsWithChildren } from "react";

interface WrapperProps extends PropsWithChildren {
  label: string;
  title?: string;
}

export const GridItemWrapper: FC<WrapperProps> = ({ label, title, children }) => {
  return (
    <GridItem label={label} title={title}>
      <div
        className={css({
          display: "flex",
          alignItems: "center",
          gap: 8,
        })}
      >
        {children}
      </div>
    </GridItem>
  );
};
