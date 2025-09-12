import * as dn from "dnum";
import { type FC, useMemo } from "react";

import { FlowButton } from "@/src/comps/FlowButton/FlowButton";
import { useHasAllocations, useIsAllocationChanged } from "@/src/screens/StakeScreen/components/PanelVoting/hooks";
import { useRemainingVotingPower } from "@/src/screens/StakeScreen/components/PanelVoting/hooks";
import { useVotingStateContext } from "@/src/screens/StakeScreen/components/PanelVoting/providers/PanelVotingProvider/hooks";
import { filterVoteAllocationsForSubmission } from "@/src/screens/StakeScreen/components/PanelVoting/utils";
import type { Dnum } from "@/src/types";

export const CastVotes: FC = () => {
  const {
    governanceUserData,
    inputVoteAllocations,
    initiativesStatesData,
    votingInputError,
  } = useVotingStateContext();
  const isAllocationChanged = useIsAllocationChanged();
  const hasAnyAllocations = useHasAllocations();
  const remainingVotingPower = useRemainingVotingPower();

  const stakedLQTY: Dnum = useMemo(
    () => [governanceUserData?.stakedLQTY ?? 0n, 18],
    [governanceUserData?.stakedLQTY],
  );

  const allowSubmit = useMemo(() => {
    if (!isAllocationChanged) return false;

    const hasVotingPower = dn.gt(stakedLQTY, 0);
    const fullyAllocated = dn.eq(remainingVotingPower, 0) && hasAnyAllocations;
    const nothingAllocated = dn.eq(remainingVotingPower, 1);

    return (
      isAllocationChanged
      && hasVotingPower
      && (fullyAllocated || nothingAllocated)
    );
  }, [
    stakedLQTY,
    isAllocationChanged,
    hasAnyAllocations,
    remainingVotingPower,
  ]);

  const filteredVoteAllocation = useMemo(() => {
    if (!initiativesStatesData) return {};

    return filterVoteAllocationsForSubmission(
      inputVoteAllocations,
      initiativesStatesData,
    );
  }, [initiativesStatesData, inputVoteAllocations]);

  const footnote = useMemo(() => {
    if (!allowSubmit) {
      if (!stakedLQTY) {
        return "You have no voting power to allocate. Please stake LQTY before voting.";
      }

      if (hasAnyAllocations) {
        return "You can reset your votes by allocating 0% to all initiatives.";
      }
    }

    if (allowSubmit && dn.eq(remainingVotingPower, 1)) {
      return "Your votes will be reset to 0% for all initiatives.";
    }

    return null;
  }, [allowSubmit, stakedLQTY, hasAnyAllocations, remainingVotingPower]);

  return (
    <FlowButton
      disabled={!allowSubmit || votingInputError.size > 0}
      footnote={footnote}
      label="Cast votes"
      request={{
        flowId: "allocateVotingPower",
        backLink: ["/stake/voting", "Back"],
        successLink: ["/stake/voting", "Back to overview"],
        successMessage: "Your voting power has been allocated.",
        voteAllocations: filteredVoteAllocation,
      }}
    />
  );
};
