import { Tag } from "@/src/comps/Tag/Tag.tsx";
import { formatDate } from "@/src/formatting.ts";
import { useVotingStateContext } from "@/src/screens/StakeScreen/components/PanelVoting/providers/PanelVotingProvider/hooks";
import { css } from "@/styled-system/css";

import type { FC } from "react";

export const VotingRoundTimer: FC = () => {
  const { governanceStateData } = useVotingStateContext();

  return (
    <div
      className={css({
        display: "flex",
        justifyContent: "space-between",
        alignItems: "start",
        gap: 24,
        width: "100%",
        userSelect: "none",
      })}
    >
      {governanceStateData && (
        <div
          className={css({
            flexShrink: 1,
            minWidth: 0,
            display: "grid",
            gridTemplateColumns: "1fr auto",
            alignItems: "center",
            gap: 6,
          })}
        >
          <div
            className={css({
              flexShrink: 1,
              minWidth: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            })}
          >
            Current voting round ends in{" "}
          </div>
          <Tag
            title={
              governanceStateData &&
              `Epoch ${governanceStateData.epoch} ends on the ${formatDate(
                new Date(Number(governanceStateData.epochEnd) * 1000),
              )}`
            }
          >
            {governanceStateData.daysLeftRounded}{" "}
            {governanceStateData.daysLeftRounded === 1 ? "day" : "days"}
          </Tag>
        </div>
      )}
    </div>
  );
};
