import { createPublicClient, http, type Block } from "viem";
import { CHAIN } from "./constants";
import { CHAIN_RPC_URL } from "./env";
import { mainnet } from "viem/chains";

export function getPublicClient() {
  return createPublicClient({
    chain: CHAIN,
    transport: http(CHAIN_RPC_URL),
  })
}

export function getMainnetPublicClient() {
  return createPublicClient({
    chain: mainnet,
    transport: http("https://ethereum-rpc.publicnode.com"),
  })
}

/**
 * Gets the block number closest to a given timestamp using binary search
 * @param timestamp Unix timestamp in seconds
 * @param tolerance Maximum acceptable time difference in seconds (default: 30)
 * @returns Block number closest to the timestamp
 */
export async function getBlockNumberByTimestamp(
  timestamp: number,
  tolerance: number = 30
): Promise<bigint> {
  const client = getPublicClient();
  
  // Get the latest block as our upper bound
  const latestBlock = await client.getBlock({ blockTag: 'latest' });
  let high = latestBlock.number;
  let low = 1n;
  
  // If timestamp is newer than latest block, return latest block
  if (timestamp >= Number(latestBlock.timestamp)) {
    return latestBlock.number;
  }
  
  // Binary search for the closest block
  while (high - low > 1n) {
    const mid = (high + low) / 2n;
    
    try {
      const block = await client.getBlock({ blockNumber: mid });
      const blockTimestamp = Number(block.timestamp);
      
      if (Math.abs(blockTimestamp - timestamp) <= tolerance) {
        return block.number;
      }
      
      if (blockTimestamp > timestamp) {
        high = mid;
      } else {
        low = mid;
      }
    } catch (error) {
      // If block doesn't exist, adjust search bounds
      high = mid - 1n;
    }
  }
  
  // Check which of the final two blocks is closer
  try {
    const [lowBlock, highBlock] = await Promise.all([
      client.getBlock({ blockNumber: low }),
      client.getBlock({ blockNumber: high })
    ]);
    
    const lowDiff = Math.abs(Number(lowBlock.timestamp) - timestamp);
    const highDiff = Math.abs(Number(highBlock.timestamp) - timestamp);
    
    return lowDiff <= highDiff ? low : high;
  } catch (error) {
    // Fallback to low if high block doesn't exist
    return low;
  }
}

/**
 * Gets block information for a given timestamp
 * @param timestamp Unix timestamp in seconds
 * @param tolerance Maximum acceptable time difference in seconds (default: 30)
 * @returns Block object closest to the timestamp
 */
export async function getBlockByTimestamp(
  timestamp: number,
  tolerance: number = 30
): Promise<Block> {
  const client = getPublicClient();
  const blockNumber = await getBlockNumberByTimestamp(timestamp, tolerance);
  return client.getBlock({ blockNumber });
}