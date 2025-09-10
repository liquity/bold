import type { Address } from "@liquity2/uikit";
import * as dn from "dnum";
import { useEffect } from "react";

import { useVotingStateContext } from "@/src/screens/StakeScreen/components/PanelVoting/providers/PanelVotingProvider/hooks";
import { useIsPeriodCutoff } from "../useIsPeriodCutoff";

export const useValidateVoteInput = (initiativeAddress: Address) => {
  const isPeriodCutoff = useIsPeriodCutoff();
  const { voteAllocations, inputVoteAllocations, setVotingInputError } = useVotingStateContext();
  const input = inputVoteAllocations[initiativeAddress];
  const current = voteAllocations[initiativeAddress];

  useEffect(() => {
    const clearError = () =>
      setVotingInputError((prev) => {
        if (!prev.has(initiativeAddress)) return prev;

        const next = new Set(prev);
        next.delete(initiativeAddress);
        return next;
      });

    const setError = () =>
      setVotingInputError((prev) => {
        if (prev.has(initiativeAddress)) return prev;

        const next = new Set(prev);
        next.add(initiativeAddress);
        return next;
      });

    if (
      isPeriodCutoff
      && current?.vote === "for"
      && input?.vote === "for"
      && dn.gt(input.value, current.value)
    ) {
      setError();
    } else {
      clearError();
    }
  }, [initiativeAddress, input, current, setVotingInputError]);
};
