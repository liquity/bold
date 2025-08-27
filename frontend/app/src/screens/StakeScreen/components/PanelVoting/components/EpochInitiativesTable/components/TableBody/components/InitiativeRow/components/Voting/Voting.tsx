import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { css } from "@/styled-system/css";
import { VoteInput } from "@/src/comps/VoteInput/VoteInput";
import { Vote } from "./components/Vote";
import { useVotingStateContext } from "@/src/screens/StakeScreen/components/PanelVoting/providers/PanelVotingProvider/hooks";
import { useIsPeriodCutoff } from "@/src/screens/StakeScreen/components/PanelVoting/hooks";
import { div, from } from "dnum";

import type { Address, Dnum, Vote as VoteType } from "@/src/types";
import type { FC } from "react";

interface VotingProps {
  initiativeAddress: Address;
  disabled: boolean;
}

export const Voting: FC<VotingProps> = ({ initiativeAddress, disabled }) => {
  const { voteAllocations, inputVoteAllocations, setInputVoteAllocations } =
    useVotingStateContext();
  const isPeriodCutoff = useIsPeriodCutoff();

  const inputRef = useRef<HTMLInputElement>(null);
  const [editIntent, setEditIntent] = useState(false);

  const currentInputVoteAllocation = inputVoteAllocations[initiativeAddress];
  const currentVoteAllocation = voteAllocations[initiativeAddress];
  const editMode = (editIntent || !currentVoteAllocation?.vote) && !disabled;

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

  useEffect(() => {
    const isElementActive = inputRef.current && document.activeElement === inputRef.current;

    if(editIntent && !isElementActive) {
      inputRef.current?.focus();
    }
  }, [editIntent]);

  const renderVoteSection = useMemo(() => {
    if (editMode) {
      return (
        <VoteInput
          ref={inputRef}
          forDisabled={isPeriodCutoff}
          againstDisabled={disabled}
          onChange={onVoteInputChange}
          onVote={onVote}
          value={currentInputVoteAllocation?.value ?? null}
          vote={currentInputVoteAllocation?.vote ?? null}
        />
      );
    }

    if (currentVoteAllocation?.vote) {
      return (
        <Vote
          onEdit={onEdit}
          disabled={disabled}
          share={currentVoteAllocation.value}
          vote={currentVoteAllocation.vote}
        />
      );
    }

    return (
      <VoteInput
        ref={inputRef}
        forDisabled={true}
        againstDisabled={true}
        onChange={() => {}}
        onVote={() => {}}
        value={null}
        vote={null}
      />
    );
  }, [
    onEdit,
    editMode,
    isPeriodCutoff,
    disabled,
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
