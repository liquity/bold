import { getTokenHolders } from "./tokenholders"
import { CONTRACT_ADDRESSES } from "@/src/contracts"
import { Address, getAddress, isAddressEqual } from "viem"
import { getGoSlowNftHolders } from "./go-slow-nft"
import { getTrovesAndOwners } from "./troves"
import { getAllHistoricalStabilityPoolDepositors } from "./stability-pool"

const addresses = {
  shellPoints: getAddress(CONTRACT_ADDRESSES.ShellToken),
  yusnd: getAddress(CONTRACT_ADDRESSES.YUSND),
  camelot: getAddress(CONTRACT_ADDRESSES.strategies.Camelot), 
  bunni: getAddress(CONTRACT_ADDRESSES.strategies.Bunni),
  spectra: getAddress(CONTRACT_ADDRESSES.strategies.Spectra),
}

export async function getAllUsers() {
  console.log("Getting all users");
  const holders = await getHolders();
  console.log("Retrieved holders");
  const protocolUsers = await getProtocolUsers();
  console.log("Retrieved protocol users");

  return {
    ...holders,
    ...protocolUsers,
  }
}

export async function getHolders() {
  console.log("Getting holders");
  const holders = await getTokenHolders({
    tokenAddresses: Object.values(addresses),
  })
  console.log("Retrieved holders");
  const goSlowNftHolders = await getGoSlowNftHolders()
  console.log("Retrieved go slow nft holders");
  
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
  console.log("Getting protocol users");
  const troves = await getTrovesAndOwners();
  console.log("Retrieved troves");
  const stabilityPoolDepositors = await getAllHistoricalStabilityPoolDepositors();
  console.log("Retrieved stability pool depositors");
  
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