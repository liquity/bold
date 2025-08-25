import { initiativeStatusLabel } from "@/src/screens/StakeScreen/components/PanelVoting/components/EpochInitiativesTable/components/TableBody/components/InitiativeRow/utils";
import { css } from "@/styled-system/css";

import type { FC } from "react";
import type { InitiativeStatus } from "@/src/liquity-governance";

interface InitiativeStatusTagProps {
  initiativesStatus?: InitiativeStatus;
  isStatusActive: boolean;
}

export const InitiativeStatusTag: FC<InitiativeStatusTagProps> = ({
  initiativesStatus,
  isStatusActive
}) => {
  if(!initiativesStatus) {
    return null
  }

  return (
    <div
      title={`${initiativeStatusLabel(initiativesStatus)} (${initiativesStatus})`}
      className={css({
        display: "flex",
        alignItems: "center",
        height: 16,
        padding: "0 4px 1px",
        fontSize: 12,
        borderRadius: 8,
        userSelect: "none",
        textTransform: "lowercase",
        transform: "translateY(0.5px)",
        whiteSpace: "nowrap",
        color: isStatusActive ? "infoSurfaceContent" : "var(--color-warning)",
        background: isStatusActive
          ? "infoSurface"
          : "var(--background-warning)",
        border: isStatusActive
          ? "1px solid token(colors.infoSurfaceBorder)"
          : 0,
        "--color-warning": "token(colors.warningAltContent)",
        "--background-warning": "token(colors.warningAlt)",
      })}
    >
      {initiativeStatusLabel(initiativesStatus)}
    </div>
  );
};
