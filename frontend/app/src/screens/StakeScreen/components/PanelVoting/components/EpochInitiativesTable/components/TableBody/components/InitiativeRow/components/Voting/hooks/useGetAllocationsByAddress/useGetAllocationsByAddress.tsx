import { useVotingStateContext } from "@/src/screens/StakeScreen/components/PanelVoting/providers/PanelVotingProvider/hooks";
import { useMemo } from "react";

import type { Address } from "@/src/types";

export const useGetAllocationsByAddress = (initiativeAddress: Address) => {
  const { voteAllocations, inputVoteAllocations } = useVotingStateContext();

  return useMemo(
    () => ({
      currentInputVoteAllocation: inputVoteAllocations[initiativeAddress],
      currentVoteAllocation: voteAllocations[initiativeAddress],
    }),
    [initiativeAddress, inputVoteAllocations, voteAllocations],
  );
};
