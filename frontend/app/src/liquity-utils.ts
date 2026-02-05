import type { Contracts } from "@/src/contracts";
import type {
  Branch,
  BranchId,
  Delegate,
  Dnum,
  PositionEarn,
  PositionLoanCommitted,
  PositionStake,
  PrefixedTroveId,
  Token,
  TokenSymbol,
  TroveId,
  TroveStatus,
} from "@/src/types";
import type { Address, CollateralSymbol, CollateralToken } from "@liquity2/uikit";
import type { UseQueryResult } from "@tanstack/react-query";
import type { Config as WagmiConfig } from "wagmi";

import { Governance } from "@/src/abi/Governance";
import { StabilityPool } from "@/src/abi/StabilityPool";
import { TroveManager } from "@/src/abi/TroveManager";
import {
  INTEREST_RATE_ADJ_COOLDOWN,
  INTEREST_RATE_END,
  INTEREST_RATE_INCREMENT_NORMAL,
  INTEREST_RATE_INCREMENT_PRECISE,
  INTEREST_RATE_PRECISE_UNTIL,
  INTEREST_RATE_START,
  ONE_YEAR_D18,
  TROVE_STATUS_ACTIVE,
  TROVE_STATUS_CLOSED_BY_LIQUIDATION,
  TROVE_STATUS_CLOSED_BY_OWNER,
  TROVE_STATUS_NONEXISTENT,
  TROVE_STATUS_ZOMBIE,
} from "@/src/constants";
import { CONTRACTS, getBranchContract, getProtocolContract } from "@/src/contracts";
import { dnum18, DNUM_0, dnumOrNull, jsonStringifyWithDnum } from "@/src/dnum-utils";
import {
  AIRDROP_VAULTS,
  AIRDROP_VAULTS_URL,
  CHAIN_BLOCK_EXPLORER,
  ENV_BRANCHES,
  LEGACY_CHECK,
  LIQUITY_STATS_URL,
} from "@/src/env";
import { useSubgraphIsDown } from "@/src/indicators/subgraph-indicator";
import { getRedemptionRisk } from "@/src/liquity-math";
import { combineStatus } from "@/src/query-utils";
import { useDebounced } from "@/src/react-utils";
import { useCollateralPrices, usePrice } from "@/src/services/Prices";
import {
  getAllInterestRateBrackets,
  getIndexedTroveById,
  getIndexedTrovesByAccount,
  getInterestBatches,
  getNextOwnerIndex,
  type IndexedTrove,
} from "@/src/subgraph";
import { isBranchId, isPrefixedtroveId, isTroveId } from "@/src/types";
import { bigIntAbs, jsonStringifyWithBigInt } from "@/src/utils";
import { vAddress, vPrefixedTroveId } from "@/src/valibot-utils";
import { addressesEqual, COLLATERALS, isAddress, shortenAddress, TOKENS_BY_SYMBOL } from "@liquity2/uikit";
import { useQuery } from "@tanstack/react-query";
import * as dn from "dnum";
import { useMemo } from "react";
import * as v from "valibot";
import { encodeAbiParameters, erc20Abi, isAddressEqual, keccak256, parseAbiParameters, zeroAddress } from "viem";
import { useBalance, useConfig as useWagmiConfig, useReadContract, useReadContracts, useSimulateContract } from "wagmi";
import { readContract, readContracts } from "wagmi/actions";

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

export function getToken(symbol: CollateralSymbol): CollateralToken;
export function getToken(symbol: TokenSymbol): Token;
export function getToken(symbol: TokenSymbol): Token {
  const token = TOKENS_BY_SYMBOL[symbol];
  if (!token) {
    throw new Error(`Unknown token symbol: ${symbol}`);
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

export function getTokenDisplayName(symbol: TokenSymbol) {
  const token = TOKENS_BY_SYMBOL[symbol];

  switch (symbol) {
    case "SBOLD":
      return "sBOLD by K3 Capital";
    case "YBOLD":
      return "yBOLD by Yearn";
    default:
      return token.name;
  }
}

export function getBranchesCount(): number {
  return ENV_BRANCHES.length;
}

export async function detectTroveBranches(
  wagmiConfig: WagmiConfig,
  troveId: TroveId,
): Promise<BranchId[]> {
  const branches = getBranches();

  const results = await Promise.all(
    branches.map(async (branch) => {
      try {
        const owner = await readContract(wagmiConfig, {
          ...branch.contracts.TroveNFT,
          functionName: "ownerOf",
          args: [BigInt(troveId)],
        });
        return owner ? branch.branchId : null;
      } catch {
        return null;
      }
    }),
  );

  return results.filter((branchId): branchId is BranchId => branchId !== null);
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

export type BoldYield = {
  asset: string;
  weeklyApr: Dnum;
  tvl: Dnum;
  link: string;
  protocol: string;
};

export function useBoldYieldSources() {
  const { data, isLoading, error } = useLiquityStats();

  return {
    data: data?.boldYield as BoldYield[],
    isLoading,
    error,
  };
}

type EarnPool = {
  apr: Dnum | null;
  apr7d: Dnum | null;
  collateral: CollateralToken;
  totalDeposited: Dnum;
};
export function useEarnPool(branchId: null): UseQueryResult<null>;
export function useEarnPool(branchId: BranchId): UseQueryResult<EarnPool>;
export function useEarnPool(branchId: BranchId | null): UseQueryResult<EarnPool | null>;
export function useEarnPool(branchId: BranchId | null) {
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
      if (branchId === null) {
        return null;
      }
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
      select: setup.select,
    },
  });
}

