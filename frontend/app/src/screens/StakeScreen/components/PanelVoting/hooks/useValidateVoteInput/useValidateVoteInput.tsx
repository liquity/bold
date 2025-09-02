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
    if (!input || !input.vote || input.vote !== "for") {
      setVotingInputError(null);
      return;
    }

    if (!current || !current.value) {
      setVotingInputError(null);
      return;
    }

    const isIncreased =
      gt(input.value, current.value) && current.vote === input.vote;

    if (isIncreased) {
      setVotingInputError((prev) => ({
        ...prev,
        [initiativeAddress]:
          "Increases in upvotes are not permitted during the last 24 hours of the voting period. Currently, only downvotes or decreases in upvotes are possible.",
      }));

      return;
    }

    setVotingInputError((prev) => {
      if (!prev) return null;
      const { [initiativeAddress]: _, ...rest } = prev;
      return Object.keys(rest).length > 0 ? rest : null;
    });
  }, [initiativeAddress, input, current, setVotingInputError]);
};
