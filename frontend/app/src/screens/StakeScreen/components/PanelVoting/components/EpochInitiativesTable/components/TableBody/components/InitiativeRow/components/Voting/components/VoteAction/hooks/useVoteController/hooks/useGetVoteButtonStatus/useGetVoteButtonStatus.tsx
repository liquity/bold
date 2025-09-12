import { useIsPeriodCutoff } from "@/src/screens/StakeScreen/components/PanelVoting/hooks";
import { useGetAllocationsByAddress } from "@/src/screens/StakeScreen/components/PanelVoting/components/EpochInitiativesTable/components/TableBody/components/InitiativeRow/components/Voting/hooks";

import type { VotingProps as UseGetVoteButtonStatusArgs } from "@/src/screens/StakeScreen/components/PanelVoting/components/EpochInitiativesTable/components/TableBody/components/InitiativeRow/components/Voting/types";

export const useGetVoteButtonStatus = ({
  initiativeAddress,
  activeVoting,
}: UseGetVoteButtonStatusArgs) => {
  const isPeriodCutoff = useIsPeriodCutoff();
  const { currentVoteAllocation, currentInputVoteAllocation } =
    useGetAllocationsByAddress(initiativeAddress);

  const voteButtonState = {
    isSelectedUpVoting: currentInputVoteAllocation?.vote === "for",
    isSelectedDownVoting: currentInputVoteAllocation?.vote === "against",
    upVoteButtonDisabled: !activeVoting,
    downVoteButtonDisabled: !activeVoting,
  };
  const isCurrentDownVoteSelected = currentVoteAllocation?.vote === "against";
  const hasVote = !!currentVoteAllocation?.vote;

  if (!currentVoteAllocation && !currentInputVoteAllocation) {
    return {
      ...voteButtonState,
      upVoteButtonDisabled: isPeriodCutoff,
    };
  }

  if (isPeriodCutoff && (isCurrentDownVoteSelected || !hasVote)) {
    voteButtonState.upVoteButtonDisabled = true;
  }

  return voteButtonState;
};
