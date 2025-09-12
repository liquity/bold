import { useVotingStateContext } from "@/src/screens/StakeScreen/components/PanelVoting/providers/PanelVotingProvider/hooks";
import { useCalculateVotePct } from "@/src/screens/StakeScreen/components/PanelVoting/components/EpochInitiativesTable/components/TableBody/hooks";
import { css } from "@/styled-system/css";
import { eq } from "dnum";
import { Amount } from "@/src/comps/Amount/Amount";
import { useProjectedUpvoteShares } from "./hooks";

import type { FC } from "react";
import type { Address } from "@/src/types";
import { CrossedText } from "@/src/comps/CrossedText";

interface AmountPresentationProps {
  initiativeAddress: Address;
}

export const AmountPresentation: FC<AmountPresentationProps> = ({
  initiativeAddress,
}) => {
  const { voteTotalsData } = useVotingStateContext();
  const projectedShares = useProjectedUpvoteShares();

  const initiativeNewPct = projectedShares[initiativeAddress];
  // vp_counted — the current "counted" voting power, in other words the total voting power allocated to upvotes:
  const votesPct = useCalculateVotePct({
    voteTotals: voteTotalsData?.[initiativeAddress],
  });

  return (
    <div
      className={css({
        display: "flex",
        alignItems: "center",
        gap: 4,
        fontSize: 12,
      })}
      title="Percentage of incentives the initiative would receive according to the current votes"
    >
      <span>Votes:</span>

      {initiativeNewPct && votesPct && !eq(initiativeNewPct, votesPct) ? (
        <>
          <Amount title={null} value={initiativeNewPct} percentage />
          <CrossedText>
            <Amount title={null} value={votesPct} percentage />
          </CrossedText>
        </>
      ) : (
        <Amount title={null} value={votesPct} percentage />
      )}
    </div>
  );
};
