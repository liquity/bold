import { Alchemy, Network } from "alchemy-sdk"
import { ALCHEMY_API_KEY } from "@/src/shellpoints/utils/env"
import { CONTRACT_ADDRESSES } from "@/src/contracts"
import { getAddress, parseAbi, type Address } from "viem"
import { getPublicClient } from "../utils/client"

export async function getGoSlowNftHolders() {
  const alchemy = new Alchemy({
    apiKey: ALCHEMY_API_KEY,
    network: Network.ARB_MAINNET,
  })

  const response = await alchemy.nft.getOwnersForNft(CONTRACT_ADDRESSES.GoSlowNft, 1)
  return await getGoSlowNftBalanceOf(response.owners as Address[]) as { holder: `0x${string}`; balance: bigint; }[]
}

export async function getGoSlowNftCount() {
  const client = getPublicClient()
  return await client.readContract({
    address: getAddress(CONTRACT_ADDRESSES.GoSlowNft),
    abi: parseAbi([
      'function numMinted() external view returns (uint256)'
    ]),
    functionName: 'numMinted'
  })
}

export async function getGoSlowNftBalanceOf(address: Address | Address[]) {
  const client = getPublicClient()
  const contract = {
    address: getAddress(CONTRACT_ADDRESSES.GoSlowNft),
    abi: parseAbi([
      'function balanceOf(address owner, uint256 id) external view returns (uint256)'
    ]),
  }
  if (!Array.isArray(address)) {
    return await client.readContract({
      address: getAddress(CONTRACT_ADDRESSES.GoSlowNft),
      abi: parseAbi([
        'function balanceOf(address owner, uint256 id) external view returns (uint256)'
      ]),
      functionName: 'balanceOf',
      args: [address, 1n]
    })
  } else {
    return (await client.multicall({
      contracts: address.map(addr => ({
        ...contract,
        functionName: 'balanceOf',
        args: [addr, 1n]
      })),
      allowFailure: false
    })).map((result: any, i: number) => ({
      holder: address[i],
      balance: result
    }))
  }
}