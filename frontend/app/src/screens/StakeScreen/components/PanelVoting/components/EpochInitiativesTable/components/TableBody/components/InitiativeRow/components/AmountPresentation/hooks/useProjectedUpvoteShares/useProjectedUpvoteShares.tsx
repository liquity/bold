import { useMemo } from "react";
import type { Address, Dnum } from "@/src/types";
import { votingPower } from "@/src/liquity-governance";
import { dnum18, DNUM_0 } from "@/src/dnum-utils";
import { mul, add, sub, eq, div } from "dnum";
import { isInitiativeStatusActive } from "@/src/screens/StakeScreen/utils";
import { useVotingStateContext } from "@/src/screens/StakeScreen/components/PanelVoting/providers/PanelVotingProvider/hooks";

export const useProjectedUpvoteShares = () => {
  const {
    governanceStateData: gs,
    governanceUserData: gu,
    initiativesAddresses,
    voteAllocations,
    voteTotalsData,
    inputVoteAllocations,
    initiativesStatesData,
  } = useVotingStateContext();

  return useMemo(() => {
    if (!gs || !gu || !voteTotalsData) return {} as Record<Address, Dnum>;

    const vp_counted = votingPower(
      gs.countedVoteLQTY,
      gs.countedVoteOffset,
      gs.epochEnd,
    );

    const vp_user = votingPower(gu.stakedLQTY, gu.stakedOffset, gs.epochEnd);

    // pct_user_i current user upvote
    const pct_curr: Record<Address, Dnum> = {};
    for (const addr of initiativesAddresses) {
      const a = voteAllocations[addr];
      pct_curr[addr] = a?.vote === "for" ? a.value : DNUM_0;
    }

    // only for active initiatives
    let sumDelta = DNUM_0;
    const deltaByAddr: Record<Address, Dnum> = {};

    for (const addr of initiativesAddresses) {
      const next =
        inputVoteAllocations[addr]?.vote === "for"
          ? (inputVoteAllocations[addr]?.value ?? DNUM_0)
          : DNUM_0;
      const delta = sub(next, pct_curr[addr] ?? DNUM_0);

      if (
        isInitiativeStatusActive(
          initiativesStatesData?.[addr]?.status || "nonexistent",
        )
      ) {
        deltaByAddr[addr] = delta;
        sumDelta = add(sumDelta, delta);
      } else {
        deltaByAddr[addr] = DNUM_0;
      }
    }

    // sum of all initiatives
    const den = add(dnum18(vp_counted), mul(dnum18(vp_user), sumDelta));
    const projected: Record<Address, Dnum> = {};

    for (const addr of initiativesAddresses) {
      const vt = voteTotalsData[addr];
      if (!vt) continue;

      const vp_i = votingPower(vt.voteLQTY, vt.voteOffset, gs.epochEnd);
      const num = add(
        dnum18(vp_i),
        mul(dnum18(vp_user), deltaByAddr[addr] ?? DNUM_0),
      );

      projected[addr] = eq(den, 0) ? DNUM_0 : div(num, den); // 0..1
    }

    return projected;
  }, [
    initiativesAddresses,
    gs,
    gu,
    voteTotalsData,
    voteAllocations,
    inputVoteAllocations,
    initiativesStatesData,
  ]);
};