export function useEarnPositionsByAccount(account: null | Address) {
  const wagmiConfig = useWagmiConfig();
  return useQuery({
    queryKey: ["StabilityPoolDepositsByAccount", account],
    queryFn: async () => {
      if (!account) {
        return null;
      }

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
    },
  });
}

export function useStakePosition(address: null | Address, version: "v1" | "v2" = "v2") {
  const LqtyStaking = getProtocolContract("LqtyStaking");
  const LusdToken = getProtocolContract("LusdToken");
  const Governance = getProtocolContract("Governance");

  const userProxyAddress = useReadContract({
    ...Governance,
    functionName: "deriveUserProxyAddress",
    args: [address ?? "0x"],
    query: {
      enabled: Boolean(address),
    },
  });

  const userProxyBalance = useBalance({
    address: userProxyAddress.data ?? "0x",
    query: {
      enabled: Boolean(address) && userProxyAddress.isSuccess,
    },
  });

  let userStakingAddress = address ?? "0x";
  if (version === "v2") {
    userStakingAddress = userProxyAddress.data ?? "0x";
  }

  return useReadContracts({
    contracts: [{
      ...LqtyStaking,
      functionName: "stakes",
      args: [userStakingAddress],
    }, {
      ...LqtyStaking,
      functionName: "getPendingETHGain",
      args: [userStakingAddress],
    }, {
      ...LqtyStaking,
      functionName: "getPendingLUSDGain",
      args: [userStakingAddress],
    }, {
      ...LusdToken,
      functionName: "balanceOf",
      args: [userStakingAddress],
    }],
    query: {
      enabled: Boolean(address) && userProxyAddress.isSuccess && userProxyBalance.isSuccess,
      select: ([
        depositResult,
        pendingEthGainResult,
        pendingLusdGainResult,
        lusdBalanceResult,
      ]): PositionStake | undefined => {
        if (
          depositResult.status === "failure"
          || pendingEthGainResult.status === "failure"
          || pendingLusdGainResult.status === "failure"
          || lusdBalanceResult.status === "failure"
        ) {
          return undefined;
        }
        const deposit = dnum18(depositResult.result);
        return {
          type: "stake",
          deposit,
          owner: address ?? "0x",
          rewards: {
            eth: dnum18(pendingEthGainResult.result + (userProxyBalance.data?.value ?? 0n)),
            lusd: dnum18(pendingLusdGainResult.result + lusdBalanceResult.result),
          },
        };
      },
    },
  });
}

export function useV1StabilityPoolLqtyGain(address: null | Address) {
  const V1StabilityPool = getProtocolContract("V1StabilityPool");

  return useReadContract({
    ...V1StabilityPool,
    functionName: "getDepositorLQTYGain",
    args: [address ?? "0x"],
    query: {
      enabled: Boolean(address),
      select: (result) => dnum18(result),
    },
  });
}

export function useTroveNftUrl(branchId: null | BranchId, troveId: null | TroveId) {
  const TroveNft = getBranchContract(branchId, "TroveNFT");
  return TroveNft && troveId && `${CHAIN_BLOCK_EXPLORER?.url}nft/${TroveNft.address}/${BigInt(troveId)}`;
}

export function useInterestRateBrackets(branchId: BranchId) {
  const { status, data } = useAllInterestRateBrackets();

  return useMemo(() => {
    if (!data) return { status, data };

    return {
      status,
      data: {
        lastUpdatedAt: data.lastUpdatedAt,
        brackets: data.brackets.filter((bracket) => bracket.branchId === branchId),
      },
    };
  }, [branchId, status, data]);
}

function useAllInterestRateBrackets() {
  return useQuery({
    queryKey: ["AllInterestRateBrackets"],
    queryFn: getAllInterestRateBrackets,
  });
}

export function useAverageInterestRate(branchId: BranchId) {
  const { status, data } = useInterestRateBrackets(branchId);

  return useMemo(() => {
    if (!data) return { status, data };

    let totalDebt = DNUM_0;
    let totalWeightedRate = DNUM_0;

    for (const bracket of data.brackets) {
      totalDebt = dn.add(totalDebt, bracket.totalDebt(BigInt(Math.floor(Date.now() / 1000))));
      totalWeightedRate = dn.add(totalWeightedRate, bracket.totalWeightedRate);
    }

    return {
      status,
      data: dn.eq(totalDebt, 0)
        ? DNUM_0
        : dn.div(totalWeightedRate, totalDebt),
    };
  }, [status, data]);
}

