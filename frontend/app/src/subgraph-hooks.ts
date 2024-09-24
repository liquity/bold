import type { Address, PositionLoan, PrefixedTroveId } from "@/src/types";

import { getBuiltGraphSDK } from "@/.graphclient";
import { ACCOUNT_POSITIONS } from "@/src/demo-mode";
import { dnum18 } from "@/src/dnum-utils";
import { DEMO_MODE } from "@/src/env";
import { getCollateralFromTroveSymbol } from "@/src/liquity-utils";
import { isCollIndex, isPositionLoan, isPrefixedtroveId, isTroveId } from "@/src/types";
import { sleep } from "@/src/utils";
import { useQuery } from "@tanstack/react-query";

const REFETCH_INTERVAL = 10_000;

const graphSdk = getBuiltGraphSDK();

export let useTroveCount = (account?: Address, collIndex?: number) => {
  return useQuery({
    queryKey: ["TrovesCount", account, collIndex],
    queryFn: async () => {
      if (!account) {
        return null;
      }
      const { borrowerInfo } = await graphSdk.TrovesCount({ id: account.toLowerCase() });
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
      const { troves } = await graphSdk.TrovesByAccount({ account });
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

export let useLoanById = (id?: PrefixedTroveId | null) => {
  return useQuery({
    queryKey: ["TroveById", id],
    queryFn: async () => {
      if (!id || !isPrefixedtroveId(id)) {
        return null;
      }
      await sleep(500);
      const { trove } = await graphSdk.TroveById({ id });
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

function subgraphTroveToLoan(
  trove: Awaited<ReturnType<typeof graphSdk.TrovesByAccount>>["troves"][0],
): PositionLoan {
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
