import {
  useGetVotingState,
  useGetInitiativesSummary,
  useGetVoteAllocations,
} from "./hooks";

export const useVotingState = () => {
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
