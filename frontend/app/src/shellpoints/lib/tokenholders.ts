import { CONTRACT_ADDRESSES } from "@/src/contracts"
import { getPublicClient } from "@/src/shellpoints/utils/client"
import { ORIGIN_BLOCK } from "@/src/shellpoints/utils/constants"
import { ALCHEMY_API_KEY } from "@/src/shellpoints/utils/env"
import { CollIndex } from "@/src/types"
import { AssetTransfersCategory, AssetTransfersResult, Network } from "alchemy-sdk"
import { Address, BlockTag, getAddress, isAddressEqual, parseAbi, toHex } from "viem"

export async function getTokenBalances(args: {
  token: Address, 
  holder: Address,
  receivedOn?: {
    from: Address;
    amount: bigint;
    blockNumber: bigint;
    decimals: number;
  }[]
}[]) {
  const client = getPublicClient();

  const balances: bigint[] = await client.multicall({
    contracts: args.map(arg => ({
      address: arg.token,
      abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
      functionName: 'balanceOf',
      args: [arg.holder]
    })),
    allowFailure: false,
  })

  return args.map((arg, index) => ({
    ...arg,
    balance: balances[index]
  }))
}

export async function getTokenHoldersViaAlchemyAPI({
  tokenAddresses,
  fromBlock,
  toBlock,
}: {
  tokenAddresses: Address[]
  fromBlock?: bigint | BlockTag
  toBlock?: bigint | BlockTag
}) {
  fromBlock = fromBlock ?? ORIGIN_BLOCK
  toBlock = toBlock ?? 'latest'

  const client = getPublicClient();

  const recipients = await getAssetRecipients({ tokenAddresses, fromBlock, toBlock });

  const holders = Object.entries(recipients).map(([contractAddress, toAddresses]) => {
    return toAddresses.map(toAddress => ({
      token: getAddress(contractAddress),
      holder: getAddress(toAddress.to),
      receivedOn: toAddress.values
    }))
  }).flat()

  const balances = await client.multicall({
    contracts: holders.map(holder => ({
      address: holder.token,
      abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
      functionName: 'balanceOf',
      args: [holder.holder]
    })),
    allowFailure: false,
  })

  return holders.map((holder, index) => ({
    ...holder,
    balance: balances[index]
  }))
}

export async function getAssetRecipients({
  tokenAddresses,
  fromBlock,
  toBlock,
}: {
  tokenAddresses: Address[]
  fromBlock?: bigint | BlockTag
  toBlock?: bigint | BlockTag
}) {
  const transfers = await getAssetTransfers({ tokenAddresses, fromBlock, toBlock })
  return getRecipientsFromAssetTransfers(transfers)
}

export function getStabilityPoolDepositsFromAssetTransfers(transfers: AssetTransfersResult[]) {
  const deposits = transfers.filter(transfer => transfer.to && CONTRACT_ADDRESSES.collaterals.find(coll => isAddressEqual(coll.contracts.StabilityPool, getAddress(transfer.to!))))
  return deposits.reduce((acc, deposit) => {
    const from = getAddress(deposit.from)
    const to = getAddress(deposit.to!)
    const amount = BigInt(deposit.rawContract.value ?? 0)
    const decimals = Number(BigInt(deposit.rawContract.decimal ?? 18))
    const blockNumber = BigInt(deposit.blockNum)
    const branch = CONTRACT_ADDRESSES.collaterals.findIndex(coll => isAddressEqual(coll.contracts.StabilityPool, to))
    if (branch === -1) return acc
    const existing = acc[from] ?? []
    const existingIndex = existing.findIndex(item => item.branch === branch)
    if (existingIndex !== -1) {
      existing[existingIndex]!.amount += amount
    } else {
      acc[from] = Array.from(new Set((acc[from] ?? []).concat({ branch: branch as CollIndex, amount, blockNumber, decimals })))
    }
    return acc
  }, {} as Record<Address, { branch: CollIndex, amount: bigint, blockNumber: bigint, decimals: number }[]>)
}

export function getStabilityPoolDepositsFromAssetTransfersStringified(transfers: AssetTransfersResult[]) {
  const deposits = transfers.filter(transfer => transfer.rawContract.address && isAddressEqual(getAddress(transfer.rawContract.address), CONTRACT_ADDRESSES.BoldToken) && transfer.to && CONTRACT_ADDRESSES.collaterals.find(coll => isAddressEqual(coll.contracts.StabilityPool, getAddress(transfer.to!))))
  return deposits.reduce((acc, deposit) => {
    const from = getAddress(deposit.from)
    const to = getAddress(deposit.to!)
    const amount = BigInt(deposit.rawContract.value ?? 0)
    const decimals = Number(BigInt(deposit.rawContract.decimal ?? 18))
    const blockNumber = deposit.blockNum
    const branch = CONTRACT_ADDRESSES.collaterals.findIndex(coll => isAddressEqual(coll.contracts.StabilityPool, to))
    if (branch === -1) return acc
    const existing = acc[from] ?? []
    const existingIndex = existing.findIndex(item => item.branch === branch)
    if (existingIndex !== -1) {
      const existingAmount = BigInt(existing[existingIndex]!.amount)
      existing[existingIndex]!.amount = (existingAmount + amount).toString()
    } else {
      acc[from] = Array.from(new Set((acc[from] ?? []).concat({ branch: branch as CollIndex, amount: amount.toString(), blockNumber, decimals })))
    }
    return acc
  }, {} as Record<Address, { branch: CollIndex, amount: string, blockNumber: string, decimals: number }[]>)
}

