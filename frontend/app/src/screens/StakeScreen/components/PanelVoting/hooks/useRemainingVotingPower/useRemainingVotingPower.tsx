import { useMemo } from 'react';
import { div, from, sub } from 'dnum';
import type { Address, Dnum, Entries, VoteAllocations } from '@/src/types';
import {
  useVotingStateContext
} from '@/src/screens/StakeScreen/components/PanelVoting/providers/PanelVotingProvider/hooks';
import { isInitiativeStatusActive } from '@/src/screens/StakeScreen/utils';

type Allocations = Record<Address, Dnum>;

// TODO: check functional
export const useRemainingVotingPower= () => {
  const { governanceUserData, inputVoteAllocations, initiativesStatesData } = useVotingStateContext();

  return useMemo(() => {
    let remaining = from(1, 18);

    if(!governanceUserData) return remaining;

    const { stakedLQTY, allocations } = governanceUserData


    // current allocation from user data
    const baseAllocations = allocations.reduce<Allocations>((acc, { initiative, voteLQTY, vetoLQTY }) => {
      const currentVoteAmount = voteLQTY > 0n ? voteLQTY : vetoLQTY;
      if (currentVoteAmount === 0n) return acc;

      acc[initiative] = div([currentVoteAmount, 18], [stakedLQTY, 18]);
      return acc;
    }, {});

    // input allocations (takes precedence)
    const inputOverrides = (Object.entries(inputVoteAllocations) as Entries<VoteAllocations>)
      .filter(([, vote]) => vote.vote !== null)
      .reduce<Allocations>((acc, [initiativeAddress, vote]) => {
        acc[initiativeAddress] = vote.value;
        return acc;
      }, {});

    const combinedAllocations: Allocations = {
      ...baseAllocations,
      ...inputOverrides,
    };

    // check if the initiative is still active
    for (const [address, value] of Object.entries(combinedAllocations) as Entries<Record<Address, Dnum>>) {
      const status = initiativesStatesData?.[address as Address]?.status ?? "nonexistent";

      if (!isInitiativeStatusActive(status)) continue;

      remaining = sub(remaining, value);
    }

    return remaining;
  }, [governanceUserData, inputVoteAllocations, initiativesStatesData]);
};
