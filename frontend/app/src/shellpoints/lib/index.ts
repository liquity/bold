// import { getTokenHolders } from "./tokenholders"
import { CONTRACT_ADDRESSES } from "@/src/contracts"
import { Address, getAddress, isAddressEqual } from "viem"
import { getGoSlowNftHolders } from "./go-slow-nft"
// import { getTrovesAndOwners } from "./troves"
// import { getAllHistoricalStabilityPoolDepositors } from "./stability-pool"
import { getTokenHolders } from "./tokenholders"
import { GRAPH_TOKEN_API_TOKEN } from "../utils/env"

const addresses = {
  shellPoints: getAddress(CONTRACT_ADDRESSES.ShellToken),
  yusnd: getAddress(CONTRACT_ADDRESSES.YUSND),
  camelot: getAddress(CONTRACT_ADDRESSES.strategies.Camelot), 
  bunni: getAddress(CONTRACT_ADDRESSES.strategies.Bunni),
  spectra: getAddress(CONTRACT_ADDRESSES.strategies.Spectra),
}

export async function getAllUsers() {
  const holders = await getHolders();
  // const protocolUsers = await getProtocolUsers();

  return {
    ...holders,
    // ...protocolUsers,
  }
}

type TokenHolder = {
  block_num: number
  last_balance_update: string
  address: Address
  amount: string
  value: number
  name: string
  decimals: number
  symbol: string
  network_id: string
}

type Holder = TokenHolder & {
  token: Address
}

export async function getTokenHoldersViaTokenAPI(params: {
  token: Address | Address[]
}) {
  const options = {
    method: 'GET', 
    headers: {Authorization: `Bearer ${GRAPH_TOKEN_API_TOKEN}`}
  };

  if (Array.isArray(params.token)) {
    const responses = await Promise.all(params.token.map(async (token) => {
      const response = await fetch(`https://token-api.thegraph.com/holders/evm/${token}?network_id=arbitrum-one&orderBy=value&orderDirection=desc&limit=1000`, options)
      const data = await response.json()
      return data.data as TokenHolder[]
    }))
    return responses.map((response, index) => response.map(holder => ({
      token: params.token[index],
      ...holder
    }))).flat() as Holder[]
  }
  const response = await fetch(`https://token-api.thegraph.com/holders/evm/${params.token}?network_id=arbitrum-one&orderBy=value&orderDirection=desc&limit=1000`, options)
  const data = (await response.json()).data as TokenHolder[]
  return data.map((holder: TokenHolder) => ({
    token: params.token,
    ...holder
  })) as Holder[]
}

export async function getHolders() {
  const shellPointsHolders = await getTokenHolders({
    tokenAddresses: [addresses.shellPoints],
  })
  if (shellPointsHolders.length === 0) {
    return {
      shellPoints: [],
      yusnd: [],
      camelot: [],
      bunni: [],
      spectra: [],
      goSlowNft: [],
    }
  }
  const holders = await getTokenHoldersViaTokenAPI({
    token: Object.values(addresses).filter(address => address !== addresses.shellPoints),
  })
  const goSlowNftHolders = await getGoSlowNftHolders()
  
  return {
    // shellPoints: holders.filter((lp: Holder) => isAddressEqual(lp.token, addresses.shellPoints) && isNotPool(lp)),
    shellPoints: shellPointsHolders.filter(lp => isNotPool({ address: lp.holder, amount: lp.balance })),
    yusnd: holders.filter((lp: Holder) => isAddressEqual(lp.token, addresses.yusnd) && isNotPool(lp)),
    camelot: holders.filter((lp: Holder) => isAddressEqual(lp.token, addresses.camelot) && isNotPool(lp)),
    bunni: holders.filter((lp: Holder) => isAddressEqual(lp.token, addresses.bunni) && isNotPool(lp)),
    spectra: holders.filter((lp: Holder) => isAddressEqual(lp.token, addresses.spectra) && isNotPool(lp)),
    goSlowNft: goSlowNftHolders,
  }
}

// export async function getProtocolUsers() {
//   console.log("Getting protocol users");
//   const troves = await getTrovesAndOwners();
//   console.log("Retrieved troves");
//   const stabilityPoolDepositors = await getAllHistoricalStabilityPoolDepositors();
//   console.log("Retrieved stability pool depositors");
  
//   return {
//     troves,
//     stabilityPoolDepositors,
//   }
// }

function isNotPool(holder: { address: Address; amount: string }) {
  return Number(holder.amount) > 0 
    && !isAddressEqual(holder.address, addresses.camelot) 
    && !isAddressEqual(holder.address, addresses.spectra)
    && !isAddressEqual(holder.address, addresses.bunni)
    && !isAddressEqual(holder.address, addresses.yusnd)
}