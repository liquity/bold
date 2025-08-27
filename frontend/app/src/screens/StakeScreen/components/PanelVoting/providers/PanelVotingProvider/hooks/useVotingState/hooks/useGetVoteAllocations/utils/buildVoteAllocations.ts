import {
  votingPower,
} from "@/src/liquity-governance";

import type {
  GovernanceState,
  GovernanceUserState,
} from "@/src/liquity-governance";
import type { VoteAllocations } from "@/src/types";

export const buildVoteAllocations = (
  userAllocations: GovernanceUserState["allocations"],
  epochEnd: GovernanceState["epochEnd"],
  stakedVotingPower: bigint,
) => {
  const result: VoteAllocations = {};

  for (const {
    voteLQTY,
    voteOffset,
    vetoLQTY,
    vetoOffset,
    initiative,
  } of userAllocations) {
    const vote = voteLQTY > 0n ? "for" : vetoLQTY > 0n ? "against" : null;

    if (!vote) continue;

    const power =
      vote === "for"
        ? votingPower(voteLQTY, voteOffset, epochEnd)
        : votingPower(vetoLQTY, vetoOffset, epochEnd);

    const percentage =
      (BigInt(1e4) * power + stakedVotingPower / 2n) / stakedVotingPower;

    result[initiative] = { vote, value: [percentage, 4] };
  }

  return result;
};
