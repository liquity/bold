import { ceilDiv } from "@liquity2/uikit";

const DECIMAL_PRECISION = 10n ** 18n;
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