export function useInterestRateChartData(branchId: BranchId, excludedLoan?: PositionLoanCommitted) {
  const { status, data } = useInterestRateBrackets(branchId);

  return useMemo(() => {
    if (!data) return { status, data };

    // brackets or loan could have been updated in the "future", if client clock is running behind
    // or the blockchain clock has been fast-forwarded, e.g. in case of Anvil
    const timestamp = BigInt(
      Math.floor(
        Math.max(
          Date.now(),
          Number(data.lastUpdatedAt) * 1000,
          ...(excludedLoan ? [excludedLoan.updatedAt] : []),
        ) / 1000,
      ),
    );

    const debtByRate = new Map<string, Dnum>(
      data.brackets
        .filter(({ rate }) => dn.gte(rate, INTEREST_RATE_START) && dn.lte(rate, INTEREST_RATE_END))
        .map((bracket) => [dn.toJSON(bracket.rate), bracket.totalDebt(timestamp)]),
    );

    const chartData = [];
    let currentRate = dn.from(INTEREST_RATE_START, 18);
    let debtInFront = DNUM_0;
    let highestDebt = DNUM_0;

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

      // exclude own debt from debt-in front calculation
      if (
        excludedLoan
        && dn.gte(excludedLoan.interestRate, currentRate)
        && dn.lt(excludedLoan.interestRate, nextRate)
      ) {
        const updatedAt = BigInt(excludedLoan.updatedAt / 1000); // should be divisible by 1000
        const pendingDebt = dnum18(
          dn.from(excludedLoan.recordedDebt, 18)[0]
            * dn.from(excludedLoan.interestRate, 18)[0]
            * (timestamp - updatedAt)
            / ONE_YEAR_D18,
        );
        const excludedDebt = dn.add(excludedLoan.recordedDebt, pendingDebt);
        aggregatedDebt = dn.sub(aggregatedDebt, excludedDebt);
      }

      chartData.push({
        debt: aggregatedDebt,
        debtInFront,
        rate: currentRate,
        size: dn.toNumber(aggregatedDebt),
      });

      debtInFront = dn.add(debtInFront, aggregatedDebt);
      currentRate = nextRate;
      if (dn.gt(aggregatedDebt, highestDebt)) highestDebt = aggregatedDebt;
    }

    // normalize size between 0 and 1
    if (highestDebt[0] !== 0n) {
      const divisor = dn.toNumber(highestDebt);
      for (const datum of chartData) {
        datum.size /= divisor;
      }
    }

    return { status, data: chartData };
  }, [status, data]);
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

const BoldYieldItem = v.object({
  asset: v.string(),
  weekly_apr: v.union([v.number(), v.string()]),
  tvl: v.union([v.number(), v.string()]),
  link: v.string(),
  protocol: v.string(),
});

export const StatsSchema = v.pipe(
  v.object({
    total_bold_supply: v.string(),
    total_debt_pending: v.string(),
    total_coll_value: v.string(),
    total_sp_deposits: v.string(),
    total_value_locked: v.string(),
    max_sp_apy: v.string(),
    prices: v.record(
      v.string(),
      v.string(),
    ),
    boldYield: v.optional(v.nullable(v.array(BoldYieldItem))),
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
    sBOLD: v.nullish(v.object({
      protocol: v.string(),
      asset: v.string(),
      link: v.string(),
      weekly_apr: v.number(),
      total_apr: v.string(),
      tvl: v.number(),
    })),
    yBOLD: v.nullish(v.object({
      protocol: v.string(),
      asset: v.string(),
      link: v.string(),
      weekly_apr: v.number(),
      total_apr: v.string(),
      tvl: v.number(),
    })),
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
    prices: Object.fromEntries(
      Object.entries(value.prices).map(([symbol, price]) => [
        symbol,
        dnumOrNull(price, 18),
      ]),
    ),
    boldYield: (value.boldYield ?? []).map((i) => ({
      asset: i.asset,
      weeklyApr: dnumOrNull(i.weekly_apr, 18),
      tvl: dnumOrNull(i.tvl, 18),
      link: i.link,
      protocol: i.protocol,
    })),
    sBOLD: value.sBOLD && {
      protocol: value.sBOLD.protocol,
      asset: value.sBOLD.asset,
      link: value.sBOLD.link,
      weeklyApr: dnumOrNull(value.sBOLD.weekly_apr, 18),
      totalApr: value.sBOLD.total_apr,
      tvl: dnumOrNull(value.sBOLD.tvl, 18),
    },
    yBOLD: value.yBOLD && {
      protocol: value.yBOLD.protocol,
      asset: value.yBOLD.asset,
      link: value.yBOLD.link,
      weeklyApr: dnumOrNull(value.yBOLD.weekly_apr, 18),
      totalApr: value.yBOLD.total_apr,
      tvl: dnumOrNull(value.yBOLD.tvl, 18),
    },
  })),
);

export function useBranchDebt(branchId: BranchId) {
  const BorrowerOperations = getBranchContract(branchId, "BorrowerOperations");
  return useReadContract({
    ...BorrowerOperations,
    functionName: "getEntireBranchDebt",
    query: {
      select: dnum18,
    },
  });
}

function calcCollateralRatios(
  totalColl: bigint,
  totalDebt: bigint,
  ccr_: bigint,
  collPrice: Dnum | null,
): { ccr: Dnum; isBelowCcr: boolean; tcr: Dnum | null } {
  const ccr = dnum18(ccr_);

  if (!collPrice || dn.eq(totalDebt, 0)) {
    return { ccr, isBelowCcr: false, tcr: null };
  }

  // TCR = (totalCollateral * collTokenPrice) / totalDebt
  const tcr = dn.div(
    dn.mul(dnum18(totalColl), collPrice),
    dnum18(totalDebt),
  );

  return { ccr, isBelowCcr: dn.lt(tcr, ccr), tcr };
}

function getCollateralRatioContractCalls(branchId: BranchId) {
  const TroveManager = getBranchContract(branchId, "TroveManager");
  return [{
    ...TroveManager,
    functionName: "getEntireBranchColl",
  }, {
    ...TroveManager,
    functionName: "getEntireBranchDebt",
  }, {
    ...TroveManager,
    functionName: "CCR",
  }] as const;
}

export function useBranchCollateralRatios(branchId: BranchId) {
  const wagmiConfig = useWagmiConfig();
  const collToken = getCollToken(branchId);
  const collTokenPrice = usePrice(collToken?.symbol ?? null);

  return useQuery({
    queryKey: [
      "branchCollateralRatios",
      branchId,
      jsonStringifyWithDnum(collTokenPrice.data),
    ],
    queryFn: async () => {
      const [totalColl, totalDebt, ccr_] = await readContracts(wagmiConfig, {
        contracts: getCollateralRatioContractCalls(branchId),
        allowFailure: false,
      });

      return calcCollateralRatios(totalColl, totalDebt, ccr_, collTokenPrice.data ?? null);
    },
    enabled: Boolean(collTokenPrice.data),
  });
}

