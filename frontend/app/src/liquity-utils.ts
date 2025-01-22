import type { StabilityPoolDepositQuery } from "@/src/graphql/graphql";
import type { CollIndex, Dnum, PositionEarn, PositionStake, PrefixedTroveId, TroveId } from "@/src/types";
import type { Address, CollateralSymbol, CollateralToken } from "@liquity2/uikit";

import { DATA_REFRESH_INTERVAL, INTEREST_RATE_INCREMENT, INTEREST_RATE_MAX, INTEREST_RATE_MIN } from "@/src/constants";
import { getCollateralContract, getContracts, getProtocolContract } from "@/src/contracts";
import { dnum18 } from "@/src/dnum-utils";
import { CHAIN_BLOCK_EXPLORER } from "@/src/env";
import {
  calculateStabilityPoolApr,
  getCollGainFromSnapshots,
  useContinuousBoldGains,
  useSpYieldGainParameters,
} from "@/src/liquity-stability-pool";
import {
  useInterestRateBrackets,
  useStabilityPool,
  useStabilityPoolDeposit,
  useStabilityPoolEpochScale,
} from "@/src/subgraph-hooks";
import { isCollIndex, isTroveId } from "@/src/types";
import { COLLATERALS, isAddress } from "@liquity2/uikit";
import { useQuery } from "@tanstack/react-query";
import * as dn from "dnum";
import { useMemo } from "react";
import { encodeAbiParameters, keccak256, parseAbiParameters } from "viem";
import { useBalance, useReadContract, useReadContracts } from "wagmi";

export function shortenTroveId(troveId: TroveId, chars = 8) {
  return troveId.length < chars * 2 + 2
    ? troveId
    // : troveId.slice(0, chars + 2) + "…" + troveId.slice(-chars);
    : troveId.slice(0, chars + 2) + "…";
}

export function getTroveId(owner: Address, ownerIndex: bigint | number) {
  return BigInt(keccak256(encodeAbiParameters(
    parseAbiParameters("address, uint256"),
    [owner, BigInt(ownerIndex)],
  )));
}

export function parsePrefixedTroveId(value: PrefixedTroveId): {
  collIndex: CollIndex;
  troveId: TroveId;
} {
  const [collIndex_, troveId] = value.split(":");
  if (!collIndex_ || !troveId) {
    throw new Error(`Invalid prefixed trove ID: ${value}`);
  }
  const collIndex = parseInt(collIndex_, 10);
  if (!isCollIndex(collIndex) || !isTroveId(troveId)) {
    throw new Error(`Invalid prefixed trove ID: ${value}`);
  }
  return { collIndex, troveId };
}

export function getPrefixedTroveId(collIndex: CollIndex, troveId: TroveId): PrefixedTroveId {
  return `${collIndex}:${troveId}`;
}

export function getCollToken(collIndex: CollIndex | null): CollateralToken | null {
  const { collaterals } = getContracts();
  if (collIndex === null) {
    return null;
  }
  return collaterals.map(({ symbol }) => {
    const collateral = COLLATERALS.find((c) => c.symbol === symbol);
    if (!collateral) {
      throw new Error(`Unknown collateral symbol: ${symbol}`);
    }
    return collateral;
  })[collIndex] ?? null;
}

export function getCollIndexFromSymbol(symbol: CollateralSymbol | null): CollIndex | null {
  if (symbol === null) return null;
  const { collaterals } = getContracts();
  const collIndex = collaterals.findIndex((coll) => coll.symbol === symbol);
  return isCollIndex(collIndex) ? collIndex : null;
}

export function useEarnPool(collIndex: null | CollIndex) {
  const collateral = getCollToken(collIndex);
  const pool = useStabilityPool(collIndex ?? undefined);
  const { data: spYieldGainParams } = useSpYieldGainParameters(collateral?.symbol ?? null);
  const apr = spYieldGainParams && calculateStabilityPoolApr(spYieldGainParams);
  return {
    ...pool,
    data: {
      apr: apr ?? null,
      collateral,
      totalDeposited: pool.data?.totalDeposited ?? null,
    },
  };
}

