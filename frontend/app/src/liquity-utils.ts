import type { GraphStabilityPoolDeposit } from "@/src/subgraph-hooks";
import type { CollIndex, Dnum, PositionEarn, PrefixedTroveId, TroveId } from "@/src/types";
import type { Address, CollateralSymbol, CollateralToken } from "@liquity2/uikit";

import { useCollateralContract, useCollateralContracts } from "@/src/contracts";
import { dnum18 } from "@/src/dnum-utils";
import { getBoldGainFromSnapshots, getCollGainFromSnapshots } from "@/src/liquity-stability-pool";
import { useStabilityPoolDeposit, useStabilityPoolDeposits, useStabilityPoolEpochScale } from "@/src/subgraph-hooks";
import { isCollIndex, isTroveId } from "@/src/types";
import { COLLATERALS } from "@liquity2/uikit";
import { match } from "ts-pattern";
import { encodeAbiParameters, keccak256, parseAbiParameters } from "viem";
import { useReadContracts } from "wagmi";

// As defined in ITroveManager.sol
export type TroveStatus =
  | "nonExistent"
  | "active"
  | "closedByOwner"
  | "closedByLiquidation"
  | "unredeemable";

export function shortenTroveId(troveId: TroveId, chars = 4) {
  return troveId.length < chars * 2 + 2
    ? troveId
    : troveId.slice(0, chars + 2) + "…" + troveId.slice(-chars);
}

export function troveStatusFromNumber(value: number): TroveStatus {
  return match<number, TroveStatus>(value)
    .with(0, () => "nonExistent")
    .with(1, () => "active")
    .with(2, () => "closedByOwner")
    .with(3, () => "closedByLiquidation")
    .with(4, () => "unredeemable")
    .otherwise(() => {
      throw new Error(`Unknown trove status number: ${value}`);
    });
}

export function troveStatusToLabel(status: TroveStatus) {
  return match(status)
    .with("nonExistent", () => "Non-existent")
    .with("active", () => "Active")
    .with("closedByOwner", () => "Closed by owner")
    .with("closedByLiquidation", () => "Closed by liquidation")
    .with("unredeemable", () => "Unredeemable")
    .exhaustive();
}

export function getTroveId(owner: Address, ownerIndex: bigint | number) {
  return BigInt(keccak256(encodeAbiParameters(
    parseAbiParameters("address, uint256"),
    [owner, BigInt(ownerIndex)],
  )));
}

export function getCollateralFromTroveSymbol(symbol: string): null | CollateralSymbol {
  symbol = symbol.toUpperCase();
  if (symbol === "ETH" || symbol === "WETH") {
    return "ETH";
  }
  // this is to handle symbols used for testing, like stETH1, stETH2, etc.
  if (symbol.startsWith("RETH")) {
    return "RETH";
  }
  if (symbol.startsWith("STETH")) {
    return "STETH";
  }
  return null;
}

export function parsePrefixedTroveId(value: PrefixedTroveId): {
  collIndex: CollIndex;
  troveId: TroveId;
} {
  const [collIndex_, troveId] = value.split(":");
  const collIndex = parseInt(collIndex_, 10);
  if (!isCollIndex(collIndex) || !isTroveId(troveId)) {
    throw new Error(`Invalid prefixed trove ID: ${value}`);
  }
  return { collIndex, troveId };
}

export function getPrefixedTroveId(collIndex: CollIndex, troveId: TroveId): PrefixedTroveId {
  return `${collIndex}:${troveId}`;
}

export function useCollateral(collIndex: null | number): null | CollateralToken {
  const collContracts = useCollateralContracts();
  if (collIndex === null) {
    return null;
  }
  return collContracts.map(({ symbol }) => {
    const collateral = COLLATERALS.find((c) => c.symbol === symbol);
    if (!collateral) {
      throw new Error(`Unknown collateral symbol: ${symbol}`);
    }
    return collateral;
  })[collIndex];
}

export function useCollIndexFromSymbol(symbol: CollateralSymbol | null): CollIndex | null {
  const collContracts = useCollateralContracts();
  if (symbol === null) {
    return null;
  }
  const collIndex = collContracts.findIndex((coll) => coll.symbol === symbol);
  return isCollIndex(collIndex) ? collIndex : null;
}

export function useEarnPositions(account: null | Address) {
  const spDeposits = useStabilityPoolDeposits(account);

  spDeposits.data?.map((d) => d.deposit);
}

export function useEarnPosition(
  collIndex: null | CollIndex,
  account: null | Address,
) {
  const collateral = useCollateral(collIndex);

  console.log(
    useActivePoolAggWeightedDebtSum(
      collateral?.symbol ?? null,
    ).data,
  );

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

  const base = spDeposit.status === "success"
    ? epochScale1.status === "success"
      ? epochScale2
      : epochScale1
    : spDeposit;

  return {
    ...base,
    data: spDeposit.data && epochScale1.data && epochScale2.data
      ? earnPositionFromGraph(spDeposit.data, {
        bold: dnum18(
          getBoldGainFromSnapshots(
            spDeposit.data.deposit,
            spDeposit.data.snapshot.P,
            spDeposit.data.snapshot.B,
            epochScale1.data.B,
            epochScale2.data.B,
          ),
        ),
        coll: dnum18(
          getCollGainFromSnapshots(
            spDeposit.data.deposit,
            spDeposit.data.snapshot.P,
            spDeposit.data.snapshot.S,
            epochScale1.data.S,
            epochScale2.data.S,
          ),
        ),
      })
      : null,
  };
}

function useActivePoolAggWeightedDebtSum(symbol: CollateralSymbol | null) {
  const ActivePool = useCollateralContract(symbol, "ActivePool");

  return useReadContracts({
    contracts: [{
      ...(ActivePool as NonNullable<typeof ActivePool>),
      functionName: "aggWeightedDebtSum",
    }, {
      ...(ActivePool as NonNullable<typeof ActivePool>),
      functionName: "lastAggUpdateTime",
    }],
    query: {
      refetchInterval: 10_000,
      select: ([aggWeightedDebtSum, lastAggUpdateTime]) => ({
        aggWeightedDebtSum: aggWeightedDebtSum.result,
        lastAggUpdateTime: lastAggUpdateTime.result,
      }),
    },
  });
}

function earnPositionFromGraph(
  spDeposit: GraphStabilityPoolDeposit,
  rewards: { bold: Dnum; coll: Dnum },
): PositionEarn {
  const collIndex = spDeposit.collateral.collIndex;
  if (!isCollIndex(collIndex)) {
    throw new Error(`Invalid collateral index: ${collIndex}`);
  }
  return {
    type: "earn",
    apr: dnum18(0),
    deposit: dnum18(spDeposit.deposit),
    collIndex,
    rewards,
  };
}
