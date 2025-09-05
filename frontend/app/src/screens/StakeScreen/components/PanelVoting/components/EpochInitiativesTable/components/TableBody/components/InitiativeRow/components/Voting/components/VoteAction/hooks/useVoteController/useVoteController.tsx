import { useGetAllocationsByAddress } from "@/src/screens/StakeScreen/components/PanelVoting/components/EpochInitiativesTable/components/TableBody/components/InitiativeRow/components/Voting/hooks";
import { useMemo } from "react";
import { from } from "dnum";
import { useGetVoteButtonStatus } from "./hooks";

import type { VotingProps as UseVoteControllerArgs } from "@/src/screens/StakeScreen/components/PanelVoting/components/EpochInitiativesTable/components/TableBody/components/InitiativeRow/components/Voting/types";

export const useVoteController = ({
  initiativeAddress,
  activeVoting,
}: UseVoteControllerArgs) => {
  const { currentVoteAllocation, currentInputVoteAllocation } =
    useGetAllocationsByAddress(initiativeAddress);
  const voteButtonsState = useGetVoteButtonStatus({
    activeVoting,
    initiativeAddress
  });
  const vote = currentInputVoteAllocation?.vote ?? null;

  const currentValue = useMemo(() => {
    if (currentInputVoteAllocation?.vote !== currentVoteAllocation?.vote) {
      return from(0);
    }

    return currentInputVoteAllocation?.value ?? from(0);
  }, [
    currentInputVoteAllocation?.value,
    currentInputVoteAllocation?.vote,
    currentVoteAllocation?.vote,
  ]);

  return {
    ...voteButtonsState,
    vote,
    currentValue,
  };
};
