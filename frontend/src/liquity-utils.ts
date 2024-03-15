import type { Address } from "@/src/types";
import type { Dnum } from "dnum";

import { BoldTokenContract, BorrowerOperationsContract, TroveManagerContract } from "@/src/contracts";
import { match } from "ts-pattern";
import { useReadContract, useReadContracts, useWriteContract } from "wagmi";

type TroveStatus =
  | "nonExistent"
  | "active"
  | "closedByOwner"
  | "closedByLiquidation"
  | "closedByRedemption";

type TroveDetails = {
  status: TroveStatus;
  stake: Dnum;
  debt: Dnum;
  collateral: Dnum;
  interestRate: Dnum;
};

type LiquityInfo = {
  trovesCount: number;
  totalCollateral: Dnum;
  totalDebt: Dnum;
  tcr: Dnum;
  redemptionRate: Dnum;
};

type Rewards = {
  eth: Dnum;
  bold: Dnum;
};

function troveStatusFromNumber(value: number): TroveStatus {
  return match<number, TroveStatus>(value)
    .with(0, () => "nonExistent")
    .with(1, () => "active")
    .with(2, () => "closedByOwner")
    .with(3, () => "closedByLiquidation")
    .with(4, () => "closedByRedemption")
    .otherwise(() => {
      throw new Error(`Unknown trove status number: ${value}`);
    });
}

export function useTroveDetails(borrower: Address) {
  const read = useReadContracts({
    allowFailure: false,
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

  if (!read.data || read.status !== "success") {
    return {
      ...read,
      data: undefined,
    };
  }

  const troveStatusNumber = Number(read.data[0]);

  const data: TroveDetails = {
    status: troveStatusFromNumber(isNaN(troveStatusNumber) ? 0 : troveStatusNumber),
    stake: [read.data[1] ?? 0n, 18],
    debt: [read.data[2] ?? 0n, 18],
    collateral: [read.data[3] ?? 0n, 18],
    interestRate: [read.data[4] ?? 0n, 18],
  };

  return {
    ...read,
    data,
  };
}

export function useOpenTrove(address: Address, {
  maxFeePercentage,
  boldAmount,
  upperHint,
  lowerHint,
  interestRate,
  value,
}: {
  maxFeePercentage: bigint; // 0 to 1 * 10^18
  boldAmount: bigint; // amount * 10^18
  upperHint: Address;
  lowerHint: Address;
  interestRate: bigint; // 0 to 1 * 10^18
  value: bigint; // amount * 10^18
}) {
  const { writeContract } = useWriteContract();
  return () => (
    writeContract({
      ...BorrowerOperationsContract,
      functionName: "openTrove",
      args: [
        maxFeePercentage,
        boldAmount,
        upperHint,
        lowerHint,
        interestRate,
      ],
      account: address,
      value: value,
    })
  );
}

export function useCloseTrove(address: Address) {
  const { writeContract } = useWriteContract();
  return () => (
    writeContract({
      ...BorrowerOperationsContract,
      functionName: "closeTrove",
      args: [],
      account: address,
    })
  );
}

export function useBoldBalance(address: Address) {
  return useReadContract({
    ...BoldTokenContract,
    functionName: "balanceOf",
    args: [address],
  });
}

export function useRewards(address: Address) {
  const read = useReadContracts({
    allowFailure: false,
    contracts: [
      {
        ...TroveManagerContract,
        functionName: "getPendingETHReward",
        args: [address],
      },
      {
        ...TroveManagerContract,
        functionName: "getPendingBoldDebtReward",
        args: [address],
      },
    ],
  });

  if (!read.data || read.status !== "success") {
    return {
      ...read,
      data: undefined,
    };
  }

  const data: Rewards = {
    eth: [read.data[0] ?? 0n, 18],
    bold: [read.data[1] ?? 0n, 18],
  };

  return {
    ...read,
    data,
  };
}

export function useLiquity2Info() {
  const read = useReadContracts({
    allowFailure: false,
    contracts: [
      {
        ...TroveManagerContract,
        functionName: "getTroveOwnersCount",
        args: [],
      },
      {
        ...TroveManagerContract,
        functionName: "getEntireSystemColl",
        args: [],
      },
      {
        ...TroveManagerContract,
        functionName: "getEntireSystemDebt",
        args: [],
      },
      {
        ...TroveManagerContract,
        functionName: "getTCR",
        args: [4_000n * 10n ** 18n],
      },
      {
        ...TroveManagerContract,
        functionName: "getRedemptionRate",
        args: [],
      },
    ],
  });

  if (!read.data || read.status !== "success") {
    return {
      ...read,
      data: undefined,
    };
  }

  const data: LiquityInfo = {
    trovesCount: Number(read.data[0]),
    totalCollateral: [read.data[1], 18],
    totalDebt: [read.data[2], 18],
    tcr: [read.data[3], 18],
    redemptionRate: [read.data[4], 18],
  };

  return {
    ...read,
    data,
  };
}
