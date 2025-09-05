import { useEffect, useRef } from "react";

import type { Vote } from "@/src/types";
import type { Dispatch, SetStateAction } from "react";

interface UseSetInputFocusArgs {
  setInputValue: Dispatch<SetStateAction<string | undefined>>;
  vote: Vote | null;
}

export const useSetInputFocus = ({
  vote,
  setInputValue,
}: UseSetInputFocusArgs) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const prevVote = useRef<Vote | null>(vote);

  useEffect(() => {
    const becameSelected = vote && vote !== prevVote.current;

    if (becameSelected) {
      inputRef.current?.focus();
      setInputValue("");
    }

    prevVote.current = vote;
  }, [vote, setInputValue]);

  return {
    inputRef,
  };
};
