import { useGetVotingState, useGetInitiativesSummary } from "./hooks";

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

  return {
    governanceStateData,
    governanceUserData,
    initiativesStatesData,
    initiativesData,
    voteTotalsData,
    currentBribesData,
    initiativesAddresses,
    isLoading: isLoadingVotingState || isLoadingInitiativesSummary
  }
};
