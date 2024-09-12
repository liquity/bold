import type { TroveId } from "@/src/types";
import type { Address, CollateralSymbol } from "@liquity2/uikit";
import type { Dnum } from "dnum";

import { useCollateralContract, useProtocolContract } from "@/src/contracts";
import { ADDRESS_ZERO } from "@/src/eth-utils";
import { useWatchQueries } from "@/src/wagmi-utils";
import { useEffect, useState } from "react";
import { match } from "ts-pattern";
import { encodeAbiParameters, keccak256, maxUint256, parseAbiParameters } from "viem";
import { useAccount, useBalance, useReadContract, useReadContracts, useWriteContract } from "wagmi";

// TODO: make the collateral index dynamic
const collSymbol = "ETH" as const;

// As defined in ITroveManager.sol
export type TroveStatus =
  | "nonExistent"
  | "active"
  | "closedByOwner"
  | "closedByLiquidation"
  | "unredeemable";

type TroveDetails = {
  status: TroveStatus;
  stake: Dnum;
  debt: Dnum;
  collateral: Dnum;
  interestRate: Dnum;
};

type Rewards = {
  eth: Dnum;
  bold: Dnum;
};

export function shortenTroveId(troveId: TroveId, chars = 4) {
  return troveId.length < chars * 2 + 2
    ? troveId
    : troveId.slice(0, chars + 2) + "…" + troveId.slice(-chars);
}

function troveStatusFromNumber(value: number): TroveStatus {
  return match<number, TroveStatus>(value)
    .with(0, () => "nonExistent")
    .with(1, () => "active")
    .with(2, () => "closedByOwner")
    .with(3, () => "closedByLiquidation")
    .with(4, () => "unredeemable")
    .otherwise(() => {
      throw new Error(`Unknown trove status number: ${value}`);
    });
}

export function troveStatusToLabel(status: TroveStatus) {
  return match(status)
    .with("nonExistent", () => "Non-existent")
    .with("active", () => "Active")
    .with("closedByOwner", () => "Closed by owner")
    .with("closedByLiquidation", () => "Closed by liquidation")
    .with("unredeemable", () => "Unredeemable")
    .exhaustive();
}

export function useTroveDetails(troveId: TroveId = 0n) {
  const TroveManagerContract = useCollateralContract(collSymbol, "TroveManager");

  const read = useReadContracts({
    allowFailure: false,
    contracts: TroveManagerContract
      ? [
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
      ]
      : [],
  });

  useWatchQueries([read]);

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

export function useFindAvailableTroveIndex(owner?: Address | null):
  | {
    data: number;
    error: undefined;
    status: "success";
  }
  | {
    data: undefined;
    error: undefined;
    status: "loading";
  }
  | {
    data: undefined;
    error: Error;
    status: "error";
  }
  | {
    data: undefined;
    error: undefined;
    status: "idle";
  }
{
  const [troveIndex, setTroveIndex] = useState(0);

  // reset trove search when owner changes
  useEffect(() => {
    if (owner) {
      setTroveIndex(0);
    }
  }, [owner]);

  const TroveManagerContract = useCollateralContract(collSymbol, "TroveManager");

  const read = useReadContract(
    owner
      ? {
        ...TroveManagerContract,
        functionName: "checkTroveIsOpen",
        args: [getTroveId(owner, BigInt(troveIndex))],
      }
      : {},
  );

  useWatchQueries([read]);

  if (owner === null || owner === undefined) {
    return {
      data: undefined,
      error: undefined,
      status: "idle",
    };
  }

  if (read.data === true) {
    setTroveIndex(troveIndex + 1);
    return {
      data: undefined,
      error: undefined,
      status: "loading",
    };
  }

  if (read.data === false) {
    return {
      data: troveIndex,
      error: undefined,
      status: "success",
    };
  }

  if (read.status === "error") {
    return {
      data: undefined,
      error: read.error,
      status: "error",
    };
  }

  return {
    data: undefined,
    error: undefined,
    status: "loading",
  };
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

  const BorrowerOperationsContract = useCollateralContract(collSymbol, "BorrowerOperations");

  return () => {
    if (BorrowerOperationsContract) {
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
      });
    }
  };
}

