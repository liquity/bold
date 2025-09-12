import { dnumMax, dnumMin } from "@/src/dnum-utils";
import { parseInputFloat } from "@/src/form-utils";
import { css } from "@/styled-system/css";
import { from, mul, toString } from "dnum";
import { useCallback, useState } from "react";
import { VoteButton } from "./components/VoteButton";
import { VoteDisplay } from "./components/VoteDisplay";
import { VoteInput } from "./components/VoteInput";
import { useGetOutlineStyles, useHasInputError, useVoteController } from "./hooks";

import type { VotingProps } from "@/src/screens/StakeScreen/components/PanelVoting/components/EpochInitiativesTable/components/TableBody/components/InitiativeRow/components/Voting/types";
import type { Dnum, Vote } from "@/src/types";
import type { ChangeEvent } from "react";

interface VoteActionProps extends VotingProps {
  onChange: (value: Dnum) => void;
  onVote: (vote: Vote) => void;
}

export function VoteAction({
  initiativeAddress,
  activeVoting,
  onChange: handleOnChange,
  onVote,
}: VoteActionProps) {
  const [isFocused, setIsFocused] = useState(false);
  const {
    isSelectedUpVoting,
    isSelectedDownVoting,
    upVoteButtonDisabled,
    downVoteButtonDisabled,
    vote,
    currentValue,
  } = useVoteController({ initiativeAddress, activeVoting });
  const hasError = useHasInputError(initiativeAddress);
  const outlineStyles = useGetOutlineStyles({
    isFocused,
    hasError,
    vote,
  });

  const value = toString(mul(currentValue, 100));

  const onUpVoteSelect = useCallback(() => {
    onVote("for");
  }, [onVote]);

  const onDownVoteSelect = useCallback(() => {
    onVote("against");
  }, [onVote]);

  const onChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const parsed = parseInputFloat(e.target.value);

      if (!parsed) return;

      const val = dnumMax(dnumMin(from(100, 18), parsed), from(0, 18));

      handleOnChange(val);
    },
    [handleOnChange],
  );

  return (
    <div
      onFocus={() => {
        setIsFocused(true);
      }}
      onBlur={() => {
        setIsFocused(false);
      }}
      className={css({
        display: "flex",
        alignItems: "center",
        width: "fit-content",
        height: 34,
        padding: "0 0 0 8px",
        background: "fieldSurface",
        border: "1px solid token(colors.fieldBorder)",
        borderRadius: 8,
        outline: "2px solid transparent",
        outlineOffset: -1,
        "--outline-focused": "token(colors.fieldBorderFocused)",
        "--outline-error": "token(colors.red:500)",
      })}
      style={outlineStyles}
    >
      <VoteButton
        disabled={upVoteButtonDisabled}
        onSelect={onUpVoteSelect}
        selected={isSelectedUpVoting}
        vote="for"
      />
      <VoteButton
        disabled={downVoteButtonDisabled}
        onSelect={onDownVoteSelect}
        selected={isSelectedDownVoting}
        vote="against"
      />
      {vote
        ? (
          <VoteInput
            value={value}
            onChange={onChange}
            vote={vote}
            disabled={!vote}
          />
        )
        : <VoteDisplay value={value} />}
    </div>
  );
}
