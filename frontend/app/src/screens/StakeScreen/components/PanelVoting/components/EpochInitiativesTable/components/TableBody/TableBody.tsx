import { useActiveInitiatives } from "./hooks";
import { InitiativeRow } from "./components/InitiativeRow";
import { css } from "@/styled-system/css";

import type { FC } from "react";

export const TableBody: FC = () => {
  const activeInitiatives = useActiveInitiatives();

  return (
    <tbody
      className={css({
        "& td": {
          verticalAlign: "top",
          fontSize: 14,
          textAlign: "right",
          padding: 8,
        },
        "& td:first-child": {
          paddingLeft: 0,
          textAlign: "left",
        },
        "& td:last-child": {
          paddingRight: 0,
        },
        "& td:nth-of-type(2) > div, & td:nth-of-type(3) > div, & td:nth-of-type(4) > div":
          {
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            minHeight: 34,
          },
        "& tr:last-child td": {
          paddingBottom: 16,
        },
      })}
    >
      {activeInitiatives.map((initiative) => {
        return (
          <InitiativeRow key={initiative.address} initiative={initiative} />
        );
      })}
    </tbody>
  );
};