export function useEarnPosition(
  collIndex: null | CollIndex,
  account: null | Address,
) {
  const getBoldGains = useContinuousBoldGains(account, collIndex);

  const getBoldGains_ = () => {
    return getBoldGains.data?.(Date.now()) ?? null;
  };

  const boldGains = useQuery({
    queryFn: () => getBoldGains_(),
    queryKey: ["useEarnPosition:getBoldGains", collIndex, account],
    refetchInterval: DATA_REFRESH_INTERVAL,
    enabled: getBoldGains.status === "success",
  });

  const spDeposit = useStabilityPoolDeposit(collIndex, account);
  const spDepositSnapshot = spDeposit.data?.snapshot;

  const epochScale1 = useStabilityPoolEpochScale(
    collIndex,
    spDepositSnapshot?.epoch ?? null,
    spDepositSnapshot?.scale ?? null,
  );

  const epochScale2 = useStabilityPoolEpochScale(
    collIndex,
    spDepositSnapshot?.epoch ?? null,
    spDepositSnapshot?.scale ? spDepositSnapshot?.scale + 1n : null,
  );

  const base = [
    getBoldGains,
    boldGains,
    spDeposit,
    epochScale1,
    epochScale2,
  ].find((r) => r.status !== "success") ?? epochScale2;

  return {
    ...base,
    data: (
        !spDeposit.data
        || !boldGains.data
        || !epochScale1.data
        || !epochScale2.data
      )
      ? null
      : earnPositionFromGraph(spDeposit.data, {
        bold: boldGains.data,
        coll: dnum18(
          getCollGainFromSnapshots(
            spDeposit.data.deposit,
            spDeposit.data.snapshot.P,
            spDeposit.data.snapshot.S,
            epochScale1.data.S,
            epochScale2.data.S,
          ),
        ),
      }),
  };
}

function earnPositionFromGraph(
  spDeposit: NonNullable<StabilityPoolDepositQuery["stabilityPoolDeposit"]>,
  rewards: { bold: Dnum; coll: Dnum },
): PositionEarn {
  const collIndex = spDeposit.collateral.collIndex;
  if (!isCollIndex(collIndex)) {
    throw new Error(`Invalid collateral index: ${collIndex}`);
  }
  if (!isAddress(spDeposit.depositor)) {
    throw new Error(`Invalid depositor address: ${spDeposit.depositor}`);
  }
  return {
    type: "earn",
    owner: spDeposit.depositor,
    deposit: dnum18(spDeposit.deposit),
    collIndex,
    rewards,
  };
}

export function useStakePosition(address: null | Address) {
  const LqtyStaking = getProtocolContract("LqtyStaking");
  const LusdToken = getProtocolContract("LusdToken");
  const Governance = getProtocolContract("Governance");

  const userProxyAddress = useReadContract({
    ...Governance,
    functionName: "deriveUserProxyAddress",
    args: [address ?? "0x"],
    query: { enabled: Boolean(address) },
  });

  const userProxyBalance = useBalance({
    address: userProxyAddress.data ?? "0x",
    query: { enabled: Boolean(address) && userProxyAddress.isSuccess },
  });

  return useReadContracts({
    contracts: [
      {
        ...LqtyStaking,
        functionName: "stakes",
        args: [userProxyAddress.data ?? "0x"],
      },
      {
        ...LqtyStaking,
        functionName: "totalLQTYStaked",
      },
      {
        ...LqtyStaking,
        functionName: "getPendingETHGain",
        args: [userProxyAddress.data ?? "0x"],
      },
      {
        ...LqtyStaking,
        functionName: "getPendingLUSDGain",
        args: [userProxyAddress.data ?? "0x"],
      },
      {
        ...LusdToken,
        functionName: "balanceOf",
        args: [userProxyAddress.data ?? "0x"],
      },
    ],
    query: {
      enabled: Boolean(address) && userProxyAddress.isSuccess && userProxyBalance.isSuccess,
      refetchInterval: DATA_REFRESH_INTERVAL,
      select: (
        [depositResult, totalStakedResult, pendingEthGainResult, pendingLusdGainResult, lusdBalanceResult],
      ): PositionStake | null => {
        if (
          depositResult.status === "failure" || totalStakedResult.status === "failure"
          || pendingEthGainResult.status === "failure" || pendingLusdGainResult.status === "failure"
          || lusdBalanceResult.status === "failure"
        ) {
          return null;
        }
        const deposit = dnum18(depositResult.result);
        const totalStaked = dnum18(totalStakedResult.result);
        return {
          type: "stake",
          deposit,
          owner: address ?? "0x",
          totalStaked,
          rewards: {
            eth: dnum18(pendingEthGainResult.result + (userProxyBalance.data?.value ?? 0n)),
            lusd: dnum18(pendingLusdGainResult.result + lusdBalanceResult.result),
          },
          share: dn.gt(totalStaked, 0) ? dn.div(deposit, totalStaked) : dnum18(0),
        };
      },
    },
  });
}

