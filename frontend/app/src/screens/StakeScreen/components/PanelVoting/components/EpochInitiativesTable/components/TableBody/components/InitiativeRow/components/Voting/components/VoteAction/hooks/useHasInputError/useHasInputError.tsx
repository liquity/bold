import {
  useVotingStateContext,
} from "@/src/screens/StakeScreen/components/PanelVoting/providers/PanelVotingProvider/hooks";

import type { Address } from "@/src/types";

export const useHasInputError = (initiativeAddress: Address) => {
  const { votingInputError } = useVotingStateContext();

  return votingInputError.has(initiativeAddress);
};
