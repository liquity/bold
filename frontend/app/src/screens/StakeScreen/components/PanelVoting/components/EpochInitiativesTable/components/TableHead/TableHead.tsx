import { css } from "@/styled-system/css";
import { useHasAllocations } from '@/src/screens/StakeScreen/components/PanelVoting/hooks';

import type { FC } from "react";

export const TableHead: FC = () => {
  const hasAnyAllocations = useHasAllocations()

  return (
    <thead
      className={css({
        "& th": {
          lineHeight: 1.2,
          fontSize: 12,
          fontWeight: 400,
          color: "contentAlt",
          textAlign: "right",
          verticalAlign: "bottom",
          padding: "8px 0",
          borderBottom: "1px solid token(colors.tableBorder)",
        },
        "& th:first-child": {
          textAlign: "left",
        },
      })}
    >
      <tr>
        <th>
          Epoch
          <br /> Initiatives
        </th>
        <th>{hasAnyAllocations ? "Allocation" : "Decision"}</th>
      </tr>
    </thead>
  );
};
