import type { Address } from "@/src/types";
import type { Dnum } from "dnum";

import { TroveManager } from "@/src/abi/TroveManager";
import { CONTRACT_TROVE_MANAGER } from "@/src/env";
import { useReadContracts } from "wagmi";

const TroveManagerContract = {
  abi: TroveManager,
  address: CONTRACT_TROVE_MANAGER,
};

export function useTroveDetails(borrower: Address) {
  const read = useReadContracts({
    contracts: [
      {
        ...TroveManagerContract,
        functionName: "getTroveStatus",
        args: [borrower],
      },
      {
        ...TroveManagerContract,
        functionName: "getTroveStake",
        args: [borrower],
      },
      {
        ...TroveManagerContract,
        functionName: "getTroveDebt",
        args: [borrower],
      },
      {
        ...TroveManagerContract,
        functionName: "getTroveColl",
        args: [borrower],
      },
      {
        ...TroveManagerContract,
        functionName: "getTroveAnnualInterestRate",
        args: [borrower],
      },
    ],
  });

  if (!read.data) {
    return read;
  }

  const data: {
    status: number;
    stake: Dnum;
    debt: Dnum;
    collateral: Dnum;
    interestRate: Dnum;
  } = {
    status: Number(read.data[0].result),
    stake: [read.data[1].result ?? 0n, 18],
    debt: [read.data[2].result ?? 0n, 18],
    collateral: [read.data[3].result ?? 0n, 18],
    interestRate: [read.data[4].result ?? 0n, 18],
  };

  return { ...read, data };
}