export function useCloseTrove(troveId: TroveId) {
  const { writeContract } = useWriteContract();

  const BorrowerOperationsContract = useCollateralContract(collSymbol, "BorrowerOperations");

  return () => {
    if (BorrowerOperationsContract) {
      writeContract({
        ...BorrowerOperationsContract,
        functionName: "closeTrove",
        args: [troveId],
      });
    }
  };
}

export function useTroveRewards(troveId: TroveId) {
  const TroveManagerContract = useCollateralContract(collSymbol, "TroveManager");

  const read = useReadContracts({
    allowFailure: false,
    contracts: TroveManagerContract
      ? [
        {
          ...TroveManagerContract,
          functionName: "getPendingCollReward",
          args: [troveId],
        },
        {
          ...TroveManagerContract,
          functionName: "getPendingBoldDebtReward",
          args: [troveId],
        },
      ]
      : [],
  });
  useWatchQueries([read]);

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
  const StabilityPoolContract = useCollateralContract(collSymbol, "StabilityPool");

  const read = useReadContracts({
    allowFailure: false,
    contracts: [
      {
        ...StabilityPoolContract,
        functionName: "getTotalBoldDeposits",
      },
      {
        ...StabilityPoolContract,
        functionName: "getCollBalance",
      },
    ],
  });
  useWatchQueries([read]);

  if (!read.data || read.status !== "success") {
    return {
      ...read,
      data: undefined,
    };
  }

  const data = {
    totalBoldDeposits: [read.data[0], 18],
    collBalance: [read.data[1], 18],
  } as const;

  return { ...read, data };
}

export function getTroveId(owner: Address, ownerIndex: bigint | number) {
  return BigInt(keccak256(encodeAbiParameters(
    parseAbiParameters("address, uint256"),
    [owner, BigInt(ownerIndex)],
  )));
}

export function getCollateralFromTroveSymbol(symbol: string): null | CollateralSymbol {
  symbol = symbol.toUpperCase();
  if (symbol === "ETH" || symbol === "WETH") {
    return "ETH";
  }
  // this is to handle symbols used for testing, like stETH1, stETH2, etc.
  if (symbol.startsWith("RETH")) {
    return "RETH";
  }
  if (symbol.startsWith("STETH")) {
    return "STETH";
  }
  return null;
}

export function useCollTokenAllowance() {
  const account = useAccount();

  const BorrowerOperationsContract = useCollateralContract(collSymbol, "BorrowerOperations");
  const CollTokenContract = useProtocolContract("BoldToken");

  const allowance = useReadContract({
    ...CollTokenContract,
    functionName: "allowance",
    args: [account.address ?? ADDRESS_ZERO, BorrowerOperationsContract?.address ?? ADDRESS_ZERO],
  });
  useWatchQueries([allowance]);

  const collTokenWrite = useWriteContract();
  const approve = (amount = maxUint256) => (
    collTokenWrite.writeContract({
      ...CollTokenContract,
      functionName: "approve",
      args: [BorrowerOperationsContract?.address ?? ADDRESS_ZERO, amount],
    })
  );

  return {
    allowance,
    collTokenWrite,
    approve,
  } as const;
}

export function useAccountBalances(address: Address | undefined, updateInterval?: number) {
  const ethBalance = useBalance({
    address: address ?? ADDRESS_ZERO,
    query: {
      select: ({ value }) => [value ?? 0n, 18] as const,
    },
  });

  const BoldTokenContract = useProtocolContract("BoldToken");
  const CollTokenContract = useCollateralContract(collSymbol, "Token");

  const readTokenBalances = useReadContracts({
    contracts: [
      {
        ...BoldTokenContract,
        functionName: "balanceOf",
        args: [address ?? ADDRESS_ZERO],
      },
      {
        ...CollTokenContract,
        functionName: "balanceOf",
        args: [address ?? ADDRESS_ZERO],
      },
    ],
    query: {
      select: (data) => data.map(({ result }) => [result ?? 0n, 18] as const),
    },
  });

  useWatchQueries([ethBalance, readTokenBalances], updateInterval);

  return {
    boldBalance: readTokenBalances.data?.[0],
    collBalance: readTokenBalances.data?.[1],
    error: ethBalance.error ?? readTokenBalances.error,
    ethBalance: ethBalance.data,
    status: ethBalance.status === "success" ? readTokenBalances.status : ethBalance.status,
  };
}
