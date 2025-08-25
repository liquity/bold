import { useMemo } from "react";
import {
  useCurrentEpochBribes,
  useInitiativesStates,
  useInitiativesVoteTotals,
  useNamedInitiatives,
} from "@/src/liquity-governance.ts";

export const useGetInitiativesSummary = () => {
  const { data: initiativesData, isLoading: isLoadingInitiatives } =
    useNamedInitiatives();

  const initiativesAddresses = useMemo(() => {
    if (isLoadingInitiatives || !initiativesData) {
      return [];
    }

    return initiativesData.map((i) => i.address) ?? [];
  }, [initiativesData, isLoadingInitiatives]);

  const { data: initiativesStatesData, isLoading: isLoadingInitiativesStates } =
    useInitiativesStates(initiativesAddresses);
  const { data: currentBribesData, isLoading: isLoadingCurrentBribes } =
    useCurrentEpochBribes(initiativesAddresses);
  const { data: voteTotalsData, isLoading: isLoadingVoteTotals } =
    useInitiativesVoteTotals(initiativesAddresses);

  return {
    initiativesAddresses,
    initiativesData,
    initiativesStatesData,
    currentBribesData,
    voteTotalsData,
    isLoading: isLoadingInitiativesStates || isLoadingCurrentBribes || isLoadingVoteTotals,
  }
};
