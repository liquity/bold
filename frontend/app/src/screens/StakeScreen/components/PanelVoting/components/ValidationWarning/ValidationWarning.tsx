import { useMemo } from "react";
import { css } from "@/styled-system/css";
import { useIsPeriodCutoff } from "@/src/screens/StakeScreen/components/PanelVoting/hooks";
import { useVotingStateContext } from "@/src/screens/StakeScreen/components/PanelVoting/providers/PanelVotingProvider/hooks";

import type { FC } from "react";

export const ValidationWarning: FC = () => {
  const isPeriodCutoff = useIsPeriodCutoff();
  const { votingInputError } = useVotingStateContext();

  const errors = useMemo(() => {
    if (!votingInputError) {
      return [];
    }

    return Object.values(votingInputError);
  }, [votingInputError]);

  if (!isPeriodCutoff || !errors.length) {
    return null;
  }

  return (
    <div
      className={css({
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: '8px 8px 8px 12px',
        fontSize: 14,
        background: "yellow:50",
        border: "1px solid token(colors.yellow:200)",
        borderRadius: 8,
      })}
    >
      <ul
        className={css({
          listStyleType: "disc",
          paddingLeft: 20,
        })}
      >
        {errors.map((error) => (
          <li>{error}</li>
        ))}
      </ul>
    </div>
  );
};
