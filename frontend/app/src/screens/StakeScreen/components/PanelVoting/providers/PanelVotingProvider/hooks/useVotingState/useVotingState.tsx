import {
  useGetVotingState,
  useGetInitiativesSummary,
  useGetVoteAllocations,
} from "./hooks";
import { useState } from 'react';

import type { Address } from "@liquity2/uikit";

export const useVotingState = () => {
  const [votingInputError, setVotingInputError] = useState<Record<Address, string> | null>(null);

  const {
    governanceStateData,
    governanceUserData,
    isLoading: isLoadingVotingState,
  } = useGetVotingState();
  const {
    initiativesAddresses,
    initiativesStatesData,
    initiativesData,
    voteTotalsData,
    currentBribesData,
    isLoading: isLoadingInitiativesSummary,
  } = useGetInitiativesSummary();
  const { voteAllocations, inputVoteAllocations, setInputVoteAllocations } =
    useGetVoteAllocations({ governanceStateData, governanceUserData });

  return {
    votingInputError,
    setVotingInputError,
    voteAllocations,
    inputVoteAllocations,
    setInputVoteAllocations,
    governanceStateData,
    governanceUserData,
    initiativesStatesData,
    initiativesData,
    voteTotalsData,
    currentBribesData,
    initiativesAddresses,
    isLoading: isLoadingVotingState || isLoadingInitiativesSummary,
  };
};
