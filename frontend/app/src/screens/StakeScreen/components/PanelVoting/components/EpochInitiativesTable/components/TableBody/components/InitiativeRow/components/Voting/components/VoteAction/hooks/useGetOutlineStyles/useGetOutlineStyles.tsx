import type { Vote } from '@/src/types';

interface UseGetOutlineStylesProps {
  hasError: boolean;
  isFocused: boolean;
  vote: Vote | null;
}
export const useGetOutlineStyles = ({
  hasError,
  isFocused,
  vote
}: UseGetOutlineStylesProps) => {
  if(hasError) {
    //TODO: add normal color
    return {
      outlineColor: 'red',
    }
  }

  if(isFocused && vote) {
    return {
      outlineColor: "var(--outline-focused)",
    }
  }

  return {
    outlineColor: "transparent",
  }
};
