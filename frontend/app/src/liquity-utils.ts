import type { Contracts } from "@/src/contracts";
import type {
  Branch,
  BranchId,
  Delegate,
  Dnum,
  PositionEarn,
  PositionLoanBase,
  PositionLoanCommitted,
  PositionStake,
  PrefixedTroveId,
  TokenSymbol,
  TroveId,
} from "@/src/types";
import type { Address, CollateralSymbol, CollateralToken } from "@liquity2/uikit";
import type { UseQueryResult } from "@tanstack/react-query";
import type { Config as WagmiConfig } from "wagmi";

import { Governance } from "@/src/abi/Governance";
import { StabilityPool } from "@/src/abi/StabilityPool";
import { TroveManager } from "@/src/abi/TroveManager";
import {
  DATA_REFRESH_INTERVAL,
  INTEREST_RATE_ADJ_COOLDOWN,
  INTEREST_RATE_END,
  INTEREST_RATE_INCREMENT_NORMAL,
  INTEREST_RATE_INCREMENT_PRECISE,
  INTEREST_RATE_PRECISE_UNTIL,
  INTEREST_RATE_START,
} from "@/src/constants";
import { CONTRACTS, getBranchContract, getProtocolContract } from "@/src/contracts";
import { ACCOUNT_POSITIONS } from "@/src/demo-mode";
import { dnum18, DNUM_0, dnumOrNull, jsonStringifyWithDnum } from "@/src/dnum-utils";
import { CHAIN_BLOCK_EXPLORER, DEMO_MODE, ENV_BRANCHES, LEGACY_CHECK, LIQUITY_STATS_URL } from "@/src/env";
import { useAllInterestRateBrackets, useInterestRateBrackets } from "@/src/subgraph-hooks";
import { isBranchId, isPositionLoanCommitted, isPrefixedtroveId, isTroveId } from "@/src/types";
import { bigIntAbs, jsonStringifyWithBigInt, sleep } from "@/src/utils";
import { vAddress, vPrefixedTroveId } from "@/src/valibot-utils";
import { addressesEqual, COLLATERALS, isAddress, shortenAddress } from "@liquity2/uikit";
import { useQuery } from "@tanstack/react-query";
import * as dn from "dnum";
import { useMemo } from "react";
import * as v from "valibot";
import { encodeAbiParameters, erc20Abi, keccak256, parseAbiParameters } from "viem";
import { useBalance, useConfig as useWagmiConfig, useReadContract, useReadContracts } from "wagmi";
import { readContract, readContracts } from "wagmi/actions";
import {
  graphQuery,
  InterestBatchesQuery,
  TroveStatusByIdQuery,
  TroveStatusesByAccountQuery,
} from "./subgraph-queries";

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
  branchId: BranchId;
  troveId: TroveId;
} {
  const [branchId_, troveId] = value.split(":");
  if (!branchId_ || !troveId) {
    throw new Error(`Invalid prefixed trove ID: ${value}`);
  }
  const branchId = parseInt(branchId_, 10);
  if (!isBranchId(branchId) || !isTroveId(troveId)) {
    throw new Error(`Invalid prefixed trove ID: ${value}`);
  }
  return { branchId, troveId };
}

export function getPrefixedTroveId(branchId: BranchId, troveId: TroveId): PrefixedTroveId {
  return `${branchId}:${troveId}`;
}

export function getCollToken(branchId: null): null;
export function getCollToken(branchId: BranchId): CollateralToken;
export function getCollToken(branchId: BranchId | null): CollateralToken | null;
export function getCollToken(branchId: BranchId | null): CollateralToken | null {
  if (branchId === null) {
    return null;
  }
  const branch = getBranch(branchId);
  const token = COLLATERALS.find((c) => c.symbol === branch.symbol);
  if (!token) {
    throw new Error(`Unknown collateral symbol: ${branch.symbol}`);
  }
  return token;
}

export function getBranches(): Branch[] {
  return ENV_BRANCHES.map((branch) => {
    const contracts = CONTRACTS.branches.find((b) => b.id === branch.id);
    if (!contracts) {
      throw new Error(`Contracts not found for branch: ${branch.id}`);
    }
    return {
      id: branch.id,
      branchId: branch.id,
      contracts: contracts.contracts,
      symbol: branch.symbol,
      strategies: branch.strategies,
    };
  });
}

