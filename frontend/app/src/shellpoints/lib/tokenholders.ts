import { getPublicClient } from "@/src/shellpoints/utils/client"
import { ORIGIN_BLOCK } from "@/src/shellpoints/utils/constants"
import { ALCHEMY_API_KEY } from "@/src/shellpoints/utils/env"
import { Alchemy, AssetTransfersCategory, Network } from "alchemy-sdk"
import { Address, BlockTag, getAddress, parseAbi, toHex } from "viem"

export async function getTokenHolders({
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
  fromBlock = fromBlock ?? ORIGIN_BLOCK
  toBlock = toBlock ?? 'latest'

  const alchemy = new Alchemy({
    apiKey: ALCHEMY_API_KEY,
    network: Network.ARB_MAINNET,
  })

  const response = await alchemy.core.getAssetTransfers({
    fromBlock: toHex(fromBlock),
    toBlock: toBlock.toString(),
    contractAddresses: tokenAddresses,
    category: [AssetTransfersCategory.ERC20],
  })

  return response.transfers.reduce((acc, transferInfo) => {
    const contractAddress = getAddress(transferInfo.rawContract.address!)
    const to = getAddress(transferInfo.to!)
    const from = getAddress(transferInfo.from!)
    const amount = BigInt(transferInfo.value ?? 0)
    const blockNumber = BigInt(transferInfo.blockNum ?? 0)
    const existing = acc[contractAddress] ?? []
    const existingIndex = existing.findIndex(item => item.to === to)
    if (existingIndex !== -1) {
      existing[existingIndex]!.values.push({ from, amount, blockNumber })
    } else {
      acc[contractAddress] = Array.from(new Set((acc[contractAddress] ?? []).concat({ to, values: [{ from, amount, blockNumber }] })))
    }
    return acc
  }, {} as Record<Address, { to: Address, values: { from: Address, amount: bigint, blockNumber: bigint }[] }[]>)
}