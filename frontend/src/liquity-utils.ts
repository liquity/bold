import type { Address, TroveId } from "@/src/types";
import type { Dnum } from "dnum";

import {
  BorrowerOperationsContract,
  CollTokenContract,
  StabilityPoolContract,
  TroveManagerContract,
} from "@/src/contracts";
import { ADDRESS_ZERO } from "@/src/eth-utils";
import * as dn from "dnum";
import { match } from "ts-pattern";
import { encodeAbiParameters, keccak256, maxUint256, parseAbiParameters } from "viem";
import { useAccount, useReadContract, useReadContracts, useWriteContract } from "wagmi";

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
  // trovesCount: number;
  redemptionRate: Dnum;
  tcr: Dnum;
  totalBoldDeposits: Dnum;
  totalCollateral: Dnum;
  totalDebt: Dnum;
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

export function useTroveDetails(troveId: TroveId = 0n) {
  const read = useReadContracts({
    allowFailure: false,
    contracts: [
      {
        ...TroveManagerContract,
        functionName: "getTroveStatus",
        args: [troveId],
      },
      {
        ...TroveManagerContract,
        functionName: "getTroveStake",
        args: [troveId],
      },
      {
        ...TroveManagerContract,
        functionName: "getTroveDebt",
        args: [troveId],
      },
      {
        ...TroveManagerContract,
        functionName: "getTroveColl",
        args: [troveId],
      },
      {
        ...TroveManagerContract,
        functionName: "getTroveAnnualInterestRate",
        args: [troveId],
      },
    ],
  });

  if (!read.data || read.status !== "success") {
    return { ...read, data: undefined };
  }

  const troveStatusNumber = Number(read.data[0]);

  const data: TroveDetails = {
    status: troveStatusFromNumber(isNaN(troveStatusNumber) ? 0 : troveStatusNumber),
    stake: [read.data[1] ?? 0n, 18],
    debt: [read.data[2] ?? 0n, 18],
    collateral: [read.data[3] ?? 0n, 18],
    interestRate: [read.data[4] ?? 0n, 18],
  };

  return { ...read, data };
}

export function useOpenTrove(owner: Address, {
  ownerIndex,
  maxFeePercentage,
  boldAmount,
  upperHint,
  lowerHint,
  interestRate,
  ethAmount,
}: {
  ownerIndex: bigint;
  maxFeePercentage: bigint; // 0 to 1 * 10^18
  boldAmount: bigint; // amount * 10^18
  upperHint: bigint;
  lowerHint: bigint;
  interestRate: bigint; // 0 to 1 * 10^18
  ethAmount: bigint; // amount * 10^18
}) {
  const { writeContract } = useWriteContract();
  return () => (
    writeContract({
      ...BorrowerOperationsContract,
      functionName: "openTrove",
      args: [
        owner,
        ownerIndex,
        maxFeePercentage,
        ethAmount,
        boldAmount,
        upperHint,
        lowerHint,
        interestRate,
      ],
    })
  );
}

export function useCloseTrove(troveId: TroveId) {
  const { writeContract } = useWriteContract();
  return () => (
    writeContract({
      ...BorrowerOperationsContract,
      functionName: "closeTrove",
      args: [troveId],
    })
  );
}

export function useRewards(troveId: TroveId) {
  const read = useReadContracts({
    allowFailure: false,
    contracts: [
      {
        ...TroveManagerContract,
        functionName: "getPendingETHReward",
        args: [troveId],
      },
      {
        ...TroveManagerContract,
        functionName: "getPendingBoldDebtReward",
        args: [troveId],
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

export function useStabilityPoolStats() {
  const read = useReadContracts({
    allowFailure: false,
    contracts: [
      {
        ...StabilityPoolContract,
        functionName: "getTotalBoldDeposits",
      },
      {
        ...StabilityPoolContract,
        functionName: "getETHBalance",
      },
    ],
  });

  if (!read.data || read.status !== "success") {
    return {
      ...read,
      data: undefined,
    };
  }

  const data = {
    totalBoldDeposits: [read.data[0], 18],
    ethBalance: [read.data[1], 18],
  } as const;

  return { ...read, data };
}

export function useLiquity2Info() {
  const read = useReadContracts({
    allowFailure: false,
    contracts: [
      // {
      //   ...TroveManagerContract,
      //   functionName: "getTroveOwnersCount",
      //   args: [],
      // },
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
        args: [200n * 10n ** 18n],
      },
      {
        ...TroveManagerContract,
        functionName: "getRedemptionRate",
        args: [],
      },
      {
        ...StabilityPoolContract,
        functionName: "getTotalBoldDeposits",
      },
    ],
  });

  if (!read.data || read.status !== "success") {
    return {
      ...read,
      data: undefined,
    };
  }

  const tcr = [read.data[2], 18] as const;

  const data: LiquityInfo = {
    // trovesCount: Number(read.data[0]),
    redemptionRate: [read.data[3], 18],
    tcr: dn.gt(tcr, 1) ? [0n, 18] : tcr,
    totalBoldDeposits: [read.data[4], 18],
    totalCollateral: [read.data[0], 18],
    totalDebt: [read.data[1], 18],
  };

  return { ...read, data };
}

export function getTroveId(owner: Address, ownerIndex: bigint) {
  return BigInt(keccak256(encodeAbiParameters(
    parseAbiParameters("address, uint256"),
    [owner, ownerIndex],
  )));
}

export function useTapCollTokenFaucet() {
  const { writeContract } = useWriteContract();
  return () => (
    writeContract({
      ...CollTokenContract,
      functionName: "tap",
      args: [],
    })
  );
}

export function useCollTokenAllowance() {
  const account = useAccount();

  const allowance = useReadContract({
    ...CollTokenContract,
    functionName: "allowance",
    args: [account.address ?? ADDRESS_ZERO, BorrowerOperationsContract.address],
  });

  const collTokenWrite = useWriteContract();
  const approve = (amount = maxUint256) => (
    collTokenWrite.writeContract({
      ...CollTokenContract,
      functionName: "approve",
      args: [BorrowerOperationsContract.address, amount],
    })
  );

  return {
    allowance,
    collTokenWrite,
    approve,
  } as const;
}
