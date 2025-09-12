import { useCallback, useMemo, useState } from "react";
import { css } from "@/styled-system/css";
import { VoteAction } from "./components/VoteAction/";
import { Vote } from "./components/Vote";
import { useVotingStateContext } from "@/src/screens/StakeScreen/components/PanelVoting/providers/PanelVotingProvider/hooks";
import { useValidateVoteInput } from "@/src/screens/StakeScreen/components/PanelVoting/hooks";
import { div, from } from "dnum";
import {
  useGetAllocationsByAddress
} from './hooks';

import type { Dnum, Vote as VoteType } from "@/src/types";
import type { FC } from "react";
import type {
  VotingProps
} from './types';

export const Voting: FC<VotingProps> = ({
  initiativeAddress,
  activeVoting,
}) => {
  const [editIntent, setEditIntent] = useState(false);

  const {
    setInputVoteAllocations,
  } = useVotingStateContext();
  const { currentVoteAllocation } =
    useGetAllocationsByAddress(initiativeAddress);
  useValidateVoteInput(initiativeAddress);

  const editMode = (editIntent || !currentVoteAllocation?.vote) && activeVoting;

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
    if (editMode) {
      return (
        <VoteAction
          initiativeAddress={initiativeAddress}
          activeVoting={activeVoting}
          onChange={onVoteInputChange}
          onVote={onVote}
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
        initiativeAddress={initiativeAddress}
        activeVoting={activeVoting}
        onChange={() => {}}
        onVote={() => {}}
      />
    );
  }, [
    onVote,
    onEdit,
    editMode,
    activeVoting,
    onVoteInputChange,
    initiativeAddress,
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
