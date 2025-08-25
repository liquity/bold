import { useMemo } from 'react';
import { useVotingStateContext } from "@/src/screens/StakeScreen/components/PanelVoting/providers/PanelVotingProvider/hooks";
import { VoteTotals, votingPower } from '@/src/liquity-governance';
import { dnum18, DNUM_0 } from '@/src/dnum-utils';
import { div } from 'dnum';

interface UseCalculateVotePctArgs {
  voteTotals?: VoteTotals;
}

// vp_counted - the current "counted" voting power, in other words the total voting power allocated to upvotes:
export const useCalculateVotePct = ({voteTotals}: UseCalculateVotePctArgs) => {
  const { governanceStateData } =
    useVotingStateContext();
  return useMemo(() => {
    if (!governanceStateData || !voteTotals) return null;

    const totalVotingPower = votingPower(
      governanceStateData.countedVoteLQTY,
      governanceStateData.countedVoteOffset,
      governanceStateData.epochEnd,
    );

    if (totalVotingPower === 0n) return DNUM_0;

    const initiativeVotingPower = votingPower(
      voteTotals.voteLQTY,
      voteTotals.voteOffset,
      governanceStateData.epochEnd,
    );

    return div(dnum18(initiativeVotingPower), dnum18(totalVotingPower));
  }, [governanceStateData, voteTotals]);
};
