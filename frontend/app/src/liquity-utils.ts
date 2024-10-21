import type { GraphStabilityPoolDeposit } from "@/src/subgraph-hooks";
import type { CollIndex, Delegate, Dnum, PositionEarn, PositionStake, PrefixedTroveId, TroveId } from "@/src/types";
import type { Address, CollateralSymbol, CollateralToken } from "@liquity2/uikit";

import { DATA_REFRESH_INTERVAL } from "@/src/constants";
import { useAllCollateralContracts, useProtocolContract } from "@/src/contracts";
import { dnum18 } from "@/src/dnum-utils";
import {
  calculateStabilityPoolApr,
  getCollGainFromSnapshots,
  useContinuousBoldGains,
  useSpYieldGainParameters,
} from "@/src/liquity-stability-pool";
import {
  useInterestBatch,
  useStabilityPool,
  useStabilityPoolDeposit,
  useStabilityPoolEpochScale,
} from "@/src/subgraph-hooks";
import { isCollIndex, isTroveId } from "@/src/types";
import { COLLATERALS, shortenAddress } from "@liquity2/uikit";
import { useQuery } from "@tanstack/react-query";
import * as dn from "dnum";
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

export function shortenTroveId(troveId: TroveId, chars = 8) {
  return troveId.length < chars * 2 + 2
    ? troveId
    // : troveId.slice(0, chars + 2) + "…" + troveId.slice(-chars);
    : troveId.slice(0, chars + 2) + "…";
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
  const collContracts = useAllCollateralContracts();
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
  const collContracts = useAllCollateralContracts();
  if (symbol === null) {
    return null;
  }
  const collIndex = collContracts.findIndex((coll) => coll.symbol === symbol);
  return isCollIndex(collIndex) ? collIndex : null;
}

export function useEarnPool(collIndex: null | CollIndex) {
  const collateral = useCollateral(collIndex);
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
      : earnPositionFromGraph(
        spDeposit.data,
        {
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
        },
      ),
  };
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

export function useStakePosition(address: null | Address) {
  const LqtyStaking = useProtocolContract("LqtyStaking");

  return useReadContracts({
    contracts: [
      {
        abi: LqtyStaking.abi,
        address: LqtyStaking.address,
        functionName: "stakes",
        args: [address ?? "0x"],
      },
      {
        abi: LqtyStaking.abi,
        address: LqtyStaking.address,
        functionName: "totalLQTYStaked",
      },
    ],
    query: {
      enabled: Boolean(address),
      refetchInterval: DATA_REFRESH_INTERVAL,
      select: ([deposit_, totalStaked_]): PositionStake => {
        const totalStaked = dnum18(totalStaked_);
        const deposit = dnum18(deposit_);
        return {
          type: "stake",
          deposit,
          totalStaked,
          rewards: {
            eth: dnum18(0),
            lusd: dnum18(0),
          },
          share: dn.gt(totalStaked, 0) ? dn.div(deposit, totalStaked) : dnum18(0),
        };
      },
    },
    allowFailure: false,
  });
}
