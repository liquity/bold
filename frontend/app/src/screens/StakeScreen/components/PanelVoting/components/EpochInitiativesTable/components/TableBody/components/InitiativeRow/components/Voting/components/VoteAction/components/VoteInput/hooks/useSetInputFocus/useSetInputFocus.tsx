import { useEffect, useRef } from 'react';
import { Vote } from '@/src/types';

export const useSetInputFocus = (vote: Vote | null) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const prevVote = useRef<Vote | null>(null);

  useEffect(() => {
    const becameSelected = vote && vote !== prevVote.current;

    if (becameSelected) {
      inputRef.current?.focus();
    }

    prevVote.current = vote;
  }, [vote]);

  return {
    inputRef,
  }
}
