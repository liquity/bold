import { useVotingStateContext } from "@/src/screens/StakeScreen/components/PanelVoting/providers/PanelVotingProvider/hooks";

export const useIsPeriodCutoff = () => {
  const { governanceStateData } = useVotingStateContext();

  return governanceStateData?.period === "cutoff";
};
