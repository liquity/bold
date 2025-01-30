import type { Address, CollateralSymbol, CollIndex } from "@/src/types";

import { SP_YIELD_SPLIT } from "@/src/constants";
import { getCollateralContract } from "@/src/contracts";
import { dnum18 } from "@/src/dnum-utils";
import { CHAIN_CONTRACT_MULTICALL } from "@/src/env";
import { getCollToken } from "@/src/liquity-utils";
import { useStabilityPoolDeposit, useStabilityPoolEpochScale } from "@/src/subgraph-hooks";
import { useCallback, useMemo } from "react";
import { useReadContracts } from "wagmi";

const DECIMAL_PRECISION = 10n ** 18n;
const SCALE_FACTOR = 10n ** 9n;
const ONE_YEAR = 365n * 24n * 60n * 60n * 1000n;

// This is an adaptation of getDepositorCollGain() and
// _getCollGainFromSnapshots() from LiquityStabilityPool.sol
export function getCollGainFromSnapshots(
  initialDeposit: bigint,
  snapshotsP: bigint,
  snapshotsS: bigint,
  epochScaleS1: bigint, // S corresponding to the snapshot epoch + scale
  epochScaleS2: bigint, // S corresponding to the snapshot epoch + scale + 1
): bigint {
  if (initialDeposit === 0n) {
    return 0n;
  }

  const firstPortion = epochScaleS1 - snapshotsS;
  const secondPortion = epochScaleS2 / SCALE_FACTOR;

  return (initialDeposit * (firstPortion + secondPortion)) / snapshotsP / DECIMAL_PRECISION;
}

export function useContinuousBoldGains(account: null | Address, collIndex: null | CollIndex) {
  const collateral = getCollToken(collIndex);
  const spYieldGainParams = useSpYieldGainParameters(collateral?.symbol ?? null);
  const deposit = useStabilityPoolDeposit(collIndex, account);
  const epochScale1 = useStabilityPoolEpochScale(
    collIndex,
    deposit.data?.snapshot.epoch ?? null,
    deposit.data?.snapshot.scale ?? null,
  );
  const epochScale2 = useStabilityPoolEpochScale(
    collIndex,
    deposit.data?.snapshot.epoch ?? null,
    deposit.data?.snapshot.scale ? deposit.data?.snapshot.scale + 1n : null,
  );

  const depositParams = useMemo(() => {
    if (!deposit.data || !epochScale1.data || !epochScale2.data) {
      return null;
    }
    return {
      initialDeposit: deposit.data.deposit,
      snapshotsEpoch: deposit.data.snapshot.epoch,
      snapshotsScale: deposit.data.snapshot.scale,
      snapshotsB: deposit.data.snapshot.B,
      snapshotsP: deposit.data.snapshot.P,
      BFromEpochScale: epochScale1.data.B,
      BFromEpochScalePlusOne: epochScale2.data.B,
    };
  }, [deposit.data, epochScale1.data, epochScale2.data]);

  const getBoldGains = useCallback((now: number) => {
    if (!spYieldGainParams.data || !depositParams) {
      return null;
    }
    return dnum18(
      getDepositorYieldGainWithPending(
        depositParams,
        spYieldGainParams.data,
        BigInt(now),
      ),
    );
  }, [depositParams, spYieldGainParams.data]);

  const queryResultBase = [
    spYieldGainParams,
    deposit,
    epochScale1,
    epochScale2,
  ].find((r) => r.status !== "success") ?? epochScale2;

  return {
    ...queryResultBase,
    data: queryResultBase.status === "success" ? getBoldGains : null,
  };
}

type SPYieldGainParameters = {
  P: bigint;
  aggWeightedDebtSum: bigint;
  currentEpoch: bigint;
  currentScale: bigint;
  lastAggUpdateTime: bigint;
  lastYieldError: bigint;
  totalBoldDeposits: bigint;
  yieldGainsPending: bigint;
};

type DepositParameters = {
  initialDeposit: bigint;
  snapshotsEpoch: bigint;
  snapshotsScale: bigint;
  snapshotsB: bigint;
  snapshotsP: bigint;
  BFromEpochScale: bigint;
  BFromEpochScalePlusOne: bigint;
};