export function useBranchesCollateralRatios() {
  const wagmiConfig = useWagmiConfig();
  const branches = getBranches();
  const symbols = branches.map((b) => b.symbol);
  const collPrices = useCollateralPrices(symbols);
  const contractCallsPerBranch = branches.map((branch) => getCollateralRatioContractCalls(branch.id));
  const COLLATERAL_RATIO_CALLS_COUNT = 3;

  return useQuery({
    queryKey: [
      "branchesCollateralRatios",
      branches.map((b) => b.id),
      jsonStringifyWithDnum(collPrices.data),
    ],
    queryFn: async () => {
      const results = await readContracts(wagmiConfig, {
        contracts: contractCallsPerBranch.flat(),
        allowFailure: false,
      });

      return branches.map((branch, index) => {
        const base = index * COLLATERAL_RATIO_CALLS_COUNT;
        const branchResults = results.slice(base, base + COLLATERAL_RATIO_CALLS_COUNT);
        if (branchResults.length !== COLLATERAL_RATIO_CALLS_COUNT) {
          throw new Error(
            `Expected ${COLLATERAL_RATIO_CALLS_COUNT} collateral ratio results, got ${branchResults.length}`,
          );
        }
        const [totalColl, totalDebt, ccr_] = branchResults as [bigint, bigint, bigint];

        return {
          branchId: branch.id,
          symbol: branch.symbol,
          ...calcCollateralRatios(totalColl, totalDebt, ccr_, collPrices.data?.[index] ?? null),
        };
      });
    },
    enabled: Boolean(collPrices.data),
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
  });
}

export function useLoan(branchId: BranchId, troveId: TroveId): UseQueryResult<PositionLoanCommitted | null> {
  const id = getPrefixedTroveId(branchId, troveId);
  const wagmiConfig = useWagmiConfig();
  const subgraphIsDown = useSubgraphIsDown();

  return useQuery<PositionLoanCommitted | null>({
    queryKey: ["TroveById", id, subgraphIsDown],
    queryFn: () => id ? fetchLoanById(wagmiConfig, id, subgraphIsDown) : null,
    refetchInterval: 60_000,
  });
}

export function useInterestBatchDelegate(
  branchId: BranchId,
  batchAddress: null | Address,
) {
  const result = useInterestBatchDelegates(branchId, batchAddress ? [batchAddress] : []);
  return { ...result, data: result.data?.[0] ?? null };
}

async function fetchInterestBatches(
  wagmiConfig: WagmiConfig,
  branchId: BranchId,
  batchAddresses: Address[],
  subgraphIsDown: boolean,
) {
  if (!subgraphIsDown) {
    return getInterestBatches(branchId, batchAddresses);
  }

  const batchesData = await readContracts(wagmiConfig, {
    allowFailure: false,
    contracts: batchAddresses.map((address) => ({
      ...getBranchContract(branchId, "TroveManager"),
      functionName: "getLatestBatchData" as const,
      args: [address],
    })),
  });

  return batchAddresses.map((batchAddress, index) => {
    const batchData = batchesData[index];
    if (!batchData) {
      throw new Error(`Failed to fetch batch data for ${batchAddress}`);
    }

    return {
      batchManager: batchAddress,
      debt: dnum18(batchData.recordedDebt),
      coll: dnum18(batchData.entireCollWithoutRedistribution),
      interestRate: dnum18(batchData.annualInterestRate),
      fee: dnum18(batchData.annualManagementFee),
    };
  });
}

