import { votingPower } from "@/src/liquity-governance";
import { useEffect, useMemo, useState } from "react";
import { buildVoteAllocations } from "./utils";

import type {
  GovernanceState,
  GovernanceUserState,
} from "@/src/liquity-governance";
import type { VoteAllocations } from "@/src/types";

const EMPTY_ALLOCATIONS: VoteAllocations = {} as const;

export interface UseGetVoteAllocations {
  governanceStateData?: GovernanceState | null;
  governanceUserData?: GovernanceUserState | null;
}

export const useGetVoteAllocations = ({
  governanceStateData,
  governanceUserData,
}: UseGetVoteAllocations) => {
  // vote allocations from user input
  const [inputVoteAllocations, setInputVoteAllocations] =
    useState<VoteAllocations>(EMPTY_ALLOCATIONS);

  const epochEnd = governanceStateData?.epochEnd;
  const stakedLQTY = governanceUserData?.stakedLQTY;
  const stakedOffset = governanceUserData?.stakedOffset;
  const userAllocations = governanceUserData?.allocations;

  const voteAllocations = useMemo(() => {
    if (!epochEnd || !stakedLQTY || !stakedOffset || !userAllocations?.length) return EMPTY_ALLOCATIONS;

    const stakedVotingPower = votingPower(stakedLQTY, stakedOffset, epochEnd);

    if (stakedVotingPower === 0n) return EMPTY_ALLOCATIONS;

    return buildVoteAllocations(userAllocations, epochEnd, stakedVotingPower);
  }, [epochEnd, stakedLQTY, stakedOffset, userAllocations]);

  // fill input vote allocations from user data
  useEffect(() => {
    setInputVoteAllocations(voteAllocations ? voteAllocations : EMPTY_ALLOCATIONS)
  }, [voteAllocations]);

  return {
    inputVoteAllocations,
    setInputVoteAllocations,
    voteAllocations,
  };
};
