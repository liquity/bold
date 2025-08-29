import { useCallback, useMemo, useState } from 'react';
import { css } from "@/styled-system/css";
import { VoteAction } from "./components/VoteAction/";
import { Vote } from "./components/Vote";
import { useVotingStateContext } from "@/src/screens/StakeScreen/components/PanelVoting/providers/PanelVotingProvider/hooks";
import { useIsPeriodCutoff } from "@/src/screens/StakeScreen/components/PanelVoting/hooks";
import { div, from } from 'dnum';
import { useValidateVoteInput } from '@/src/screens/StakeScreen/components/PanelVoting/hooks/useValidateVoteInput';

import type { Address, Dnum, Vote as VoteType } from "@/src/types";
import type { FC } from "react";

interface VotingProps {
  initiativeAddress: Address;
  activeVoting: boolean;
}

export const Voting: FC<VotingProps> = ({ initiativeAddress, activeVoting }) => {
  const { voteAllocations, inputVoteAllocations, setInputVoteAllocations, votingInputError } =
    useVotingStateContext();
  //TODO: move to Voting action
  const isPeriodCutoff = useIsPeriodCutoff();
  useValidateVoteInput(initiativeAddress)

  const [editIntent, setEditIntent] = useState(false);

  const currentInputVoteAllocation = inputVoteAllocations[initiativeAddress];
  const currentVoteAllocation = voteAllocations[initiativeAddress];
  const hasError = votingInputError?.[initiativeAddress]
  const editMode = (editIntent || !currentVoteAllocation?.vote) && activeVoting;
  const isAgainstDisabled = !activeVoting || (isPeriodCutoff && currentInputVoteAllocation?.vote === 'for')

  const onVoteInputChange = useCallback(
    (value: Dnum) => {
      setInputVoteAllocations((prev) => ({
        ...prev,
        [initiativeAddress]: {
          vote: prev[initiativeAddress]?.vote ?? null,
          value: div(value, 100),
        },
      }));
    },
    [setInputVoteAllocations, initiativeAddress],
  );

  const onVote = useCallback(
    (vote: VoteType) => {
      setInputVoteAllocations((prev) => ({
        ...prev,
        [initiativeAddress]: {
          vote: prev[initiativeAddress]?.vote === vote ? null : vote,
          value: from(0),
        },
      }));
    },
    [setInputVoteAllocations, initiativeAddress],
  );

  const onEdit = useCallback(() => {
    setEditIntent(true);
  }, []);

  const renderVoteSection = useMemo(() => {
    // TODO: find approach how to use one VoteAction maybe merge VoteAction with Vote?
    if (editMode) {
      return (
        <VoteAction
          forDisabled={isPeriodCutoff}
          againstDisabled={isAgainstDisabled}
          onChange={onVoteInputChange}
          onVote={onVote}
          value={currentInputVoteAllocation?.value ?? null}
          vote={currentInputVoteAllocation?.vote ?? null}
          hasError={!!hasError}
        />
      );
    }

    if (currentVoteAllocation?.vote) {
      return (
        <Vote
          onEdit={onEdit}
          disabled={!activeVoting}
          share={currentVoteAllocation.value}
          vote={currentVoteAllocation.vote}
        />
      );
    }

    return (
      <VoteAction
        forDisabled={true}
        againstDisabled={true}
        onChange={() => {}}
        onVote={() => {}}
        value={null}
        vote={null}
      />
    );
  }, [
    hasError,
    onEdit,
    editMode,
    isPeriodCutoff,
    activeVoting,
    isAgainstDisabled,
    onVoteInputChange,
    onVote,
    currentInputVoteAllocation?.value,
    currentInputVoteAllocation?.vote,
    currentVoteAllocation?.vote,
    currentVoteAllocation?.value,
  ]);

  return (
    <div
      className={css({
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        height: "100%",
        paddingTop: 6,
      })}
    >
      {renderVoteSection}
    </div>
  );
};