export function useInterestBatchDelegates(
  branchId: BranchId,
  batchAddresses: Address[],
): UseQueryResult<Delegate[]> {
  const wagmiConfig = useWagmiConfig();
  const subgraphIsDown = useSubgraphIsDown();

  return useQuery<Delegate[]>({
    queryKey: ["InterestBatches", branchId, batchAddresses, subgraphIsDown],
    queryFn: async () => {
      if (batchAddresses.length === 0) {
        return [];
      }

      const [batches, batchesFromChain] = await Promise.all([
        fetchInterestBatches(wagmiConfig, branchId, batchAddresses, subgraphIsDown),
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
            interestRate: batch.interestRate,
            boldAmount: batch.debt,
            interestRateChange: {
              min: dnum18(batchFromChain.minInterestRate),
              max: dnum18(batchFromChain.maxInterestRate),
              // period is sometimes called "max update frequency"
              period: batchFromChain.minInterestRateChangePeriod,
            },
            fee: batch.fee,
          };
        })
        .filter((delegate) => delegate !== null);
    },
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

export async function fetchLoanByIdRpcOnly(
  wagmiConfig: WagmiConfig,
  fullId: null | PrefixedTroveId,
): Promise<PositionLoanCommitted | null> {
  if (!isPrefixedtroveId(fullId)) return null;

  const { branchId, troveId } = parsePrefixedTroveId(fullId);
  const BorrowerOperations = getBranchContract(branchId, "BorrowerOperations");
  const TroveManager = getBranchContract(branchId, "TroveManager");
  const TroveNFT = getBranchContract(branchId, "TroveNFT");

  try {
    const [batchManager, troveData, troveStatus, borrower] = await readContracts(wagmiConfig, {
      allowFailure: true,
      contracts: [{
        ...BorrowerOperations,
        functionName: "interestBatchManagerOf",
        args: [BigInt(troveId)],
      }, {
        ...TroveManager,
        functionName: "getLatestTroveData",
        args: [BigInt(troveId)],
      }, {
        ...TroveManager,
        functionName: "getTroveStatus",
        args: [BigInt(troveId)],
      }, {
        ...TroveNFT,
        functionName: "ownerOf",
        args: [BigInt(troveId)],
      }],
    });

    if (troveStatus.status === "failure" || troveData.status === "failure") {
      return null;
    }

    if (troveStatus.result === TROVE_STATUS_NONEXISTENT) {
      return null;
    }

    let status: TroveStatus;
    if (troveStatus.result === TROVE_STATUS_ACTIVE || troveStatus.result === TROVE_STATUS_ZOMBIE) {
      status = "active";
    } else if (troveStatus.result === TROVE_STATUS_CLOSED_BY_OWNER) {
      status = "closed";
    } else if (troveStatus.result === TROVE_STATUS_CLOSED_BY_LIQUIDATION) {
      status = "liquidated";
    } else {
      status = "closed";
    }

    const borrowerAddress = borrower.status === "success" ? borrower.result : zeroAddress;
    const batchManagerAddress = batchManager.status === "success" ? batchManager.result : zeroAddress;

    return {
      type: "borrow",
      batchManager: isAddressEqual(batchManagerAddress, zeroAddress) ? null : batchManagerAddress,
      borrowed: dnum18(troveData.result.entireDebt),
      borrower: borrowerAddress,
      branchId,
      createdAt: 0,
      lastUserActionAt: 0,
      updatedAt: 0,
      recordedDebt: dnum18(troveData.result.recordedDebt),
      deposit: dnum18(troveData.result.entireColl),
      interestRate: dnum18(troveData.result.annualInterestRate),
      status,
      troveId,
      isZombie: troveStatus.result === TROVE_STATUS_ZOMBIE,
      redemptionCount: 0,
      redeemedColl: dnum18(0n),
      redeemedDebt: dnum18(0n),
      liquidatedColl: dnum18(0n),
      liquidatedDebt: dnum18(0n),
      collSurplus: dnum18(0n),
      priceAtLiquidation: dnum18(0n),
    };
  } catch (error) {
    console.error("Error fetching loan via RPC:", error);
    return null;
  }
}

export async function fetchLoanById(
  wagmiConfig: WagmiConfig,
  fullId: null | PrefixedTroveId,
  subgraphIsDown: boolean,
  maybeIndexedTrove?: IndexedTrove,
): Promise<PositionLoanCommitted | null> {
  if (!isPrefixedtroveId(fullId)) return null;

  if (!subgraphIsDown) {
    const { branchId, troveId } = parsePrefixedTroveId(fullId);
    const BorrowerOperations = getBranchContract(branchId, "BorrowerOperations");
    const TroveManager = getBranchContract(branchId, "TroveManager");

    const [
      indexedTrove,
      [batchManager, troveData, troveStatus],
    ] = await Promise.all([
      maybeIndexedTrove ?? getIndexedTroveById(branchId, troveId),
      readContracts(wagmiConfig, {
        allowFailure: false,
        contracts: [{
          ...BorrowerOperations,
          functionName: "interestBatchManagerOf",
          args: [BigInt(troveId)],
        }, {
          ...TroveManager,
          functionName: "getLatestTroveData",
          args: [BigInt(troveId)],
        }, {
          ...TroveManager,
          functionName: "getTroveStatus",
          args: [BigInt(troveId)],
        }],
      }),
    ]);

    return !indexedTrove ? null : {
      type: indexedTrove.mightBeLeveraged ? "multiply" : "borrow",
      batchManager: isAddressEqual(batchManager, zeroAddress) ? null : batchManager,
      borrowed: dnum18(troveData.entireDebt),
      borrower: indexedTrove.borrower,
      branchId,
      createdAt: indexedTrove.createdAt,
      lastUserActionAt: indexedTrove.lastUserActionAt,
      updatedAt: indexedTrove.updatedAt,
      recordedDebt: indexedTrove.debt,
      deposit: dnum18(troveData.entireColl),
      interestRate: dnum18(troveData.annualInterestRate),
      status: indexedTrove.status,
      troveId,
      isZombie: troveStatus === TROVE_STATUS_ZOMBIE,
      redemptionCount: indexedTrove.redemptionCount,
      redeemedColl: indexedTrove.redeemedColl,
      redeemedDebt: indexedTrove.redeemedDebt,
      liquidatedColl: indexedTrove.liquidatedColl,
      liquidatedDebt: indexedTrove.liquidatedDebt,
      collSurplus: indexedTrove.collSurplus,
      priceAtLiquidation: indexedTrove.priceAtLiquidation,
    };
  } else {
    return fetchLoanByIdRpcOnly(wagmiConfig, fullId);
  }
}

async function fetchLoansByStoredTroveIdsRpcOnly(
  wagmiConfig: WagmiConfig,
  account: Address,
  storedTroveIds: string[],
): Promise<PositionLoanCommitted[]> {
  if (storedTroveIds.length === 0) return [];

  const results = await Promise.all(
    storedTroveIds.map(async (prefixedId) => {
      if (!isPrefixedtroveId(prefixedId)) {
        return null;
      }

      const loan = await fetchLoanByIdRpcOnly(wagmiConfig, prefixedId);

      if (loan && isAddressEqual(loan.borrower, account)) {
        return loan;
      }
      return null;
    }),
  );

  return results.filter((result): result is PositionLoanCommitted => result !== null);
}

export async function fetchLoansByAccount(
  wagmiConfig: WagmiConfig,
  account: Address | null | undefined,
  storedTroveIds: string[] | undefined,
  subgraphIsDown: boolean,
): Promise<PositionLoanCommitted[] | null> {
  if (!account) return null;

  if (!subgraphIsDown) {
    const troves = await getIndexedTrovesByAccount(account);

    const results = await Promise.all(troves.map((trove) => {
      if (!isPrefixedtroveId(trove.id)) {
        throw new Error(`Invalid prefixed trove ID: ${trove.id}`);
      }
      return fetchLoanById(wagmiConfig, trove.id, subgraphIsDown, trove);
    }));

    return results.filter((result) => result !== null);
  }

  if (storedTroveIds && storedTroveIds.length > 0) {
    return fetchLoansByStoredTroveIdsRpcOnly(wagmiConfig, account, storedTroveIds);
  }

  return [];
}

export function useLoansByAccount(account?: Address | null, storedTroveIds?: string[]) {
  const wagmiConfig = useWagmiConfig();
  const subgraphIsDown = useSubgraphIsDown();

  return useQuery<PositionLoanCommitted[] | null>({
    queryKey: ["TrovesByAccount", account, storedTroveIds, subgraphIsDown],
    queryFn: () => fetchLoansByAccount(wagmiConfig, account, storedTroveIds, subgraphIsDown),
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
    staleTime: Infinity,
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
    },
  });

  const stakedLqty = useReadContract({
    abi: Governance,
    address: LEGACY_CHECK?.GOVERNANCE,
    functionName: "userStates" as const,
    args: [account ?? "0x"],
    query: {
      enabled: checkLegacyPositions,
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
    enabled: (
      checkLegacyPositions
      && legacyBoldBalance.isSuccess
      && (legacyTroves.isSuccess || !hasAnyLegacyTrove)
      && spDeposits.isSuccess
      && stakedLqty.isSuccess
    ),
  });
}

export function useNextOwnerIndex(
  borrower: null | Address,
  branchId: null | BranchId,
) {
  const subgraphIsDown = useSubgraphIsDown();

  return useQuery({
    queryKey: ["NextTroveId", borrower, branchId, subgraphIsDown],
    queryFn: async () => {
      if (!borrower || branchId === null) return null;
      if (subgraphIsDown) return 0;
      return getNextOwnerIndex(branchId, borrower);
    },
    enabled: borrower !== null && branchId !== null,
  });
}

const interestRateFloor = (rate: Dnum) =>
  dn.mul(
    dn.floor(
      dn.div(
        rate,
        INTEREST_RATE_INCREMENT_PRECISE,
      ),
    ),
    INTEREST_RATE_INCREMENT_PRECISE,
  );

function useDebtInFrontOfBracket(branchId: BranchId, bracketRate: Dnum) {
  const { status, data } = useInterestRateBrackets(branchId);
  const subgraphIsDown = useSubgraphIsDown();

  return useMemo(() => {
    if (subgraphIsDown) {
      return { status: "error" as const, data: undefined };
    }

    if (!data) return { status, data };

    return {
      status,

      data: data && ((timestamp: bigint) => {
        const brackets = data.brackets.map(
          ({ rate, totalDebt }) => ({
            rate,
            totalDebt: totalDebt(timestamp),
          }),
        );

        const bracketsInFront = brackets.filter(
          (bracket) => dn.lt(bracket.rate, bracketRate),
        );

        return {
          debtInFront: bracketsInFront.map((bracket) => bracket.totalDebt).reduce((a, b) => dn.add(a, b), DNUM_0),
          totalDebt: brackets.map((bracket) => bracket.totalDebt).reduce((a, b) => dn.add(a, b), DNUM_0),
        };
      }),
    };
  }, [status, data, bracketRate, subgraphIsDown]);
}

export type UseDebtInFrontOfLoanParams = Readonly<
  Pick<
    PositionLoanCommitted,
    | "branchId"
    | "troveId"
    | "interestRate"
    | "status"
    | "isZombie"
  >
>;

export const EMPTY_LOAN: UseDebtInFrontOfLoanParams = {
  branchId: 0,
  troveId: "0x0",
  interestRate: DNUM_0,
  status: "closed",
  isZombie: true,
};

export function useDebtInFrontOfLoan(loan: UseDebtInFrontOfLoanParams) {
  const redeemable = (loan.status === "active" || loan.status === "redeemed") && !loan.isZombie;
  const ownBracket = interestRateFloor(loan.interestRate);
  const debtInFrontOfOwnBracket = useDebtInFrontOfBracket(loan.branchId, ownBracket);
  const { contracts: { SortedTroves } } = getBranch(loan.branchId);
  const numTroves = useReadContract({ ...SortedTroves, functionName: "getSize", query: { enabled: redeemable } });
  const DebtInFrontHelper = getProtocolContract("DebtInFrontHelper");

  const debtInFrontOfLoanWithinOwnBracket = useReadContract({
    ...DebtInFrontHelper,
    query: { enabled: redeemable && numTroves.data !== undefined },
    functionName: "getDebtBetweenInterestRateAndTrove",
    args: [
      BigInt(loan.branchId), // _collIndex
      dn.from(ownBracket, 18)[0], // _interestRateLo
      dn.add(ownBracket, INTEREST_RATE_INCREMENT_PRECISE, 18)[0], // _interestRateHi
      BigInt(loan.troveId), // _troveIdToStopAt
      0n, // _hintId
      BigInt(Math.round(Math.sqrt(Number(numTroves.data ?? 0)))), // _numTrials
    ],
  });

  const status = redeemable
    ? combineStatus(debtInFrontOfOwnBracket.status, debtInFrontOfLoanWithinOwnBracket.status)
    : debtInFrontOfOwnBracket.status;

  return useMemo(() => {
    if (redeemable) {
      if (!debtInFrontOfOwnBracket.data || !debtInFrontOfLoanWithinOwnBracket.data) {
        return { status, data: undefined };
      }

      const timestamp = debtInFrontOfLoanWithinOwnBracket.data[1];
      const { debtInFront, totalDebt } = debtInFrontOfOwnBracket.data(timestamp);

      return {
        status,
        data: {
          debtInFront: dn.add(debtInFront, dnum18(debtInFrontOfLoanWithinOwnBracket.data[0])),
          totalDebt,
        },
      };
    } else {
      if (!debtInFrontOfOwnBracket.data) return { status, data: undefined };

      return {
        status,
        data: {
          debtInFront: null,
          totalDebt: debtInFrontOfOwnBracket.data(BigInt(Math.floor(Date.now() / 1000))).totalDebt,
        },
      };
    }
  }, [redeemable, status, debtInFrontOfOwnBracket.data, debtInFrontOfLoanWithinOwnBracket.data]);
}

export function useDebtInFrontOfInterestRate(
  branchId: BranchId,
  interestRate: Dnum,
  excludedLoan?: PositionLoanCommitted,
) {
  const ownBracket = interestRateFloor(interestRate);
  const debtInFrontOfOwnBracket = useDebtInFrontOfBracket(branchId, ownBracket);
  const { contracts: { SortedTroves } } = getBranch(branchId);
  const atBottom = dn.eq(interestRate, ownBracket);
  const numTroves = useReadContract({ ...SortedTroves, functionName: "getSize", query: { enabled: !atBottom } });
  const DebtInFrontHelper = getProtocolContract("DebtInFrontHelper");

  const debtInFrontOfLoanWithinOwnBracket = useReadContract({
    ...DebtInFrontHelper,
    query: { enabled: !atBottom && numTroves.data !== undefined },
    functionName: "getDebtBetweenInterestRates",
    args: [
      BigInt(branchId), // _collIndex
      dn.from(ownBracket, 18)[0], // _interestRateLo
      dn.from(interestRate, 18)[0], // _interestRateHi
      BigInt(excludedLoan?.troveId ?? 0), // _excludedTroveId
      0n, // _hintId
      BigInt(Math.round(Math.sqrt(Number(numTroves.data ?? 0)))), // _numTrials
    ],
  });

  const status = atBottom
    ? debtInFrontOfOwnBracket.status
    : combineStatus(debtInFrontOfLoanWithinOwnBracket.status, debtInFrontOfOwnBracket.status);

  return useMemo(() => {
    if (atBottom) {
      if (!debtInFrontOfOwnBracket.data) return { status, data: undefined };

      return {
        status,
        data: debtInFrontOfOwnBracket.data(BigInt(Math.floor(Date.now() / 1000))),
      };
    } else {
      if (!debtInFrontOfOwnBracket.data || !debtInFrontOfLoanWithinOwnBracket.data) {
        return { status, data: undefined };
      }

      const timestamp = debtInFrontOfLoanWithinOwnBracket.data[1];
      const { debtInFront, totalDebt } = debtInFrontOfOwnBracket.data(timestamp);

      return {
        status,
        data: {
          debtInFront: dn.add(debtInFront, dnum18(debtInFrontOfLoanWithinOwnBracket.data[0])),
          totalDebt,
        },
      };
    }
  }, [atBottom, status, debtInFrontOfOwnBracket.data, debtInFrontOfLoanWithinOwnBracket.data]);
}

// TODO add the ability to disable `useDebtInFrontOfLoan()` and disable it Trove is a zombie (return "not-applicable")
export function useRedemptionRiskOfLoan(loan: UseDebtInFrontOfLoanParams) {
  const { status, data } = useDebtInFrontOfLoan(loan);

  return useMemo(() => {
    if (!data) return { status, data };
    if (data.debtInFront === null) return { status, data: "not-applicable" as const };
    return { status, data: getRedemptionRisk(data.debtInFront, data.totalDebt) };
  }, [status, data]);
}

export function useCollateralSurplus(accountAddress: Address | null, branchId: BranchId) {
  return useReadContract({
    ...getBranchContract(branchId, "CollSurplusPool"),
    functionName: "getCollateral",
    args: [accountAddress ?? zeroAddress],
    query: {
      enabled: Boolean(accountAddress),
      select: dnum18,
    },
  });
}

export function useCollateralSurplusByBranches(
  accountAddress: Address | null,
  liquidatedBranchIds: BranchId[],
) {
  return useReadContracts({
    contracts: liquidatedBranchIds.map((branchId) => {
      const branch = CONTRACTS.branches[branchId];
      if (!branch) {
        throw new Error(`Invalid branch ID: ${branchId}`);
      }
      return {
        ...branch.contracts.CollSurplusPool,
        functionName: "getCollateral" as const,
        args: [accountAddress ?? zeroAddress],
      };
    }),
    query: {
      enabled: Boolean(accountAddress) && liquidatedBranchIds.length > 0,
      select: (results) => {
        return results.map((result, index) => {
          const branchId = liquidatedBranchIds[index];
          if (branchId === undefined) {
            throw new Error(`Branch ID at index ${index} not found`);
          }
          const surplus = result.result ? dnum18(result.result) : DNUM_0;
          return {
            branchId,
            surplus,
          };
        });
      },
    },
  });
}

export function useRedemptionRiskOfInterestRate(
  branchId: BranchId,
  interestRate: Dnum,
  excludedLoan?: PositionLoanCommitted,
) {
  const { status, data } = useDebtInFrontOfInterestRate(branchId, interestRate, excludedLoan);

  return useMemo(() => {
    if (!data) return { status, data };
    return { status, data: getRedemptionRisk(data.debtInFront, data.totalDebt) };
  }, [status, data]);
}

export interface RedemptionSimulationParams {
  boldAmount: Dnum;
  maxIterationsPerCollateral: number;
}

export function useRedemptionSimulation(params: RedemptionSimulationParams) {
  const boldAmount = dn.from(params.boldAmount, 18)[0];
  const maxIterationsPerCollateral = BigInt(params.maxIterationsPerCollateral);

  const values = useMemo(() => ({
    boldAmount,
    maxIterationsPerCollateral,
  }), [boldAmount, maxIterationsPerCollateral]);

  const [debounced, bouncing] = useDebounced(values);
  const RedemptionHelper = getProtocolContract("RedemptionHelper");

  // We'd love to use `useReadContract()` for this, but wagmi/viem won't let us
  // do that for mutating functions, even though it's a perfectly valid use case.
  // We could hack the ABI, but that's yucky.
  // We pass a dummy account (zeroAddress) so simulations work without a connected wallet.
  return useSimulateContract({
    ...RedemptionHelper,
    functionName: "truncateRedemption",
    args: [debounced.boldAmount, debounced.maxIterationsPerCollateral],
    account: zeroAddress,

    query: {
      refetchInterval: 12_000,
      enabled: !bouncing,

      select: ({ result: [truncatedBold, feePct, output] }) => ({
        bouncing,
        truncatedBold: dnum18(truncatedBold),
        feePct: dnum18(feePct),
        collRedeemed: output.map(({ coll }) => dnum18(coll)),
      }),
    },
  });
}

const AirdropVaultsSchema = v.array(
  v.object({
    name: v.string(),
    link: v.string(),
    icon: v.string(),
  }),
);

export type AirdropVaults = v.InferOutput<typeof AirdropVaultsSchema>;

export function useAirdropVaults(): UseQueryResult<AirdropVaults | null> {
  return useQuery({
    queryKey: ["airdropVaults"],
    queryFn: async () => {
      if (!AIRDROP_VAULTS || !AIRDROP_VAULTS_URL) return null;

      const response = await fetch(AIRDROP_VAULTS_URL);
      const data = await response.json();
      const vaults = v.parse(AirdropVaultsSchema, data);

      const baseUrl = new URL(AIRDROP_VAULTS_URL).origin;
      return vaults.map((vault) => ({
        ...vault,
        icon: vault.icon.startsWith("http")
          ? vault.icon
          : `${baseUrl}${vault.icon}`,
      }));
    },
  });
}

export function useSafetyMode() {
  const allRatios = useBranchesCollateralRatios();

  return useQuery({
    queryKey: [
      "safetyMode",
      jsonStringifyWithDnum(allRatios.data),
    ],
    queryFn: () => {
      if (!allRatios.data) {
        throw new Error("should not happen"); // see enabled
      }

      const branchesInSafetyMode = allRatios.data.filter((branch) => branch.isBelowCcr);

      return {
        isAnySafetyMode: branchesInSafetyMode.length > 0,
        branchesInSafetyMode,
      };
    },
    enabled: Boolean(allRatios.data),
  });
}

export type ShutdownStatus = {
  branchId: BranchId;
  isShutdown: boolean;
};

export function useShutdownStatus() {
  const branches = getBranches();

  return useReadContracts({
    contracts: branches.map((branch) => ({
      ...branch.contracts.TroveManager,
      functionName: "shutdownTime" as const,
    })),
    allowFailure: false,
    query: {
      refetchInterval: 12_000,
      select: (results): ShutdownStatus[] => {
        return results.map((shutdownTime, index) => {
          const branch = branches[index];
          if (!branch) {
            throw new Error(`Branch at index ${index} not found`);
          }
          return {
            branchId: branch.branchId,
            isShutdown: Number(shutdownTime) > 0,
          };
        });
      },
    },
  });
}

export type RedeemableTrove = {
  id: string;
  troveId: TroveId;
  debt: Dnum;
  coll: Dnum;
  stake: Dnum;
  interestRate: Dnum;
};

async function fetchRedeemableTroves(
  wagmiConfig: WagmiConfig,
  branchId: BranchId,
  maxTroves: number = 200,
): Promise<RedeemableTrove[]> {
  const MultiTroveGetter = getProtocolContract("MultiTroveGetter");

  const troves = await readContract(wagmiConfig, {
    ...MultiTroveGetter,
    functionName: "getMultipleSortedTroves",
    args: [BigInt(branchId), -1n, BigInt(maxTroves)],
  });

  return troves
    .filter((trove) => trove.entireDebt > 0n)
    .map((trove) => ({
      id: getPrefixedTroveId(branchId, `0x${trove.id.toString(16)}` as TroveId),
      troveId: `0x${trove.id.toString(16)}` as TroveId,
      debt: dnum18(trove.entireDebt),
      coll: dnum18(trove.entireColl),
      stake: dnum18(trove.stake),
      interestRate: dnum18(trove.annualInterestRate),
    }));
}

export function useRedeemableTroves(
  branchId: BranchId | null,
  options?: { first?: number },
) {
  const wagmiConfig = useWagmiConfig();
  const maxTroves = options?.first ?? 100;

  return useQuery<RedeemableTrove[]>({
    queryKey: ["redeemableTroves", branchId, maxTroves],
    queryFn: async () => {
      if (branchId === null) {
        return [];
      }
      return fetchRedeemableTroves(wagmiConfig, branchId, maxTroves);
    },
    enabled: branchId !== null,
    refetchInterval: 12_000,
  });
}
