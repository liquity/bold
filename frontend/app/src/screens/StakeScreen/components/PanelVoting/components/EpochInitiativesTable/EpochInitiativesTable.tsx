import { css } from "@/styled-system/css";
import { TableHead } from "./components/TableHead";
import { TableBody } from "./components/TableBody";
import { TableFooter } from "./components/TableFooter";

import type { FC } from "react";

export const EpochInitiativesTable: FC = () => {
  return (
    <table
      className={css({
        width: "100%",
        borderCollapse: "collapse",
        userSelect: "none",
      })}
    >
      <TableHead />
      <TableBody />
      <TableFooter />
    </table>
  );
};
