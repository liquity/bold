import { eq } from "dnum";
import { isInitiativeStatusActive } from "@/src/screens/StakeScreen/utils";

import type { Address, Entries, VoteAllocations } from "@/src/types";
import type { InitiativeState } from "@/src/liquity-governance";

export const filterVoteAllocationsForSubmission = (
  voteAllocations: VoteAllocations,
  initiativesStates: InitiativeState,
) => {
  const allocationEntries = Object.entries(
    voteAllocations,
  ) as Entries<VoteAllocations>;

  return allocationEntries.reduce((acc, [address, data]) => {
    const initiativeStatus =
      initiativesStates[address]?.status ?? "nonexistent";

    const isValidVote = data.vote !== null && !eq(data.value, 0);
    const isActive = isInitiativeStatusActive(initiativeStatus);

    if (isValidVote && isActive) {
      acc[address as Address] = data;
    }

    return acc;
  }, {} as VoteAllocations);
};
