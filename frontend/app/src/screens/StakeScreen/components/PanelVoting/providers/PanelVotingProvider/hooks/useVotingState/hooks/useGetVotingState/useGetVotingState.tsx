import { useAccount } from '@/src/wagmi-utils.ts';
import { useGovernanceState, useGovernanceUser } from '@/src/liquity-governance.ts';

export const useGetVotingState = () => {
  const account = useAccount();
  const {data: governanceStateData, isLoading: governanceStateLoading } =
    useGovernanceState();
  const {data: governanceUserData, isLoading: governanceUserLoading } =
    useGovernanceUser(account.address ?? null);

  return {
    governanceStateData,
    governanceUserData,
    isLoading: governanceStateLoading || governanceUserLoading,
  };
}
