import {
  useVotingState
} from './hooks';
import { createContext } from 'react';

export type Context = Omit<ReturnType<typeof useVotingState>, 'isLoading'>;

export const context = createContext<Context>({
  governanceStateData: undefined,
  governanceUserData: undefined,
  initiativesStatesData: undefined,
  initiativesData: undefined,
  voteTotalsData: undefined,
  initiativesAddresses: [],
  currentBribesData: undefined,
});

export const { Provider } = context;
