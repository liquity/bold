import type { Address } from "@liquity2/uikit";
import {
  useVotingStateContext
} from '@/src/screens/StakeScreen/components/PanelVoting/providers/PanelVotingProvider/hooks';
import { useEffect } from 'react';
import { gt } from 'dnum';

//TODO: refactor
export const useValidateVoteInput = (initiativeAddress: Address) => {
  const {
    voteAllocations,
    inputVoteAllocations,
    setVotingInputError,
  } = useVotingStateContext();
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

    const isIncreased = gt(input.value, current.value);

    if (isIncreased) {
      setVotingInputError((prev) => ({
        ...prev,
        [initiativeAddress]: "Upvote increase not allowed during cutoff.",
      }));
    } else {
      setVotingInputError((prev) => {
        if (!prev) return null;
        const { [initiativeAddress]: _, ...rest } = prev;
        return Object.keys(rest).length > 0 ? rest : null;
      });
    }
  }, [initiativeAddress, input, current, setVotingInputError]);
}
