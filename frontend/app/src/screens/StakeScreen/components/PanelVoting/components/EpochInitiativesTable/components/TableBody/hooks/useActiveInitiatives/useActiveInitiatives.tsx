import { useMemo } from "react";
import { useVotingStateContext } from "@/src/screens/StakeScreen/components/PanelVoting/providers/PanelVotingProvider/hooks";
import { isInitiativeStatusActive } from "@/src/screens/StakeScreen/utils";

export const useActiveInitiatives = () => {
  const { initiativesData, initiativesStatesData, voteAllocations } =
    useVotingStateContext();

  return useMemo(() => {
    return (initiativesData || [])
      .filter((initiative) => {
        const status =
          initiativesStatesData?.[initiative.address]?.status ?? "nonexistent";

        return (
          isInitiativeStatusActive(status) ||
          Boolean(voteAllocations[initiative.address])
        );
      })
      .sort((a, b) => {
        // 1. sort by allocation
        const allocationA = voteAllocations[a.address];
        const allocationB = voteAllocations[b.address];
        if (allocationA && !allocationB) return -1;
        if (!allocationA && allocationB) return 1;

        // 2. sort by status
        const statusA =
          initiativesStatesData?.[a.address]?.status ?? "nonexistent";
        const statusB =
          initiativesStatesData?.[b.address]?.status ?? "nonexistent";
        const isActiveA = isInitiativeStatusActive(statusA);
        const isActiveB = isInitiativeStatusActive(statusB);

        if (isActiveA && !isActiveB) return -1;
        if (!isActiveA && isActiveB) return 1;

        return 0;
      });
  }, [initiativesData, initiativesStatesData, voteAllocations]);
};
