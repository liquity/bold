import { ceilDiv } from "@liquity2/uikit";

const DECIMAL_PRECISION = 10n ** 18n;
const _100pct = DECIMAL_PRECISION;
const _1pct = DECIMAL_PRECISION / 100n;
const SP_YIELD_SPLIT = 72n * _1pct; // 72%

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
  const secondPortion = epochScaleS2 / 10n ** 9n;

  return (initialDeposit * (firstPortion + secondPortion)) / snapshotsP / DECIMAL_PRECISION;
}

// This is an adaptation of getDepositorYieldGain() and
// _getYieldGainFromSnapshots() from LiquityStabilityPool.sol
export function getBoldGainFromSnapshots(
  initialDeposit: bigint,
  snapshotsP: bigint,
  snapshotsB: bigint,
  epochScaleB1: bigint, // B corresponding to the snapshot epoch + scale
  epochScaleB2: bigint, // B corresponding to the snapshot epoch + scale + 1
): bigint {
  if (initialDeposit === 0n) {
    return 0n;
  }

  const firstPortion = epochScaleB1 - snapshotsB;
  const secondPortion = epochScaleB2 / 10n ** 9n;

  return (initialDeposit * (firstPortion + secondPortion)) / snapshotsP / DECIMAL_PRECISION;
}

export function calcPendingSPYield(
  aggWeightedDebtSum: bigint,
  lastAggUpdateTime: bigint,
  currentTime: bigint,
): bigint {
  return calcPendingAggInterest(
    aggWeightedDebtSum,
    lastAggUpdateTime,
    currentTime,
  ) * SP_YIELD_SPLIT / DECIMAL_PRECISION;
}

export function calcPendingAggInterest(
  aggWeightedDebtSum: bigint,
  lastAggUpdateTime: bigint,
  currentTime: bigint,
): bigint {
  return ceilDiv(
    aggWeightedDebtSum * (currentTime - lastAggUpdateTime),
    365n * DECIMAL_PRECISION,
  );
}

function getDepositorYieldGainWithPending(
  deposit: {
    initialValue: bigint;
    snapshotsEpoch: bigint;
    snapshotsScale: bigint;
    snapshotsB: bigint;
    snapshotsP: bigint;
  },
  yieldGainsPending: bigint,
  aggWeightedDebtSum: bigint,
  lastAggUpdateTime: bigint,
  currentTime: bigint,
): bigint {
  if (deposit.initialValue === 0n) {
    return 0n;
  }

  const pendingSPYield = calcPendingSPYield(aggWeightedDebtSum, lastAggUpdateTime, currentTime);
  let firstPortionPending = 0n;
  let secondPortionPending = 0n;

  if (pendingSPYield > 0n && deposit.snapshotsEpoch === 0n && deposit.snapshotsScale === 0n) {
    const yieldNumerator = pendingSPYield * DECIMAL_PRECISION;
    const yieldPerUnitStaked = yieldNumerator / initialValue;
    const marginalYieldGain = yieldPerUnitStaked * SP_YIELD_SPLIT;

    if (snapshotsScale === 0n) {
      return initialValue * (marginalYieldGain + firstPortionPending - snapshotsB) / snapshotsP / DECIMAL_PRECISION;
    } else if (snapshotsScale === 1n) {
      return initialValue * (epochToScaleToB[snapshotsEpoch][snapshotsScale] + secondPortionPending) / snapshotsP
        / DECIMAL_PRECISION;
    }
  }

  return 0n;
}

// function getDepositorYieldGainWithPending(address _depositor) external view override returns (uint256) {
//     uint256 initialDeposit = deposits[_depositor].initialValue;

//     if (initialDeposit == 0) return 0;

//     Snapshots memory snapshots = depositSnapshots[_depositor];

//     uint256 pendingSPYield = activePool.calcPendingSPYield() + yieldGainsPending;
//     uint256 firstPortionPending;
//     uint256 secondPortionPending;

//     if (pendingSPYield > 0 && snapshots.epoch == currentEpoch && totalBoldDeposits >= DECIMAL_PRECISION) {
//         uint256 yieldNumerator = pendingSPYield * DECIMAL_PRECISION + lastYieldError;
//         uint256 yieldPerUnitStaked = yieldNumerator / totalBoldDeposits;
//         uint256 marginalYieldGain = yieldPerUnitStaked * P;

//         if (currentScale == snapshots.scale) firstPortionPending = marginalYieldGain;
//         else if (currentScale == snapshots.scale + 1) secondPortionPending = marginalYieldGain;
//     }

//     uint256 firstPortion = epochToScaleToB[snapshots.epoch][snapshots.scale] + firstPortionPending - snapshots.B;
//     uint256 secondPortion =
//         (epochToScaleToB[snapshots.epoch][snapshots.scale + 1] + secondPortionPending) / SCALE_FACTOR;

//     return initialDeposit * (firstPortion + secondPortion) / snapshots.P / DECIMAL_PRECISION;
// }
