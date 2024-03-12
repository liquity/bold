"use client";

import { css } from "@/styled-system/css";
import { ContractBorrowerOperations } from "./ContractBorrowerOperations";
import { ContractStabilityPool } from "./ContractStabilityPool";

export default function Home() {
  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 160,
        width: "100%",
        paddingTop: 80,
      })}
    >
      <ContractBorrowerOperations />
      <ContractStabilityPool />
    </div>
  );
}
