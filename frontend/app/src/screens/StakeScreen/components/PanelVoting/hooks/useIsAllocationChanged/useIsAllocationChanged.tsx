import { useMemo } from "react";
import { useVotingStateContext } from "@/src/screens/StakeScreen/components/PanelVoting/providers/PanelVotingProvider/hooks";
import { filterVoteAllocationsForSubmission } from "@/src/screens/StakeScreen/components/PanelVoting/utils";
import { isAllocationsChanged } from "./utils";

export const useIsAllocationChanged = () => {
  const { initiativesStatesData, voteAllocations, inputVoteAllocations } =
    useVotingStateContext();

  return useMemo(() => {
    if (!initiativesStatesData) return false;

    const filteredCurrent = filterVoteAllocationsForSubmission(
      voteAllocations,
      initiativesStatesData,
    );

    const filteredInput = filterVoteAllocationsForSubmission(
      inputVoteAllocations,
      initiativesStatesData,
    );

    return isAllocationsChanged(filteredCurrent, filteredInput);
  }, [voteAllocations, initiativesStatesData, inputVoteAllocations]);
};