export function getYUSNDDepositsFromAssetTransfersStringified(transfers: AssetTransfersResult[]) {
  const deposits = transfers
    .filter(transfer => transfer.rawContract.address && transfer.to && isAddressEqual(getAddress(transfer.rawContract.address), CONTRACT_ADDRESSES.YUSND))
    .map(transfer => getAddress(transfer.to!))

  return Array.from(new Set(deposits))
}

export function getStabilityPoolDepositsFromAssetRecipients(recipients: { to: Address, values: { from: Address, amount: bigint, blockNumber: bigint, decimals: number }[] }[]) {
  const deposits = 
    recipients
      .filter(recipient => CONTRACT_ADDRESSES.collaterals.find(coll => isAddressEqual(coll.contracts.StabilityPool, getAddress(recipient.to))))
      .map(recipient => recipient.values.map(value => ({ sp: recipient.to, ...value })))
      .flat()
  return deposits.reduce((acc, deposit) => {
    const from = getAddress(deposit.from)
    const to = getAddress(deposit.sp)
    const amount = BigInt(deposit.amount)
    const decimals = Number(BigInt(deposit.decimals))
    const blockNumber = BigInt(deposit.blockNumber)
    const branch = CONTRACT_ADDRESSES.collaterals.findIndex(coll => isAddressEqual(coll.contracts.StabilityPool, to))
    if (branch === -1) return acc
    const existing = acc[from] ?? []
    const existingIndex = existing.findIndex(item => item.branch === branch)
    if (existingIndex !== -1) {
      existing[existingIndex]!.amount += amount
    } else {
      acc[from] = Array.from(new Set((acc[from] ?? []).concat({ branch: branch as CollIndex, amount, blockNumber, decimals })))
    }
    return acc
  }, {} as Record<Address, { branch: CollIndex, amount: bigint, blockNumber: bigint, decimals: number }[]>)
}

export function getRecipientsFromAssetTransfers(transfers: AssetTransfersResult[]) {
  return transfers.reduce((acc, transferInfo) => {
    const contractAddress = getAddress(transferInfo.rawContract.address!)
    const to = getAddress(transferInfo.to!)
    const from = getAddress(transferInfo.from)
    const amount = BigInt(transferInfo.rawContract.value ?? 0)
    const decimals = Number(BigInt(transferInfo.rawContract.decimal ?? 18))
    const blockNumber = BigInt(transferInfo.blockNum)
    const existing = acc[contractAddress] ?? []
    const existingIndex = existing.findIndex(item => item.to === to)
    if (existingIndex !== -1) {
      existing[existingIndex]!.values.push({ from, amount, blockNumber, decimals })
    } else {
      acc[contractAddress] = Array.from(new Set((acc[contractAddress] ?? []).concat({ to, values: [{ from, amount, blockNumber, decimals }] })))
    }
    return acc
  }, {} as Record<Address, { to: Address, values: { from: Address, amount: bigint, blockNumber: bigint, decimals: number }[] }[]>)
}

export async function getAssetTransfers({
  tokenAddresses,
  fromBlock,
  toBlock,
  toAddresses,
  fromAddresses,
}: {
  tokenAddresses: Address[]
  fromBlock?: bigint | BlockTag
  toBlock?: bigint | BlockTag
  toAddresses?: Address[]
  fromAddresses?: Address[]
}) {
  fromBlock = fromBlock ?? ORIGIN_BLOCK
  toBlock = toBlock ?? 'latest'

  const response = await (await fetch(`https://${Network.ARB_MAINNET}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 42,
      method: 'alchemy_getAssetTransfers',
      params: [
        {
          fromBlock: toHex(fromBlock),
          toBlock: toBlock.toString(),
          contractAddresses: tokenAddresses,
          category: [AssetTransfersCategory.ERC20],
          toAddresses: toAddresses,
          fromAddresses: fromAddresses,
        }
      ]
    })
  })).json() as { jsonrpc: string, id: number, result: { transfers: AssetTransfersResult[] } }

  return response.result.transfers
}