import { votingPower } from "@/src/liquity-governance";
import { useEffect, useMemo, useState } from 'react';
import {
  buildVoteAllocations
} from './utils';

import type {
  GovernanceState,
  GovernanceUserState,
} from "@/src/liquity-governance";
import type { VoteAllocations } from '@/src/types';

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
    useState<VoteAllocations>({});

  const voteAllocations = useMemo(() => {
    if (!governanceStateData || !governanceUserData) return {};

    const { epochEnd } = governanceStateData;
    const {
      stakedLQTY,
      stakedOffset,
      allocations: userAllocations,
    } = governanceUserData;

    const stakedVotingPower = votingPower(stakedLQTY, stakedOffset, epochEnd);

    if (stakedVotingPower === 0n) return {};

    return buildVoteAllocations(userAllocations, epochEnd, stakedVotingPower);
  }, [governanceStateData, governanceUserData]);

  // fill input vote allocations from user data
  useEffect(() => {
    if (!voteAllocations) return;

    setInputVoteAllocations(voteAllocations);
  }, [voteAllocations]);

  return {
    inputVoteAllocations,
    setInputVoteAllocations,
    voteAllocations
  }
};