export function getBranch(idOrSymbol: null): null;
export function getBranch(idOrSymbol: CollateralSymbol | BranchId): Branch;
export function getBranch(
  idOrSymbol: CollateralSymbol | BranchId | null,
): Branch | null {
  if (idOrSymbol === null) {
    return null;
  }

  const branch = getBranches().find((b) => (
    typeof idOrSymbol === "string"
      ? b.symbol === idOrSymbol
      : b.id === idOrSymbol
  ));

  if (!branch) {
    throw new Error("Invalid branch ID or symbol: " + idOrSymbol);
  }

  return branch;
}

function statusFromEnum(status: number): PositionLoanBase["status"] {
  if (status === 1) return "active";
  if (status === 2) return "closed";
  if (status === 3) return "liquidated";
  if (status === 4) return "redeemed";
  throw new Error(`Invalid status: ${status}`);
}

export function useEarnPool(branchId: BranchId) {
  const wagmiConfig = useWagmiConfig();
  const stats = useLiquityStats();
  const collateral = getCollToken(branchId);
  const { spApyAvg1d = null, spApyAvg7d = null } = (
    collateral && stats.data?.branch[collateral?.symbol]
  ) ?? {};

  return useQuery({
    queryKey: [
      "earnPool",
      branchId,
      jsonStringifyWithDnum(spApyAvg1d),
      jsonStringifyWithDnum(spApyAvg7d),
    ],
    queryFn: async () => {
      const totalBoldDeposits = await readContract(wagmiConfig, {
        ...getBranchContract(branchId, "StabilityPool"),
        functionName: "getTotalBoldDeposits",
      });
      return {
        apr: spApyAvg1d,
        apr7d: spApyAvg7d,
        collateral,
        totalDeposited: dnum18(totalBoldDeposits),
      };
    },
    refetchInterval: DATA_REFRESH_INTERVAL,
    enabled: stats.isSuccess,
  });
}

export function isEarnPositionActive(position: PositionEarn | null) {
  return Boolean(
    position && (
      dn.gt(position.deposit, 0)
      || dn.gt(position.rewards.bold, 0)
      || dn.gt(position.rewards.coll, 0)
    ),
  );
}

function earnPositionsContractsReadSetup(branchId: BranchId, account: Address | null) {
  const StabilityPool = getBranchContract(branchId, "StabilityPool");
  return {
    contracts: [{
      ...StabilityPool,
      functionName: "getCompoundedBoldDeposit",
      args: [account ?? "0x"],
    }, {
      ...StabilityPool,
      functionName: "getDepositorCollGain",
      args: [account ?? "0x"],
    }, {
      ...StabilityPool,
      functionName: "stashedColl",
      args: [account ?? "0x"],
    }, {
      ...StabilityPool,
      functionName: "getDepositorYieldGainWithPending",
      args: [account ?? "0x"],
    }],
    select: ([
      deposit,
      collGain,
      stashedColl,
      yieldGainWithPending,
    ]: [
      bigint,
      bigint,
      bigint,
      bigint,
    ]) => {
      if (!account) {
        throw new Error(); // should never happen (see enabled)
      }
      return deposit === 0n ? null : {
        type: "earn",
        owner: account,
        deposit: dnum18(deposit),
        branchId,
        rewards: {
          bold: dnum18(yieldGainWithPending),
          coll: dn.add(
            dnum18(collGain),
            dnum18(stashedColl),
          ),
        },
      } as const;
    },
  } as const;
}

export function useEarnPosition(
  branchId: BranchId,
  account: null | Address,
): UseQueryResult<PositionEarn | null> {
  const setup = earnPositionsContractsReadSetup(branchId, account);
  return useReadContracts({
    contracts: setup.contracts,
    allowFailure: false,
    query: {
      enabled: Boolean(account),
      refetchInterval: DATA_REFRESH_INTERVAL,
      select: setup.select,
    },
  });
}

export function useEarnPositionsByAccount(account: null | Address) {
  const wagmiConfig = useWagmiConfig();

  let queryFn = async () => {
    if (!account) return null;

    const branches = getBranches();

    const depositsPerBranch = await Promise.all(
      branches.map(async (branch) => {
        const setup = earnPositionsContractsReadSetup(branch.id, account);
        const deposits = await readContracts(wagmiConfig, {
          contracts: setup.contracts,
          allowFailure: false,
        });
        return setup.select(deposits);
      }),
    );

    return depositsPerBranch.filter((position) => position !== null);
  };

  if (DEMO_MODE) {
    queryFn = async () => {
      return account
        ? ACCOUNT_POSITIONS.filter((position) => position.type === "earn")
        : null;
    };
  }

  return useQuery({
    queryKey: ["StabilityPoolDepositsByAccount", account],
    queryFn,
    refetchInterval: DATA_REFRESH_INTERVAL,
  });
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

  const stakePosition = useReadContracts({
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
      select: ([
        depositResult,
        totalStakedResult,
        pendingEthGainResult,
        pendingLusdGainResult,
        lusdBalanceResult,
      ]): PositionStake | null => {
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
        };
      },
    },
  });

  return stakePosition;
}

