import {
  useVotingState
} from './hooks';
import { createContext } from 'react';
import { noop } from "@/src/utils";

export type Context = Omit<ReturnType<typeof useVotingState>, 'isLoading'>;

export const context = createContext<Context>({
  votingInputError: null,
  setVotingInputError: noop,
  voteAllocations: {},
  inputVoteAllocations: {},
  setInputVoteAllocations: noop,
  governanceStateData: undefined,
  governanceUserData: undefined,
  initiativesStatesData: undefined,
  initiativesData: undefined,
  voteTotalsData: undefined,
  initiativesAddresses: [],
  currentBribesData: undefined,
});

export const { Provider } = context;
