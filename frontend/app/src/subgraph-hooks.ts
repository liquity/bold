import type { Address, PositionEarn, PositionLoan, PrefixedTroveId } from "@/src/types";

import { getBuiltGraphSDK } from "@/.graphclient";
import { ACCOUNT_POSITIONS } from "@/src/demo-mode";
import { dnum18 } from "@/src/dnum-utils";
import { DEMO_MODE } from "@/src/env";
import { getCollateralFromTroveSymbol } from "@/src/liquity-utils";
import { isCollIndex, isPositionLoan, isPrefixedtroveId, isTroveId } from "@/src/types";
import { sleep } from "@/src/utils";
import { useQuery } from "@tanstack/react-query";

const REFETCH_INTERVAL = 10_000;

const graph = getBuiltGraphSDK();

type GraphTrove = Awaited<
  ReturnType<typeof graph.TrovesByAccount>
>["troves"][number];

type GraphStabilityPoolDeposit = Awaited<
  ReturnType<typeof graph.StabilityPoolDepositsByAccount>
>["stabilityPoolDeposits"][number];

export let useTroveCount = (account?: Address, collIndex?: number) => {
  return useQuery({
    queryKey: ["TrovesCount", account, collIndex],
    queryFn: async () => {
      if (!account) {
        return null;
      }
      const { borrowerInfo } = await graph.TrovesCount({ id: account.toLowerCase() });
      return collIndex === undefined
        ? borrowerInfo?.troves ?? 0
        : borrowerInfo?.trovesByCollateral[collIndex] ?? null;
    },
    refetchInterval: REFETCH_INTERVAL,
  });
};

if (DEMO_MODE) {
  useTroveCount = (account?: Address, _collIndex?: number) => {
    return useQuery({
      queryKey: ["TrovesCount", account],
      queryFn: async () => {
        if (!account) {
          return null;
        }
        return Object.values(ACCOUNT_POSITIONS)
          .filter(isPositionLoan)
          .length;
      },
    });
  };
}

export let useLoansByAccount = (account?: Address) => {
  return useQuery({
    queryKey: ["TrovesByAccount", account],
    queryFn: async () => {
      if (!account) {
        return null;
      }
      const { troves } = await graph.TrovesByAccount({ account });
      return troves.map(subgraphTroveToLoan);
    },
    refetchInterval: REFETCH_INTERVAL,
  });
};

if (DEMO_MODE) {
  useLoansByAccount = (account?: Address) => {
    return useQuery({
      queryKey: ["TrovesByAccount", account],
      queryFn: async () => {
        if (!account) {
          return [];
        }
        return ACCOUNT_POSITIONS.filter(isPositionLoan);
      },
    });
  };
}

export let useEarnPositionsByAccount = (account?: Address) => {
  return useQuery({
    queryKey: ["StabilityPoolDepositsByAccount", account],
    queryFn: async () => {
      if (!account) {
        return null;
      }
      const { stabilityPoolDeposits } = await graph.StabilityPoolDepositsByAccount({ account });
      return stabilityPoolDeposits.map(subgraphStabilityPoolDepositToEarnPosition);
    },
    refetchInterval: REFETCH_INTERVAL,
  });
};

if (DEMO_MODE) {
  useEarnPositionsByAccount = (account?: Address) => {
    return useQuery({
      queryKey: ["StabilityPoolDepositsByAccount", account],
      queryFn: async () => {
        if (!account) {
          return [];
        }
        return ACCOUNT_POSITIONS
          .filter((position) => position.type === "earn")
          .map((position): GraphStabilityPoolDeposit => ({
            id: "0x" + position.collIndex.toString(16),
            deposit: position.deposit[0],
            collGain: position.rewards.coll[0],
            boldGain: position.rewards.bold[0],
            collateral: {
              collIndex: position.collIndex,
            },
          }));
      },
    });
  };
}

export let useLoanById = (id?: PrefixedTroveId | null) => {
  return useQuery({
    queryKey: ["TroveById", id],
    queryFn: async () => {
      if (!id || !isPrefixedtroveId(id)) {
        return null;
      }
      await sleep(500);
      const { trove } = await graph.TroveById({ id });
      return trove
        ? subgraphTroveToLoan(trove)
        : null;
    },
    refetchInterval: REFETCH_INTERVAL,
  });
};

if (DEMO_MODE) {
  useLoanById = (id?: PrefixedTroveId | null) => {
    return useQuery({
      queryKey: ["TroveById", id],
      queryFn: async () => {
        if (!id || !isPrefixedtroveId(id)) {
          return null;
        }
        await sleep(500);
        for (const pos of ACCOUNT_POSITIONS) {
          if (isPositionLoan(pos) && `${pos.collIndex}:${pos.troveId}` === id) {
            return pos;
          }
        }
        return null;
      },
    });
  };
}

function subgraphTroveToLoan(trove: GraphTrove): PositionLoan {
  if (!isTroveId(trove.troveId)) {
    throw new Error(`Invalid trove ID: ${trove.id} / ${trove.troveId}`);
  }
  const collSymbol = getCollateralFromTroveSymbol(trove.collateral.token.symbol);
  if (!collSymbol) {
    throw new Error(`Invalid collateral symbol: ${collSymbol}`);
  }
  const collIndex = trove.collateral.collIndex;
  if (!isCollIndex(collIndex)) {
    throw new Error(`Invalid collateral index: ${collIndex}`);
  }
  return {
    type: "borrow",
    borrowed: dnum18(trove.debt),
    collateral: collSymbol,
    deposit: dnum18(trove.deposit),
    interestRate: dnum18(trove.interestRate),
    troveId: trove.troveId,
    collIndex,
  };
}

function subgraphStabilityPoolDepositToEarnPosition(spDeposit: GraphStabilityPoolDeposit): PositionEarn {
  const collIndex = spDeposit.collateral.collIndex;
  if (!isCollIndex(collIndex)) {
    throw new Error(`Invalid collateral index: ${collIndex}`);
  }

  return {
    type: "earn",
    apr: dnum18(0),
    deposit: dnum18(spDeposit.deposit),
    collIndex,
    rewards: {
      bold: dnum18(spDeposit.boldGain),
      coll: dnum18(spDeposit.collGain),
    },
  };
}
