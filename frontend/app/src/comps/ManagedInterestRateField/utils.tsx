import type { BatchManager } from "@/src/summerstone-graphql/graphql";
import type { CollIndex, Delegate } from "@/src/types";
import { isAddress } from "@liquity2/uikit";
import * as dn from "dnum";
import { SUMMERSTONE_MANAGER, RecommendedDelegate } from "./types";

// Helper function to format duration from seconds into human readable string
export function formatDuration(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / (24 * 3600));
  const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);

  return parts.join(' ');
}

// Helper function to map and sort delegates
export function mapAndSortDelegates(batchData: Delegate[], batchManagers: BatchManager[], branchId: CollIndex) {
  const delegateDataByAddress = new Map(
    batchData.map(delegate => [delegate.address.toLowerCase(), delegate])
  );

  return batchManagers
    .filter(status => 
      !status.metadata.supersededBy && 
      isAddress(status.batchManagerId) &&
      status.collateralBranchId === branchId.toString()
    )
    .map((status) => {
      const delegate = delegateDataByAddress.get(status.batchManagerId.toLowerCase());
      if (!delegate) return null;

      return {
        manager: SUMMERSTONE_MANAGER,
        delegate,
        status,
      };
    })
    .filter((x): x is RecommendedDelegate => x !== null)
    .sort((a, b) => dn.toNumber(dn.sub(b.delegate.interestRate, a.delegate.interestRate)));
}
