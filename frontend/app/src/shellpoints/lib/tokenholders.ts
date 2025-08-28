import { getPublicClient } from "@/src/shellpoints/utils/client"
import { ORIGIN_BLOCK } from "@/src/shellpoints/utils/constants"
import { ALCHEMY_API_KEY } from "@/src/shellpoints/utils/env"
import { AssetTransfersCategory, AssetTransfersResult, Network } from "alchemy-sdk"
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
  console.log("Retrieved client");

  console.log({ tokenAddresses })

  const recipients = await getAssetRecipients({ tokenAddresses, fromBlock, toBlock });
  console.log("Retrieved recipients");

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

  // const alchemy = new Alchemy({
  //   apiKey: ALCHEMY_API_KEY,
  //   network: Network.ARB_MAINNET,
  // })

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
        }
      ]
    })
  })).json() as { jsonrpc: string, id: number, result: { transfers: AssetTransfersResult[] } }

  console.log({ fromBlock, toBlock })
  
  // const response = await alchemy.core.getAssetTransfers({
  //   fromBlock: toHex(fromBlock),
  //   toBlock: toBlock.toString(),
  //   contractAddresses: tokenAddresses,
  //   category: [AssetTransfersCategory.ERC20],
  // })

  console.log({ response, transfers: response.result.transfers })

  return response.result.transfers.reduce((acc, transferInfo) => {
    const contractAddress = getAddress(transferInfo.rawContract.address!)
    const to = getAddress(transferInfo.to!)
    const from = getAddress(transferInfo.from!)
    const amount = BigInt(transferInfo.rawContract.value ?? 0)
    const decimals = Number(BigInt(transferInfo.rawContract.decimal ?? 18))
    const blockNumber = BigInt(transferInfo.blockNum ?? 0)
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