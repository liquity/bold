import * as dn from "dnum";
import { useMemo } from "react";

import { DNUM_1 } from "@/src/dnum-utils";
import { useVotingStateContext } from "@/src/screens/StakeScreen/components/PanelVoting/providers/PanelVotingProvider/hooks";
import { filterVoteAllocationsForSubmission } from "@/src/screens/StakeScreen/components/PanelVoting/utils";

export const useRemainingVotingPower = () => {
  const { inputVoteAllocations, initiativesStatesData } = useVotingStateContext();

  return useMemo(() => {
    const filteredVoteAllocations = initiativesStatesData
      ? filterVoteAllocationsForSubmission(inputVoteAllocations, initiativesStatesData)
      : {};

    return Object.values(filteredVoteAllocations)
      .map(({ value }) => value)
      .reduce((a, b) => dn.sub(a, b), DNUM_1);
  }, [inputVoteAllocations, initiativesStatesData]);
};
