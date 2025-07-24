import { Address, createPublicClient, hexToBigInt, http, toHex } from "viem";
import { getContracts } from "./contracts";
import { CollIndex, CombinedTroveData, DebtPerInterestRate, PrefixedTroveId, ReturnCombinedTroveReadCallData, ReturnTroveReadCallData, Trove, TroveStatus } from "./types";
import { CHAIN_RPC_URL } from "./env";
import { CHAIN } from "./services/Arbitrum";
import { getCollToken, getPrefixedTroveId, parsePrefixedTroveId } from "./liquity-utils";

export function getPublicClient() {
  return createPublicClient({
    chain: CHAIN,
    transport: http(CHAIN_RPC_URL),
  })
}

export async function getAllTroves(): Promise<Record<CollIndex, CombinedTroveData[]>> {
  const { collaterals, MultiTroveGetter } = getContracts()
  const client = getPublicClient()
  const troves: Record<CollIndex, CombinedTroveData[]> = {
    0: [],
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
    6: [],
    7: [],
  }

  const output = await client.multicall({
    contracts: collaterals.map(collateral => ({
      ...MultiTroveGetter,
      functionName: "getMultipleSortedTroves",
      args: [collateral.collIndex, 0n, 1_000_000_000n],
    })),
  })

  output.forEach((troveList, index) => {
    if (troveList.status === "success") {
      troves[index as CollIndex] = troveList.result as unknown as CombinedTroveData[];
    }
  })

  return troves;
}

export async function getTroveById(id: PrefixedTroveId): Promise<ReturnTroveReadCallData | undefined> {
  const { collaterals } = getContracts()
  const client = getPublicClient()
  const { collIndex, troveId } = parsePrefixedTroveId(id)
  const tokenId = hexToBigInt(troveId)
  const output = await client.multicall({
    contracts: [
      {
        ...collaterals[collIndex]!.contracts.TroveNFT,
        functionName: "ownerOf",
        args: [tokenId],
      },
      {
        ...collaterals[collIndex]!.contracts.TroveManager,
        functionName: "Troves",
        args: [tokenId],
      }
    ]
  })

  const collateral = getCollToken(collIndex)!
  const trove = output[1]?.result ? {
    debt: output[1]?.result[0],
    coll: output[1]?.result[1],
    stake: output[1]?.result[2],
    status: output[1]?.result[3],
    arrayIndex: output[1]?.result[4],
    lastDebtUpdateTime: output[1]?.result[5],
    lastInterestRateAdjTime: output[1]?.result[6],
    annualInterestRate: output[1]?.result[7],
    interestBatchManager: output[1]?.result[8],
    batchDebtShares: output[1]?.result[9],
  } as Trove : undefined
  const owner = output[0]?.result as Address
  if (!owner || !trove) return undefined

  return {
    ...trove,
    id,
    troveId,
    borrower: owner,
    deposit: trove.coll,
    interestRate: trove.annualInterestRate,
    collateral: {
      id: collIndex.toString(),
      token: {
        symbol: collateral.symbol,
        name: collateral.name,
      },
      minCollRatio: collateral.collateralRatio,
      collIndex,
    },
    interestBatch: {
      annualInterestRate: trove.annualInterestRate,
      batchManager: trove.interestBatchManager,
    }
  }
}

export async function getTrovesByAccount(account: Address): Promise<ReturnCombinedTroveReadCallData[]> {
  const { collaterals } = getContracts()
  const client = getPublicClient()

  const allTroves = Object.entries(await getAllTroves()).flatMap(([collIndex, troves]) => {
    return troves.map(trove => ({
      ...trove,
      collateral: collaterals[Number(collIndex) as CollIndex]!,
    }))
  })

  const troveOwners = await client.multicall({
    contracts: allTroves.map(trove => [
      {
        ...trove.collateral.contracts.TroveNFT,
        functionName: "ownerOf",
        args: [trove.id],
      },
      {
        ...trove.collateral.contracts.TroveManager,
        functionName: "Troves",
        args: [trove.id],
      }
    ]).flat(),
  })

  const owners = troveOwners.filter((_, index) => index % 2 === 0).map(owner => owner.result as string | undefined)
  const troves = troveOwners.filter((_, index) => index % 2 === 1).map(trove => trove.result as unknown as Trove | undefined)

  return allTroves
    .filter((_, index) => owners[index]?.toLowerCase() === account.toLowerCase())
    .map((trove, index) => {
      const collateral = getCollToken(trove.collateral.collIndex)!
      const troveId = toHex(trove.id, { size: 32 })
      return {
        ...trove,
        id: getPrefixedTroveId(trove.collateral.collIndex, troveId),
        troveId,
        borrower: owners[index] as Address,
        debt: trove.entireDebt,
        deposit: trove.entireColl,
        interestRate: trove.annualInterestRate,
        status: troves[index]?.status ?? TroveStatus.nonExistent,
        collateral: {
          id: trove.collateral.collIndex.toString(),
          token: {
            symbol: collateral.symbol,
            name: collateral.name,
          },
          minCollRatio: collateral.collateralRatio,
          collIndex: trove.collateral.collIndex,
        },
        interestBatch: {
          annualInterestRate: trove.annualInterestRate,
          batchManager: trove.interestBatchManager,
        }
      }
    })
}

export async function getAllDebtPerInterestRate(): Promise<Record<CollIndex, DebtPerInterestRate[]>> {
  const { collaterals, MultiTroveGetter } = getContracts()
  const client = getPublicClient()
  const debtPerInterestRate: Record<CollIndex, DebtPerInterestRate[]> = {
    0: [],
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
    6: [],
    7: [],
  }

  const output = await client.multicall({
    contracts: collaterals.map(collateral => ({
      ...MultiTroveGetter,
      functionName: "getDebtPerInterestRateAscending",
      args: [collateral.collIndex, 0n, 10n],
    })),
  })

  output.forEach((list, index) => {
    if (list.status === "success") {
      debtPerInterestRate[index as CollIndex] = (list.result as unknown as [DebtPerInterestRate[], bigint])[0];
    }
  })

  return debtPerInterestRate;
}