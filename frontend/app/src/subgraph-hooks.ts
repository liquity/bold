import type { Address, PositionLoan, TroveId } from "@/src/types";

import { getBuiltGraphSDK } from "@/.graphclient";
import { ACCOUNT_POSITIONS } from "@/src/demo-mode";
import { dnum18 } from "@/src/dnum-utils";
import { DEMO_MODE } from "@/src/env";
import { getCollateralFromTroveSymbol } from "@/src/liquity-utils";
import { isPositionLoan, isTroveId } from "@/src/types";
import { sleep } from "@/src/utils";
import { useQuery } from "@tanstack/react-query";

const graphSdk = getBuiltGraphSDK();

function subgraphTroveToLoan(
  trove: Awaited<ReturnType<typeof graphSdk.TrovesByAccount>>["troves"][0],
): PositionLoan {
  if (!isTroveId(trove.id)) {
    throw new Error(`Invalid trove ID: ${trove.id}`);
  }
  const collSymbol = getCollateralFromTroveSymbol(trove.collateral.token.symbol);
  if (!collSymbol) {
    throw new Error(`Invalid collateral symbol: ${collSymbol}`);
  }
  return {
    type: "borrow",
    borrowed: dnum18(trove.debt),
    collateral: collSymbol,
    deposit: dnum18(trove.deposit),
    interestRate: dnum18(trove.interestRate),
    troveId: trove.id,
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

export let useLoanById = (troveId?: TroveId | null) => {
  return useQuery({
    queryKey: ["TroveById", troveId],
    queryFn: async () => {
      if (!troveId || !isTroveId(troveId)) {
        return null;
      }
      await sleep(500);
      const { trove } = await graphSdk.TroveById({ id: troveId });
      return trove && isTroveId(trove.id)
        ? subgraphTroveToLoan(trove)
        : null;
    },
  });
};

if (DEMO_MODE) {
  useLoanById = (troveId?: TroveId | null) => {
    return useQuery({
      queryKey: ["TroveById", troveId],
      queryFn: async () => {
        if (!troveId || !isTroveId(troveId)) {
          return null;
        }
        for (const position of ACCOUNT_POSITIONS) {
          if (isPositionLoan(position) && position.troveId === troveId) {
            return position;
          }
        }
        return null;
      },
    });
  };
}
