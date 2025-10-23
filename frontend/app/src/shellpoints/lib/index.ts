// import { getTokenHolders } from "./tokenholders"
import { CONTRACT_ADDRESSES } from "@/src/contracts"
import { Address, getAddress, isAddressEqual } from "viem"
import { getGoSlowNftHolders } from "./go-slow-nft"
// import { getTrovesAndOwners } from "./troves"
// import { getAllHistoricalStabilityPoolDepositors } from "./stability-pool"
import { getAssetTransfers, getRecipientsFromAssetTransfers, getStabilityPoolDepositsFromAssetTransfers, getTokenHoldersViaAlchemyAPI } from "./tokenholders"
import { GRAPH_TOKEN_API_TOKEN } from "../utils/env"
import { NULL_ADDRESS } from "../utils/constants"
import { queryTroves } from "./troves"

const addresses = {
  usnd: getAddress(CONTRACT_ADDRESSES.BoldToken),
  shellPoints: getAddress(CONTRACT_ADDRESSES.ShellToken),
  yusnd: getAddress(CONTRACT_ADDRESSES.YUSND),
  balancer: getAddress(CONTRACT_ADDRESSES.strategies.Balancer),
  camelot: getAddress(CONTRACT_ADDRESSES.strategies.Camelot), 
  bunni: getAddress(CONTRACT_ADDRESSES.strategies.Bunni),
  spectra: getAddress(CONTRACT_ADDRESSES.strategies.Spectra),
}

export async function queryShellpointsAndActivity() {
  const shellTransfers = await getAssetTransfers({
    tokenAddresses: [addresses.shellPoints],
  })
  const shellRecipients = getRecipientsFromAssetTransfers(shellTransfers)[addresses.shellPoints] ?? []
  const deposits = await getAssetTransfers({
    tokenAddresses: [addresses.usnd],
    toAddresses: CONTRACT_ADDRESSES.collaterals.map(coll => coll.contracts.StabilityPool),
    fromAddresses: shellRecipients.map(recipient => recipient.to),
  })
  const depositors = getStabilityPoolDepositsFromAssetTransfers(deposits)

  const balances = await getTokenHoldersViaAlchemyAPI({
    tokenAddresses: [addresses.shellPoints],
  })

  const holders = await getTokenHoldersViaTokenAPI({
    token: [addresses.balancer, addresses.bunni, addresses.camelot, addresses.spectra, addresses.yusnd],
  })
  
  return {
    shellPoints: balances.filter(lp => isAddressEqual(lp.token, addresses.shellPoints) && isValidHolder(lp.holder, lp.balance)),
    activities: {
      yusnd: holders.filter((lp: Holder) => isAddressEqual(lp.token, addresses.yusnd) && isValidHolder(lp.address, lp.amount)),
      balancer: holders.filter((lp: Holder) => isAddressEqual(lp.token, addresses.balancer) && isValidHolder(lp.address, lp.amount)),
      bunni: holders.filter((lp: Holder) => isAddressEqual(lp.token, addresses.bunni) && isValidHolder(lp.address, lp.amount)),
      camelot: holders.filter((lp: Holder) => isAddressEqual(lp.token, addresses.camelot) && isValidHolder(lp.address, lp.amount)),
      spectra: holders.filter((lp: Holder) => isAddressEqual(lp.token, addresses.spectra) && isValidHolder(lp.address, lp.amount)),
      goSlowNft: await getGoSlowNftHolders(),
      troves: await queryTroves(),
      stabilityPoolDeposits: depositors,
    }
  }
}

export async function getAllUsers() {
  const holders = await getHolders();
  const protocolUsers = await getProtocolUsers();

  return {
    ...holders,
    ...protocolUsers,
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
  const shellPointsHolders = await getTokenHoldersViaAlchemyAPI({
    tokenAddresses: [addresses.shellPoints],
  })
  if (shellPointsHolders.length === 0) {
    return {
      shellPoints: [],
      yusnd: [],
      balancer: [],
      bunni: [],
      camelot: [],
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
    yusnd: holders.filter((lp: Holder) => isAddressEqual(lp.token, addresses.yusnd) && isNotPool({ address: lp.address, amount: lp.amount })),
    balancer: holders.filter((lp: Holder) => isAddressEqual(lp.token, addresses.balancer) && isNotPool({ address: lp.address, amount: lp.amount })),
    bunni: holders.filter((lp: Holder) => isAddressEqual(lp.token, addresses.bunni) && isNotPool({ address: lp.address, amount: lp.amount })),
    camelot: holders.filter((lp: Holder) => isAddressEqual(lp.token, addresses.camelot) && isNotPool({ address: lp.address, amount: lp.amount })),
    spectra: holders.filter((lp: Holder) => isAddressEqual(lp.token, addresses.spectra) && isNotPool({ address: lp.address, amount: lp.amount })),
    goSlowNft: goSlowNftHolders,
  }
}

export async function getProtocolUsers() {
  const troves = await queryTroves();
  console.log("Retrieved troves:", troves.length);
  // console.log("Getting protocol users");
  // const troves = await getTrovesAndOwners();
  // console.log("Retrieved troves");
  // const stabilityPoolDepositors = await getAllHistoricalStabilityPoolDepositors();
  // console.log("Retrieved stability pool depositors");
  
  return {
    troves,
    // stabilityPoolDepositors,
  }
}

function isValidHolder(address: Address, amount?: bigint | string | number) {
  return !isAddressEqual(address, NULL_ADDRESS)
    && !isAddressEqual(address, addresses.balancer)
    && !isAddressEqual(address, addresses.bunni)
    && !isAddressEqual(address, addresses.camelot) 
    && !isAddressEqual(address, addresses.spectra)
    && !isAddressEqual(address, addresses.yusnd)
    && CONTRACT_ADDRESSES.collaterals.findIndex(coll => isAddressEqual(coll.contracts.StabilityPool, address)) === -1
    && (amount ? BigInt(amount) > 0 : true)
}

function isNotPool(holder: { address: Address; amount?: bigint | string | number }) {
  return (holder.amount ? BigInt(holder.amount) : 0n) > 0n 
    && !isAddressEqual(holder.address, addresses.balancer)
    && !isAddressEqual(holder.address, addresses.bunni)
    && !isAddressEqual(holder.address, addresses.camelot) 
    && !isAddressEqual(holder.address, addresses.spectra)
    && !isAddressEqual(holder.address, addresses.yusnd)
}