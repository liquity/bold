import {
  useVotingStateContext
} from '@/src/screens/StakeScreen/components/PanelVoting/providers/PanelVotingProvider/hooks';

export const useHasAllocations = () => {
  const {governanceUserData} = useVotingStateContext();

  return (governanceUserData?.allocations ?? []).length > 0;
}
