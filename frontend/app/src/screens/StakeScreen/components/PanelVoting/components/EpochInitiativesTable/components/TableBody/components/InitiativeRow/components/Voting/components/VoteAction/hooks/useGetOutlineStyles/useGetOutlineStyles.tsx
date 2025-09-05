import type { Vote } from "@/src/types";

interface UseGetOutlineStylesProps {
  hasError: boolean;
  isFocused: boolean;
  vote: Vote | null;
}
export const useGetOutlineStyles = ({
  hasError,
  isFocused,
  vote,
}: UseGetOutlineStylesProps) => {
  if (hasError) {
    return {
      outlineColor: "var(--outline-error)",
    };
  }

  if (isFocused && vote) {
    return {
      outlineColor: "var(--outline-focused)",
    };
  }

  return {
    outlineColor: "transparent",
  };
};
