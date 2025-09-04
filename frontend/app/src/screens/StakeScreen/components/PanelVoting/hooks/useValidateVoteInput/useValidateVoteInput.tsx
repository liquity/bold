import type { Address } from "@liquity2/uikit";
import { useVotingStateContext } from "@/src/screens/StakeScreen/components/PanelVoting/providers/PanelVotingProvider/hooks";
import { useEffect } from "react";
import { gt } from "dnum";

export const useValidateVoteInput = (initiativeAddress: Address) => {
  const { voteAllocations, inputVoteAllocations, setVotingInputError } =
    useVotingStateContext();
  const input = inputVoteAllocations[initiativeAddress];
  const current = voteAllocations[initiativeAddress];

  useEffect(() => {
    const clearError = () =>
      setVotingInputError((prev) => {
        if (!prev || !(initiativeAddress in prev)) return prev;

        const { [initiativeAddress]: _omit, ...rest } = prev;

        return Object.keys(rest).length ? rest : null;
      });

    const setError = (msg: string) =>
      setVotingInputError((prev) => ({
        ...(prev ?? {}),
        [initiativeAddress]: msg,
      }));

    if (!input || !input.vote || input.vote !== "for") {
      clearError()
      return;
    }

    if (!current || !current.value) {
      clearError()
      return;
    }

    const isIncreased =
      gt(input.value, current.value) && current.vote === input.vote;

    if (isIncreased) {
      setError("Increases in upvotes are not permitted during the last 24 hours of the voting period. Currently, only downvotes or decreases in upvotes are possible.")

      return;
    }

    setVotingInputError((prev) => {
      if (!prev) return null;
      const { [initiativeAddress]: _, ...rest } = prev;
      return Object.keys(rest).length > 0 ? rest : null;
    });
  }, [initiativeAddress, input, current, setVotingInputError]);
};
