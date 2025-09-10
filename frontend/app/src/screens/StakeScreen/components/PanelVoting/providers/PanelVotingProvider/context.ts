import { noop } from "@/src/utils";
import { createContext } from "react";
import { useVotingState } from "./hooks";

export type Context = Omit<ReturnType<typeof useVotingState>, "isLoading">;

export const context = createContext<Context>({
  votingInputError: new Set(),
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