export function useTroveNftUrl(branchId: null | BranchId, troveId: null | TroveId) {
  const TroveNft = getBranchContract(branchId, "TroveNFT");
  return TroveNft && troveId && `${CHAIN_BLOCK_EXPLORER?.url}nft/${TroveNft.address}/${BigInt(troveId)}`;
}

export function useAverageInterestRate(branchId: null | BranchId) {
  const brackets = useInterestRateBrackets(branchId);

  const data = useMemo(() => {
    if (!brackets.isSuccess) {
      return null;
    }

    let totalDebt = DNUM_0;
    let totalWeightedRate = DNUM_0;

    for (const bracket of brackets.data) {
      totalDebt = dn.add(totalDebt, bracket.totalDebt);
      totalWeightedRate = dn.add(
        totalWeightedRate,
        dn.mul(bracket.rate, bracket.totalDebt),
      );
    }

    return dn.eq(totalDebt, 0)
      ? DNUM_0
      : dn.div(totalWeightedRate, totalDebt);
  }, [brackets.isSuccess, brackets.data]);

  return {
    ...brackets,
    data,
  };
}

export function useInterestRateChartData() {
  const brackets = useAllInterestRateBrackets();
  return useQuery({
    queryKey: ["useInterestRateChartData", jsonStringifyWithDnum(brackets.data)],
    queryFn: () => {
      if (!brackets.isSuccess) {
        throw new Error();
      }

      const debtByRate = new Map<string, Dnum>();
      let totalDebt = DNUM_0;
      let highestDebt = DNUM_0;

      for (const bracket of brackets.data) {
        if (
          dn.lt(bracket.rate, INTEREST_RATE_START)
          || dn.gt(bracket.rate, INTEREST_RATE_END)
        ) {
          continue;
        }

        debtByRate.set(dn.toJSON(bracket.rate), bracket.totalDebt);
        totalDebt = dn.add(totalDebt, bracket.totalDebt);
        if (dn.gt(bracket.totalDebt, highestDebt)) {
          highestDebt = bracket.totalDebt;
        }
      }

      const chartData = [];
      let currentRate = dn.from(INTEREST_RATE_START, 18);
      let runningDebtTotal = DNUM_0;

      while (dn.lte(currentRate, INTEREST_RATE_END)) {
        const nextRate = dn.add(
          currentRate,
          dn.lt(currentRate, INTEREST_RATE_PRECISE_UNTIL)
            ? INTEREST_RATE_INCREMENT_PRECISE
            : INTEREST_RATE_INCREMENT_NORMAL,
        );

        let aggregatedDebt = DNUM_0; // debt between currentRate and nextRate
        let stepRate = currentRate;
        while (dn.lt(stepRate, nextRate)) {
          aggregatedDebt = dn.add(
            aggregatedDebt,
            debtByRate.get(dn.toJSON(stepRate)) ?? DNUM_0,
          );
          stepRate = dn.add(stepRate, INTEREST_RATE_INCREMENT_PRECISE);
        }

        chartData.push({
          debt: aggregatedDebt,
          debtInFront: dn.from(runningDebtTotal),
          rate: currentRate,
          size: totalDebt[0] === 0n
            ? 0
            : dn.toNumber(dn.div(aggregatedDebt, highestDebt)),
        });

        runningDebtTotal = dn.add(runningDebtTotal, aggregatedDebt);
        currentRate = nextRate;
      }

      return chartData;
    },
    refetchInterval: DATA_REFRESH_INTERVAL,
    enabled: brackets.isSuccess,
  });
}

