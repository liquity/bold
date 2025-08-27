import { getTokenHolders } from "./tokenholders"
import { CONTRACT_ADDRESSES } from "@/src/contracts"
import { Address, getAddress, isAddressEqual } from "viem"
import { getGoSlowNftHolders } from "./go-slow-nft"
import { getTrovesAndOwners } from "./troves"
import { getAllHistoricalStabilityPoolDepositors } from "./stability-pool"

const SHELLPOINTS_ADDRESS: Address = "0x0000000000000000000000000000000000000000"

const addresses = {
  shellPoints: SHELLPOINTS_ADDRESS,
  yusnd: getAddress(CONTRACT_ADDRESSES.YUSND),
  camelot: getAddress(CONTRACT_ADDRESSES.strategies.Camelot), 
  bunni: getAddress(CONTRACT_ADDRESSES.strategies.Bunni),
  spectra: getAddress(CONTRACT_ADDRESSES.strategies.Spectra),
}

export async function getAllUsers() {
  const holders = await getHolders();
  const protocolUsers = await getProtocolUsers();

  return {
    ...holders,
    ...protocolUsers,
  }
}

export async function getHolders() {
  const holders = await getTokenHolders({
    tokenAddresses: Object.values(addresses),
  })
  
  const goSlowNftHolders = await getGoSlowNftHolders()
  
  return {
    shellPoints: holders.filter(lp => isAddressEqual(lp.token, addresses.shellPoints) && isNotPool(lp)),
    yusnd: holders.filter(lp => isAddressEqual(lp.token, addresses.yusnd) && isNotPool(lp)),
    camelot: holders.filter(lp => isAddressEqual(lp.token, addresses.camelot) && isNotPool(lp)),
    bunni: holders.filter(lp => isAddressEqual(lp.token, addresses.bunni) && isNotPool(lp)),
    spectra: holders.filter(lp => isAddressEqual(lp.token, addresses.spectra) && isNotPool(lp)),
    goSlowNft: goSlowNftHolders,
  }
}

export async function getProtocolUsers() {
  const troves = await getTrovesAndOwners();
  const stabilityPoolDepositors = await getAllHistoricalStabilityPoolDepositors();
  
  return {
    troves,
    stabilityPoolDepositors,
  }
}

function isNotPool(holder: { token: Address; holder: Address; balance: bigint }) {
  return holder.balance > 0n 
    && !isAddressEqual(holder.holder, addresses.camelot) 
    && !isAddressEqual(holder.holder, addresses.spectra)
    && !isAddressEqual(holder.holder, addresses.bunni)
    && !isAddressEqual(holder.holder, addresses.yusnd)
}