function useSpYieldGainParameters(symbol: CollateralSymbol | null) {
  const ActivePool = getCollateralContract(symbol, "ActivePool");
  const StabilityPool = getCollateralContract(symbol, "StabilityPool");

  const AP = ActivePool as NonNullable<typeof ActivePool>;
  const SP = StabilityPool as NonNullable<typeof StabilityPool>;

  return useReadContracts({
    contracts: [
      { ...SP, functionName: "P" },
      { ...AP, functionName: "aggWeightedDebtSum" },
      { ...SP, functionName: "currentEpoch" },
      { ...SP, functionName: "currentScale" },
      { ...AP, functionName: "lastAggUpdateTime" },
      { ...SP, functionName: "lastYieldError" },
      { ...SP, functionName: "getTotalBoldDeposits" },
      { ...SP, functionName: "getYieldGainsPending" },
    ],
    multicallAddress: CHAIN_CONTRACT_MULTICALL,
    query: {
      refetchInterval: 30_000,
      select: ([
        { result: P },
        { result: aggWeightedDebtSum },
        { result: currentEpoch },
        { result: currentScale },
        { result: lastAggUpdateTime },
        { result: lastYieldError },
        { result: totalBoldDeposits },
        { result: yieldGainsPending },
      ]): SPYieldGainParameters | null => {
        const params = {
          P,
          aggWeightedDebtSum,
          currentEpoch,
          currentScale,
          lastAggUpdateTime,
          lastYieldError,
          totalBoldDeposits,
          yieldGainsPending,
        };
        for (const value of Object.values(params)) {
          if (typeof value !== "bigint") {
            return null;
          }
        }
        return params as SPYieldGainParameters;
      },
    },
  });
}

// This is an adaptation of getDepositorYieldGainWithPending() from LiquityStabilityPool.sol
function getDepositorYieldGainWithPending(
  depositParams: DepositParameters,
  spYieldGainParams: SPYieldGainParameters,
  currentTime: bigint,
): bigint {
  const {
    initialDeposit,
    snapshotsEpoch,
    snapshotsScale,
    snapshotsB,
    snapshotsP,
    BFromEpochScale,
    BFromEpochScalePlusOne,
  } = depositParams;

  const {
    P,
    aggWeightedDebtSum,
    currentEpoch,
    currentScale,
    lastAggUpdateTime,
    lastYieldError,
    totalBoldDeposits,
    yieldGainsPending,
  } = spYieldGainParams;

  if (initialDeposit === 0n) return 0n;

  // In StabilityPool.sol:
  // uint256 pendingSPYield = activePool.calcPendingSPYield() + yieldGainsPending
  const pendingSPYield = calcPendingSPYield(
    aggWeightedDebtSum,
    lastAggUpdateTime * 1000n,
    currentTime,
  ) + yieldGainsPending;

  let firstPortionPending = 0n;
  let secondPortionPending = 0n;

  if (pendingSPYield > 0n && snapshotsEpoch === currentEpoch && totalBoldDeposits >= DECIMAL_PRECISION) {
    const yieldNumerator = pendingSPYield * DECIMAL_PRECISION + lastYieldError;
    const yieldPerUnitStaked = yieldNumerator / totalBoldDeposits;
    const marginalYieldGain = yieldPerUnitStaked * P;

    if (currentScale === snapshotsScale) {
      firstPortionPending = marginalYieldGain;
    } else if (currentScale === snapshotsScale + 1n) {
      secondPortionPending = marginalYieldGain;
    }
  }

  const firstPortion = BFromEpochScale + firstPortionPending - snapshotsB;
  const secondPortion = (BFromEpochScalePlusOne + secondPortionPending) / SCALE_FACTOR;

  return initialDeposit * (firstPortion + secondPortion) / snapshotsP / DECIMAL_PRECISION;
}

// activePool.calcPendingSPYield()
function calcPendingSPYield(
  aggWeightedDebtSum: bigint,
  lastAggUpdateTime: bigint,
  currentTime: bigint,
) {
  return ceilDiv(
    aggWeightedDebtSum * (currentTime - lastAggUpdateTime),
    ONE_YEAR * DECIMAL_PRECISION,
  ) * SP_YIELD_SPLIT / DECIMAL_PRECISION;
}

// from OpenZeppelin's Math.sol
function ceilDiv(a: bigint, b: bigint) {
  return (a + b - 1n) / b;
}