export function findClosestRateIndex(
  rates: bigint[], // rates must be sorted
  rate: bigint,
): number {
  const firstRate = rates.at(0);
  const lastRate = rates.at(-1);

  if (firstRate === undefined || lastRate === undefined) {
    throw new Error("Invalid rates array");
  }

  if (rate <= firstRate) return 0;
  if (rate >= lastRate) return 1;

  let diff = bigIntAbs(firstRate - rate);

  for (let index = 0; index < rates.length - 1; index++) {
    const nextRate = rates.at(index + 1);
    if (nextRate === undefined) throw new Error(); // should never happen

    const nextDiff = bigIntAbs(nextRate - rate);

    // diff starts increasing = we passed the closest point
    if (nextDiff > diff) return index;

    diff = nextDiff;
  }

  return rates.length - 1;
}

export function usePredictOpenTroveUpfrontFee(
  branchId: BranchId,
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
      ? [BigInt(branchId), borrowedAmount[0], interestRateOrBatch]
      : [BigInt(branchId), borrowedAmount[0], interestRateOrBatch[0]],
    query: {
      refetchInterval: DATA_REFRESH_INTERVAL,
      select: dnum18,
    },
  });
}

export function usePredictAdjustTroveUpfrontFee(
  branchId: BranchId,
  troveId: TroveId,
  debtIncrease: Dnum,
) {
  return useReadContract({
    ...getProtocolContract("HintHelpers"),
    functionName: "predictAdjustTroveUpfrontFee",
    args: [
      BigInt(branchId),
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
  branchId: BranchId,
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
      BigInt(branchId),
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

// from https://github.com/liquity/bold/blob/204a3dec54a0e8689120ca48faf4ece5cf8ccd22/README.md#example-opentrove-transaction-with-hints
export async function getTroveOperationHints({
  wagmiConfig,
  contracts,
  branchId,
  interestRate,
}: {
  wagmiConfig: WagmiConfig;
  contracts: Contracts;
  branchId: BranchId;
  interestRate: bigint;
}): Promise<{
  upperHint: bigint;
  lowerHint: bigint;
}> {
  const branch = getBranch(branchId);

  const numTroves = await readContract(wagmiConfig, {
    ...branch.contracts.SortedTroves,
    functionName: "getSize",
  });

  const [approxHint] = await readContract(wagmiConfig, {
    ...contracts.HintHelpers,
    functionName: "getApproxHint",
    args: [
      BigInt(branchId),
      interestRate,
      // (10 * sqrt(troves)) gives a hint close to the right position
      10n * BigInt(Math.ceil(Math.sqrt(Number(numTroves)))),
      42n, // random seed
    ],
  });

  const [upperHint, lowerHint] = await readContract(wagmiConfig, {
    ...branch.contracts.SortedTroves,
    functionName: "findInsertPosition",
    args: [
      interestRate,
      approxHint,
      approxHint,
    ],
  });

  return { upperHint, lowerHint };
}

const StatsSchema = v.pipe(
  v.object({
    total_bold_supply: v.string(),
    total_debt_pending: v.string(),
    total_coll_value: v.string(),
    total_sp_deposits: v.string(),
    total_value_locked: v.string(),
    max_sp_apy: v.string(),
    branch: v.record(
      v.string(),
      v.object({
        coll_active: v.string(),
        coll_default: v.string(),
        coll_price: v.string(),
        sp_deposits: v.string(),
        interest_accrual_1y: v.string(),
        interest_pending: v.string(),
        batch_management_fees_pending: v.string(),
        debt_pending: v.string(),
        coll_value: v.string(),
        sp_apy: v.string(),
        sp_apy_avg_1d: v.optional(v.string()),
        sp_apy_avg_7d: v.optional(v.string()),
        value_locked: v.string(),
      }),
    ),
  }),
  v.transform((value) => ({
    totalBoldSupply: dnumOrNull(value.total_bold_supply, 18),
    totalDebtPending: dnumOrNull(value.total_debt_pending, 18),
    totalCollValue: dnumOrNull(value.total_coll_value, 18),
    totalSpDeposits: dnumOrNull(value.total_sp_deposits, 18),
    totalValueLocked: dnumOrNull(value.total_value_locked, 18),
    maxSpApy: dnumOrNull(value.max_sp_apy, 18),
    branch: Object.fromEntries(
      Object.entries(value.branch).map(([symbol, branch]) => {
        symbol = symbol.toUpperCase();
        if (symbol === "WETH") symbol = "ETH";
        return [symbol, {
          collActive: dnumOrNull(branch.coll_active, 18),
          collDefault: dnumOrNull(branch.coll_default, 18),
          collPrice: dnumOrNull(branch.coll_price, 18),
          spDeposits: dnumOrNull(branch.sp_deposits, 18),
          interestAccrual1y: dnumOrNull(branch.interest_accrual_1y, 18),
          interestPending: dnumOrNull(branch.interest_pending, 18),
          batchManagementFeesPending: dnumOrNull(branch.batch_management_fees_pending, 18),
          debtPending: dnumOrNull(branch.debt_pending, 18),
          collValue: dnumOrNull(branch.coll_value, 18),
          spApy: dnumOrNull(branch.sp_apy, 18),
          spApyAvg1d: dnumOrNull(branch.sp_apy_avg_1d, 18),
          spApyAvg7d: dnumOrNull(branch.sp_apy_avg_7d, 18),
          valueLocked: dnumOrNull(branch.value_locked, 18),
        }];
      }),
    ),
  })),
);

export function useBranchDebt(branchId: BranchId) {
  const BorrowerOperations = getBranchContract(branchId, "BorrowerOperations");
  return useReadContract({
    ...BorrowerOperations,
    functionName: "getEntireBranchDebt",
    query: {
      refetchInterval: DATA_REFRESH_INTERVAL,
      select: dnum18,
    },
  });
}

export function useLiquityStats() {
  return useQuery({
    queryKey: ["liquity-stats"],
    queryFn: async () => {
      if (!LIQUITY_STATS_URL) {
        throw new Error("LIQUITY_STATS_URL is not defined");
      }
      const response = await fetch(LIQUITY_STATS_URL);
      return v.parse(StatsSchema, await response.json());
    },
    enabled: Boolean(LIQUITY_STATS_URL),
  });
}

export function useLatestTroveData(branchId: BranchId, troveId: TroveId) {
  const TroveManager = getBranchContract(branchId, "TroveManager");
  if (!TroveManager) {
    throw new Error(`Invalid branch: ${branchId}`);
  }
  return useReadContract({
    ...TroveManager,
    functionName: "getLatestTroveData",
    args: [BigInt(troveId)],
    query: {
      refetchInterval: DATA_REFRESH_INTERVAL,
    },
  });
}

export function useLoanLiveDebt(branchId: BranchId, troveId: TroveId) {
  const latestTroveData = useLatestTroveData(branchId, troveId);
  return {
    ...latestTroveData,
    data: latestTroveData.data?.entireDebt ?? null,
  };
}

export function useLoan(branchId: BranchId, troveId: TroveId): UseQueryResult<PositionLoanCommitted | null> {
  const liveDebt = useLoanLiveDebt(branchId, troveId);
  const loan = useLoanById(getPrefixedTroveId(branchId, troveId));

  if (liveDebt.status === "pending" || loan.status === "pending") {
    return {
      ...loan,
      data: undefined,
      error: null,
      isError: false,
      isFetching: true,
      isLoading: true,
      isLoadingError: false,
      isPlaceholderData: false,
      isPending: true,
      isRefetchError: false,
      isSuccess: false,
      status: "pending",
    };
  }

  if (!loan.data) {
    return loan;
  }

  return {
    ...loan,
    data: {
      ...loan.data,
      borrowed: liveDebt.data ? dnum18(liveDebt.data) : loan.data.borrowed,
    },
  };
}

export function useInterestBatchDelegate(
  branchId: BranchId,
  batchAddress: null | Address,
) {
  const result = useInterestBatchDelegates(branchId, batchAddress ? [batchAddress] : []);
  return { ...result, data: result.data?.[0] ?? null };
}

export function useInterestBatchDelegates(
  branchId: BranchId,
  batchAddresses: Address[],
): UseQueryResult<Delegate[]> {
  const wagmiConfig = useWagmiConfig();

  return useQuery<Delegate[]>({
    queryKey: ["InterestBatches", branchId, batchAddresses],
    queryFn: async () => {
      if (batchAddresses.length === 0) {
        return [];
      }

      const [{ interestBatches: batches }, batchesFromChain] = await Promise.all([
        graphQuery(InterestBatchesQuery, {
          ids: batchAddresses.map((addr) => `${branchId}:${addr.toLowerCase()}`),
        }),
        readContracts(wagmiConfig, {
          allowFailure: false,
          contracts: batchAddresses.map((address) => ({
            ...getBranchContract(branchId, "BorrowerOperations"),
            functionName: "getInterestBatchManager" as const,
            args: [address],
          })),
        }).then((results) => {
          return results.map((result, index) => ({
            address: (batchAddresses[index] ?? "").toLowerCase() as Address,
            ...result,
          }));
        }),
      ]);

      return batches
        .map((batch): null | Delegate => {
          const batchAddress = batch.batchManager.toLowerCase();
          if (!isAddress(batchAddress)) {
            throw new Error(`Invalid batch manager address: ${batchAddress}`);
          }

          const batchFromChain = batchesFromChain.find((b) => addressesEqual(b.address, batchAddress));
          if (!batchFromChain) {
            return null;
          }

          return {
            id: `${branchId}:${batchAddress}`,
            address: batchAddress,
            name: shortenAddress(batchAddress, 4),
            interestRate: dnum18(batch.annualInterestRate),
            boldAmount: dnum18(batch.debt),
            interestRateChange: {
              min: dnum18(batchFromChain.minInterestRate),
              max: dnum18(batchFromChain.maxInterestRate),
              period: batchFromChain.minInterestRateChangePeriod,
            },
            fee: dnum18(batch.annualManagementFee),

            // not available in the subgraph yet
            followers: 0,
            lastDays: 0,
            redemptions: dnum18(0),
          };
        })
        .filter((delegate) => delegate !== null);
    },
    refetchInterval: DATA_REFRESH_INTERVAL,
    enabled: batchAddresses.length > 0,
  });
}

export function useTroveRateUpdateCooldown(branchId: BranchId, troveId: TroveId) {
  const wagmiConfig = useWagmiConfig();
  return useQuery({
    queryKey: ["troveRateUpdateCooldown", branchId, troveId],
    queryFn: async () => {
      const { lastInterestRateAdjTime } = await readContract(wagmiConfig, {
        ...getBranchContract(branchId, "TroveManager"),
        functionName: "getLatestTroveData",
        args: [BigInt(troveId)],
      });
      const cooldownEndTime = (
        Number(lastInterestRateAdjTime) + INTEREST_RATE_ADJ_COOLDOWN
      ) * 1000;
      return (now: number) => Math.max(0, cooldownEndTime - now);
    },
  });
}

export async function fetchLoanById(
  wagmiConfig: WagmiConfig,
  fullId: null | PrefixedTroveId,
): Promise<PositionLoanCommitted | null> {
  if (!isPrefixedtroveId(fullId)) return null;

  const { branchId, troveId } = parsePrefixedTroveId(fullId);

  const TroveManager = getBranchContract(branchId, "TroveManager");
  const TroveNft = getBranchContract(branchId, "TroveNFT");

  const [
    { trove: troveStatus },
    [troveTuple, troveData, borrower],
  ] = await Promise.all([
    graphQuery(TroveStatusByIdQuery, { id: fullId }),
    readContracts(wagmiConfig, {
      allowFailure: false,
      contracts: [{
        ...TroveManager,
        functionName: "Troves",
        args: [BigInt(troveId)],
      }, {
        ...TroveManager,
        functionName: "getLatestTroveData",
        args: [BigInt(troveId)],
      }, {
        ...TroveNft,
        functionName: "ownerOf",
        args: [BigInt(troveId)],
      }],
    }),
  ]);

  const status = troveTuple[3];
  const batchManager = troveTuple[8];

  return {
    type: troveStatus?.mightBeLeveraged ? "multiply" : "borrow",
    batchManager: BigInt(batchManager) === 0n ? null : batchManager,
    borrowed: dnum18(troveData.entireDebt),
    borrower,
    branchId,
    createdAt: Number(troveStatus?.createdAt ?? 0n) * 1000,
    deposit: dnum18(troveData.entireColl),
    interestRate: dnum18(troveData.annualInterestRate),
    status: troveStatus?.status ?? statusFromEnum(status),
    troveId,
  };
}

export function useLoanById(id?: null | PrefixedTroveId) {
  const wagmiConfig = useWagmiConfig();

  let queryFn: () => Promise<PositionLoanCommitted | null>;

  queryFn = async () => (
    id ? fetchLoanById(wagmiConfig, id) : null
  );

  if (DEMO_MODE) {
    queryFn = async () => {
      if (!isPrefixedtroveId(id)) return null;
      await sleep(500);
      for (const pos of ACCOUNT_POSITIONS) {
        if (isPositionLoanCommitted(pos) && `${pos.branchId}:${pos.troveId}` === id) {
          return pos;
        }
      }
      return null;
    };
  }

  return useQuery<PositionLoanCommitted | null>({
    queryKey: ["TroveById", id],
    queryFn,
    refetchInterval: DATA_REFRESH_INTERVAL,
  });
}

export async function fetchLoansByAccount(
  wagmiConfig: WagmiConfig,
  account?: Address | null,
): Promise<PositionLoanCommitted[] | null> {
  if (!account) return null;

  const { troves: troveStatuses } = await graphQuery(
    TroveStatusesByAccountQuery,
    { account: account.toLowerCase() },
  );

  const results = await Promise.all(troveStatuses.map((troveStatus) => {
    if (!isPrefixedtroveId(troveStatus.id)) {
      throw new Error(`Invalid prefixed trove ID: ${troveStatus.id}`);
    }
    return fetchLoanById(wagmiConfig, troveStatus.id);
  }));

  return results.filter((result) => result !== null);
}

export function useLoansByAccount(account?: Address | null) {
  const wagmiConfig = useWagmiConfig();

  let queryFn: () => Promise<PositionLoanCommitted[] | null>;

  queryFn = () => fetchLoansByAccount(wagmiConfig, account);

  if (DEMO_MODE) {
    queryFn = async () =>
      account
        ? ACCOUNT_POSITIONS.filter(isPositionLoanCommitted)
        : null;
  }

  return useQuery({
    queryKey: ["TrovesByAccount", account],
    queryFn,
    refetchInterval: DATA_REFRESH_INTERVAL,
  });
}

const TrovesSnapshotSchema = v.record(
  vAddress(),
  v.array(vPrefixedTroveId()),
);

export function useLegacyPositions(account: Address | null): UseQueryResult<{
  boldBalance: bigint;
  hasAnyEarnPosition: boolean;
  hasAnyLoan: boolean;
  hasAnyPosition: boolean;
  hasStakeDeposit: boolean;
  spDeposits: Array<{
    branchId: BranchId;
    collGain: bigint;
    deposit: bigint;
    yieldGain: bigint;
  }>;
  stakeDeposit: bigint;
  troves: Array<{
    accruedBatchManagementFee: bigint;
    accruedInterest: bigint;
    annualInterestRate: bigint;
    branchId: BranchId;
    collToken: { name: string; symbol: TokenSymbol };
    entireColl: bigint;
    entireDebt: bigint;
    lastInterestRateAdjTime: bigint;
    recordedDebt: bigint;
    redistBoldDebtGain: bigint;
    redistCollGain: bigint;
    troveId: TroveId;
    weightedRecordedDebt: bigint;
  }>;
}> {
  const checkLegacyPositions = Boolean(account && LEGACY_CHECK);

  const legacyTrovesFromSnapshot = useQuery<PrefixedTroveId[]>({
    queryKey: ["legacyTrovesFromSnapshot", account],
    queryFn: async () => {
      if (!LEGACY_CHECK || !account) {
        throw new Error("LEGACY_CHECK or account not defined");
      }
      const result = await fetch(LEGACY_CHECK.TROVES_SNAPSHOT_URL);
      const trovesByAccount = v.parse(TrovesSnapshotSchema, await result.json());
      return trovesByAccount[account.toLowerCase() as `0x${string}`] ?? [];
    },
    enabled: checkLegacyPositions,
  });

  const legacyTroves = useReadContracts({
    contracts: legacyTrovesFromSnapshot.data?.map((prefixedTroveId) => {
      const { branchId, troveId } = parsePrefixedTroveId(prefixedTroveId);
      const branch = LEGACY_CHECK?.BRANCHES[branchId as number];
      const address: Address = branch?.TROVE_MANAGER ?? "0x";
      return {
        abi: TroveManager,
        address,
        functionName: "getLatestTroveData",
        args: [BigInt(troveId)],
      } as const;
    }),
    allowFailure: false,
    query: {
      enabled: checkLegacyPositions,
      refetchInterval: DATA_REFRESH_INTERVAL,
      select: (results) => {
        return (
          results
            .map((data, index) => {
              const prefixedTroveId = legacyTrovesFromSnapshot.data?.[index];
              if (!prefixedTroveId) {
                throw new Error("Trove ID not found");
              }
              const { branchId, troveId } = parsePrefixedTroveId(prefixedTroveId);
              const branch = LEGACY_CHECK?.BRANCHES[branchId as number];
              if (!branch) {
                throw new Error(`Invalid branch ID: ${branchId}`);
              }
              return {
                ...data,
                branchId,
                collToken: {
                  name: branch.name,
                  symbol: branch.symbol,
                },
                troveId,
              };
            })
            .filter((trove) => trove.entireDebt > 0n)
        );
      },
    },
  });

  const hasAnyLegacyTrove = (legacyTrovesFromSnapshot.data?.length ?? 0) > 0;

  const spDeposits = useReadContracts({
    contracts: LEGACY_CHECK
      ? [
        ...LEGACY_CHECK.BRANCHES.map(({ STABILITY_POOL }) => ({
          abi: StabilityPool,
          address: STABILITY_POOL,
          functionName: "getCompoundedBoldDeposit" as const,
          args: [account],
        })),
        ...LEGACY_CHECK.BRANCHES.map(({ STABILITY_POOL }) => ({
          abi: StabilityPool,
          address: STABILITY_POOL,
          functionName: "getDepositorYieldGainWithPending" as const,
          args: [account],
        })),
        ...LEGACY_CHECK.BRANCHES.map(({ STABILITY_POOL }) => ({
          abi: StabilityPool,
          address: STABILITY_POOL,
          functionName: "getDepositorCollGain" as const,
          args: [account],
        })),
      ]
      : undefined,
    allowFailure: false,
    query: {
      enabled: checkLegacyPositions,
      refetchInterval: DATA_REFRESH_INTERVAL,
      select: (results) => {
        if (!LEGACY_CHECK) {
          throw new Error("LEGACY_CHECK not defined");
        }
        const branchCount = LEGACY_CHECK.BRANCHES.length;
        const getBranchSlice = (index: number) => (
          results.slice(branchCount * index, branchCount * (index + 1))
        );

        const deposits = getBranchSlice(0);
        const yieldGains = getBranchSlice(1);
        const collGains = getBranchSlice(2);

        return {
          hasAnySpDeposit: deposits.some((deposit) => deposit > 0n),
          branches: LEGACY_CHECK.BRANCHES.map((_, index) => ({
            branchId: index as BranchId,
            collGain: collGains[index] ?? 0n,
            deposit: deposits[index] ?? 0n,
            yieldGain: yieldGains[index] ?? 0n,
          })),
        };
      },
    },
  });

  const legacyBoldBalance = useReadContract({
    abi: erc20Abi,
    address: LEGACY_CHECK?.BOLD_TOKEN,
    functionName: "balanceOf",
    args: [account ?? "0x"],
    query: {
      enabled: checkLegacyPositions,
      refetchInterval: DATA_REFRESH_INTERVAL,
    },
  });

  const stakedLqty = useReadContract({
    abi: Governance,
    address: LEGACY_CHECK?.GOVERNANCE,
    functionName: "userStates" as const,
    args: [account ?? "0x"],
    query: {
      enabled: checkLegacyPositions,
      refetchInterval: DATA_REFRESH_INTERVAL,
      select: ([
        unallocatedLQTY,
        _unallocatedOffset,
        allocatedLQTY,
        _allocatedOffset,
      ]) => unallocatedLQTY + allocatedLQTY,
    },
  });

  return useQuery({
    queryKey: [
      "hasAnyLegacyPosition",
      account,
      jsonStringifyWithBigInt(legacyTroves.data),
      String(legacyBoldBalance.data),
      jsonStringifyWithBigInt(spDeposits.data),
      String(stakedLqty.data),
    ],
    queryFn: () => {
      const stakeDeposit = stakedLqty.data ?? 0n;
      const hasAnyEarnPosition = spDeposits.data?.hasAnySpDeposit ?? false;
      const hasStakeDeposit = stakeDeposit > 0n;
      return {
        boldBalance: legacyBoldBalance.data ?? 0n,
        hasAnyEarnPosition,
        hasAnyLoan: hasAnyLegacyTrove,
        hasAnyPosition: hasAnyEarnPosition || hasAnyLegacyTrove || hasStakeDeposit,
        hasStakeDeposit,
        spDeposits: (spDeposits.data?.branches ?? []).filter(
          (branch) => branch.deposit > 0n,
        ),
        stakeDeposit: stakedLqty.data ?? 0n,
        troves: legacyTroves.data ?? [],
      };
    },
    placeholderData: (data) => data,
    refetchInterval: DATA_REFRESH_INTERVAL,
    enabled: (
      checkLegacyPositions
      && legacyBoldBalance.isSuccess
      && (legacyTroves.isSuccess || !hasAnyLegacyTrove)
      && spDeposits.isSuccess
      && stakedLqty.isSuccess
    ),
  });
}
