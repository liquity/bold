import { dnumMax, dnumMin } from "@/src/dnum-utils";
import { parseInputFloat } from "@/src/form-utils";
import { css } from "@/styled-system/css";
import { toString, mul, from } from "dnum";
import { useCallback, useState } from "react";
import { VoteButton } from "./components/VoteButton";
import { DisplayValue } from "./components/DisplayValue";
import { VoteInput } from "./components/VoteInput";
import {
  useGetOutlineStyles
} from './hooks';

import type { Dnum } from "@/src/types";
import type { ChangeEvent } from "react";

interface VoteInputProps {
  hasError?: boolean;
  againstDisabled?: boolean;
  forDisabled?: boolean;
  onChange: (value: Dnum) => void;
  onVote: (vote: "for" | "against") => void;
  value: Dnum | null;
  vote: "for" | "against" | null;
}

export function VoteAction({
  againstDisabled,
  forDisabled,
  onChange: handleOnChange,
  onVote,
  value,
  vote,
  hasError = false
}: VoteInputProps) {
  console.log('VoteAction has', hasError)
  const [isFocused, setIsFocused] = useState(false);
  const outlineStyles = useGetOutlineStyles({isFocused, hasError, vote})

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
      })}
      style={outlineStyles}
    >
      <VoteButton
        disabled={forDisabled}
        onSelect={onUpVoteSelect}
        selected={vote === "for"}
        vote="for"
      />
      <VoteButton
        disabled={againstDisabled}
        onSelect={onDownVoteSelect}
        selected={vote === "against"}
        vote="against"
      />
      {vote ? (
        <VoteInput
          value={toString(mul(value || "", 100))}
          onChange={onChange}
          voteType={vote}
          disabled={!vote}
        />
      ) : (
        <DisplayValue value={toString(mul(value || 0, 100))} />
      )}
    </div>
  );
}
