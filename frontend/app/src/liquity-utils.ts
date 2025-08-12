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
  RiskLevel,
  Token,
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
  INTEREST_RATE_ADJ_COOLDOWN,
  INTEREST_RATE_END,
  INTEREST_RATE_INCREMENT_NORMAL,
  INTEREST_RATE_INCREMENT_PRECISE,
  INTEREST_RATE_PRECISE_UNTIL,
  INTEREST_RATE_START,
  TROVE_STATUS_ZOMBIE,
} from "@/src/constants";
import { CONTRACTS, getBranchContract, getProtocolContract } from "@/src/contracts";
import { dnum18, DNUM_0, dnumOrNull, jsonStringifyWithDnum } from "@/src/dnum-utils";
import { CHAIN_BLOCK_EXPLORER, ENV_BRANCHES, LEGACY_CHECK, LIQUITY_STATS_URL } from "@/src/env";
import { getRedemptionRisk } from "@/src/liquity-math";
import { usePrice } from "@/src/services/Prices";
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
import { useBalance, useConfig as useWagmiConfig, useReadContract, useReadContracts } from "wagmi";
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

export function getBranchesCount(): number {
  return ENV_BRANCHES.length;
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

export function useStakePosition(address: null | Address) {
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

  return useReadContracts({
    contracts: [{
      ...LqtyStaking,
      functionName: "stakes",
      args: [userProxyAddress.data ?? "0x"],
    }, {
      ...LqtyStaking,
      functionName: "getPendingETHGain",
      args: [userProxyAddress.data ?? "0x"],
    }, {
      ...LqtyStaking,
      functionName: "getPendingLUSDGain",
      args: [userProxyAddress.data ?? "0x"],
    }, {
      ...LusdToken,
      functionName: "balanceOf",
      args: [userProxyAddress.data ?? "0x"],
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

export function useTroveNftUrl(branchId: null | BranchId, troveId: null | TroveId) {
  const TroveNft = getBranchContract(branchId, "TroveNFT");
  return TroveNft && troveId && `${CHAIN_BLOCK_EXPLORER?.url}nft/${TroveNft.address}/${BigInt(troveId)}`;
}

export function useInterestRateBrackets(branchId: BranchId) {
  const brackets = useAllInterestRateBrackets();
  return useQuery({
    queryKey: ["InterestRateBrackets", branchId],
    enabled: brackets.status !== "pending",
    queryFn: () => {
      if (brackets.status === "error") {
        throw brackets.error;
      }

      if (brackets.status === "pending") {
        throw new Error(); // should not reach
      }

      return brackets.data.filter((bracket) => bracket.branchId === branchId);
    },
  });
}

export function useAllInterestRateBrackets() {
  return useQuery({
    queryKey: ["AllInterestRateBrackets"],
    queryFn: () => getAllInterestRateBrackets(),
  });
}

export function useAverageInterestRate(branchId: BranchId) {
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

export function useInterestRateChartData(branchId: BranchId, excludedLoan?: PositionLoanCommitted) {
  const brackets = useInterestRateBrackets(branchId);
  return useQuery({
    queryKey: ["useInterestRateChartData", jsonStringifyWithDnum(brackets.data), excludedLoan?.troveId],
    queryFn: () => {
      if (!brackets.isSuccess) {
        throw new Error(); // should never happen (see enabled)
      }

      const debtByRate = new Map<string, Dnum>(
        brackets.data
          .filter(({ rate }) => dn.gte(rate, INTEREST_RATE_START) && dn.lte(rate, INTEREST_RATE_END))
          .map((bracket) => [dn.toJSON(bracket.rate), bracket.totalDebt]),
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
          aggregatedDebt = dn.sub(aggregatedDebt, excludedLoan.indexedDebt);
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

      return chartData;
    },
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
    // TODO: phase out in the future, once all frontends update to the "safe" (losely-typed) `prices` schema
    otherPrices: v.optional(v.record(
      v.string(),
      v.string(),
    )),
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
    prices: Object.fromEntries(
      [
        ...Object.entries(value.prices),
        // TODO: phase out in the future, once all frontends update to the "safe" (losely-typed) `prices` schema
        ...Object.entries(value.otherPrices ?? {}),
      ].map(([symbol, price]) => [
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
      const TroveManager = getBranchContract(branchId, "TroveManager");

      const [totalColl, totalDebt, ccr_] = await readContracts(wagmiConfig, {
        contracts: [{
          ...TroveManager,
          functionName: "getEntireBranchColl",
        }, {
          ...TroveManager,
          functionName: "getEntireBranchDebt",
        }, {
          ...TroveManager,
          functionName: "CCR",
        }],
        allowFailure: false,
      });

      const ccr = dnum18(ccr_);

      if (!collTokenPrice.data || dn.eq(totalDebt, 0)) {
        return { ccr, isBelowCcr: false, tcr: null };
      }

      // TCR = (totalCollateral * collTokenPrice) / totalDebt
      const tcr = dn.div(
        dn.mul(dnum18(totalColl), collTokenPrice.data),
        dnum18(totalDebt),
      );

      const isBelowCcr = dn.lt(tcr, ccr);

      return { ccr, isBelowCcr, tcr };
    },
    enabled: Boolean(collTokenPrice.data),
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

  return useQuery<PositionLoanCommitted | null>({
    queryKey: ["TroveById", id],
    queryFn: () => (
      id ? fetchLoanById(wagmiConfig, id) : null
    ),
  });
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

      const [batches, batchesFromChain] = await Promise.all([
        getInterestBatches(branchId, batchAddresses),
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

export async function fetchLoanById(
  wagmiConfig: WagmiConfig,
  fullId: null | PrefixedTroveId,
  maybeIndexedTrove?: IndexedTrove,
): Promise<PositionLoanCommitted | null> {
  if (!isPrefixedtroveId(fullId)) return null;

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
    indexedDebt: indexedTrove.debt,
    deposit: dnum18(troveData.entireColl),
    interestRate: dnum18(troveData.annualInterestRate),
    status: indexedTrove.status,
    troveId,
    isZombie: troveStatus === TROVE_STATUS_ZOMBIE,
    redemptionCount: indexedTrove.redemptionCount,
    redeemedColl: indexedTrove.redeemedColl,
    redeemedDebt: indexedTrove.redeemedDebt,
  };
}

export async function fetchLoansByAccount(
  wagmiConfig: WagmiConfig,
  account?: Address | null,
): Promise<PositionLoanCommitted[] | null> {
  if (!account) return null;

  const troves = await getIndexedTrovesByAccount(account);

  const results = await Promise.all(troves.map((trove) => {
    if (!isPrefixedtroveId(trove.id)) {
      throw new Error(`Invalid prefixed trove ID: ${trove.id}`);
    }
    return fetchLoanById(wagmiConfig, trove.id, trove);
  }));

  return results.filter((result) => result !== null);
}

export function useLoansByAccount(account?: Address | null) {
  const wagmiConfig = useWagmiConfig();
  return useQuery<PositionLoanCommitted[] | null>({
    queryKey: ["TrovesByAccount", account],
    queryFn: () => fetchLoansByAccount(wagmiConfig, account),
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
  return useQuery({
    queryKey: ["NextTroveId", borrower, branchId],
    queryFn: () => (
      borrower && branchId !== null
        ? getNextOwnerIndex(branchId, borrower)
        : null
    ),
    enabled: borrower !== null && branchId !== null,
  });
}

export function useDebtPositioning(branchId: BranchId, interestRate: Dnum | null) {
  const chartData = useInterestRateChartData(branchId);

  return useMemo(() => {
    if (!chartData.data || !interestRate) {
      return { debtInFront: null, totalDebt: null };
    }

    // find the bracket that contains this interest rate
    const bracket = chartData.data.find((item) =>
      dn.lte(item.rate, interestRate)
      && dn.lt(
        interestRate,
        dn.add(
          item.rate,
          dn.lt(item.rate, INTEREST_RATE_PRECISE_UNTIL)
            ? INTEREST_RATE_INCREMENT_PRECISE
            : INTEREST_RATE_INCREMENT_NORMAL,
        ),
      )
    );

    if (!bracket) {
      return { debtInFront: null, totalDebt: null };
    }

    // calculate total debt from all brackets
    const totalDebt = chartData.data.reduce(
      (sum, item) => dn.add(sum, item.debt),
      DNUM_0,
    );

    return {
      debtInFront: bracket.debtInFront,
      totalDebt,
    };
  }, [chartData.data, interestRate]);
}

export function useRedemptionRisk(
  branchId: BranchId,
  interestRate: Dnum | null,
): UseQueryResult<RiskLevel | null> {
  const debtPositioning = useDebtPositioning(branchId, interestRate);

  return useQuery({
    queryKey: ["useRedemptionRisk", branchId, jsonStringifyWithDnum(interestRate)],
    queryFn: () => {
      if (!debtPositioning.debtInFront || !debtPositioning.totalDebt) {
        return null;
      }
      return getRedemptionRisk(debtPositioning.debtInFront, debtPositioning.totalDebt);
    },
    enabled: debtPositioning.debtInFront !== null && debtPositioning.totalDebt !== null,
  });
}