export function useTroveNftUrl(collIndex: null | CollIndex, troveId: null | TroveId) {
  const TroveNft = getCollateralContract(collIndex, "TroveNFT");
  return TroveNft && troveId && `${CHAIN_BLOCK_EXPLORER?.url}nft/${TroveNft.address}/${BigInt(troveId)}`;
}

const RATE_STEPS = Math.round((INTEREST_RATE_MAX - INTEREST_RATE_MIN) / INTEREST_RATE_INCREMENT) + 1;

export function useAverageInterestRate(collIndex: null | CollIndex) {
  const brackets = useInterestRateBrackets(collIndex);

  const data = useMemo(() => {
    if (!brackets.isSuccess) {
      return null;
    }

    let totalDebt = dnum18(0);
    let totalWeightedRate = dnum18(0);

    for (const bracket of brackets.data) {
      totalDebt = dn.add(totalDebt, bracket.totalDebt);
      totalWeightedRate = dn.add(
        totalWeightedRate,
        dn.mul(bracket.rate, bracket.totalDebt),
      );
    }

    return dn.eq(totalDebt, 0)
      ? dnum18(0)
      : dn.div(totalWeightedRate, totalDebt);
  }, [brackets.isSuccess, brackets.data]);

  return {
    ...brackets,
    data,
  };
}

const EMPTY_TROVE_CHANGE = {
  appliedRedistBoldDebtGain: 0n,
  appliedRedistCollGain: 0n,
  collIncrease: 0n,
  collDecrease: 0n,
  debtIncrease: 0n,
  debtDecrease: 0n,
  newWeightedRecordedDebt: 0n,
  oldWeightedRecordedDebt: 0n,
  upfrontFee: 0n,
  batchAccruedManagementFee: 0n,
  newWeightedRecordedBatchManagementFee: 0n,
  oldWeightedRecordedBatchManagementFee: 0n,
} as const;

export function useAverageInterestRateFromActivePool(collIndex: null | CollIndex) {
  const ActivePool = getCollateralContract(collIndex, "ActivePool");
  const result = useReadContract(
    !ActivePool ? {} : {
      address: ActivePool.address,
      abi: ActivePool.abi,
      functionName: "getNewApproxAvgInterestRateFromTroveChange",
      args: [EMPTY_TROVE_CHANGE],
      query: {
        enabled: ActivePool !== null,
        refetchInterval: DATA_REFRESH_INTERVAL,
      },
    },
  );
  return result;
}

export function useInterestRateChartData(collIndex: null | CollIndex) {
  const brackets = useInterestRateBrackets(collIndex);

  const chartData = useQuery({
    queryKey: [
      "useInterestRateChartData",
      collIndex,
      brackets.status,
      brackets.dataUpdatedAt,
    ],
    queryFn: () => {
      if (!brackets.isSuccess) {
        return [];
      }

      let totalDebt = dnum18(0);
      let highestDebt = dnum18(0);
      const debtByNonEmptyRateBrackets = new Map<number, Dnum>();
      for (const bracket of brackets.data) {
        const rate = dn.toNumber(dn.mul(bracket.rate, 100));
        if (rate >= INTEREST_RATE_MIN && rate <= INTEREST_RATE_MAX) {
          totalDebt = dn.add(totalDebt, bracket.totalDebt);
          debtByNonEmptyRateBrackets.set(rate, bracket.totalDebt);
          if (dn.gt(bracket.totalDebt, highestDebt)) {
            highestDebt = bracket.totalDebt;
          }
        }
      }

      let runningDebtTotal = dnum18(0);
      const chartData = Array.from({ length: RATE_STEPS }, (_, i) => {
        const rate = INTEREST_RATE_MIN + Math.floor(i * INTEREST_RATE_INCREMENT * 10) / 10;
        const debt = debtByNonEmptyRateBrackets?.get(rate) ?? dnum18(0);
        const debtInFront = runningDebtTotal;
        runningDebtTotal = dn.add(runningDebtTotal, debt);
        return {
          debt,
          debtInFront,
          rate: INTEREST_RATE_MIN + Math.floor(i * INTEREST_RATE_INCREMENT * 10) / 10,
          size: totalDebt[0] === 0n ? 0 : dn.toNumber(dn.div(debt, highestDebt)),
        };
      });

      return chartData;
    },
    refetchInterval: DATA_REFRESH_INTERVAL,
    enabled: brackets.isSuccess,
  });

  return brackets.isSuccess ? chartData : {
    ...chartData,
    data: [],
  };
}

export function usePredictOpenTroveUpfrontFee(
  collIndex: CollIndex,
  borrowedAmount: Dnum,
  interestRateOrBatch: Address | Dnum,
) {
  const batch = isAddress(interestRateOrBatch);

  return useReadContract({
    ...getProtocolContract("HintHelpers"),
    functionName: batch
      ? "predictOpenTroveAndJoinBatchUpfrontFee"
      : "predictOpenTroveUpfrontFee",
    args: batch
      ? [BigInt(collIndex), borrowedAmount[0], interestRateOrBatch]
      : [BigInt(collIndex), borrowedAmount[0], interestRateOrBatch[0]],
    query: {
      refetchInterval: DATA_REFRESH_INTERVAL,
      select: dnum18,
    },
  });
}

export function usePredictAdjustTroveUpfrontFee(
  collIndex: CollIndex,
  troveId: TroveId,
  debtIncrease: Dnum,
) {
  return useReadContract({
    ...getProtocolContract("HintHelpers"),
    functionName: "predictAdjustTroveUpfrontFee",
    args: [
      BigInt(collIndex),
      BigInt(troveId),
      debtIncrease[0],
    ],
    query: {
      refetchInterval: DATA_REFRESH_INTERVAL,
      select: dnum18,
    },
  });
}

// predicts the upfront fee for:
// - adjusting the interest rate of a trove (non-batch => non-batch)
// - joining a batch with a new interest rate (non-batch => batch or batch => batch)
// - removing a trove from a batch (batch => non-batch)
export function usePredictAdjustInterestRateUpfrontFee(
  collIndex: CollIndex,
  troveId: TroveId,
  newInterestRateOrBatch: Address | Dnum,
  fromBatch: boolean,
) {
  const functionName = isAddress(newInterestRateOrBatch)
    ? "predictJoinBatchInterestRateUpfrontFee"
    : fromBatch
    ? "predictRemoveFromBatchUpfrontFee"
    : "predictAdjustInterestRateUpfrontFee";

  return useReadContract({
    ...getProtocolContract("HintHelpers"),
    functionName,
    args: [
      BigInt(collIndex),
      BigInt(troveId),
      typeof newInterestRateOrBatch === "string"
        ? newInterestRateOrBatch
        : newInterestRateOrBatch[0],
    ],
    query: {
      refetchInterval: DATA_REFRESH_INTERVAL,
      select: dnum18,
    },
  });
}
