import { Provider as PanelVotingProvider } from "./providers/PanelVotingProvider";
import { useVotingState } from "@/src/screens/StakeScreen/components/PanelVoting/providers/PanelVotingProvider/hooks";
import { Loader } from "./components/Loader";
import { css } from "@/styled-system/css";
import { Header } from "./components/Header";
import { VotingRoundTimer } from "./components/VotingRoundTimer";
import { CutoffWarning } from "./components/CutoffWarning";
import { EpochInitiativesTable } from "./components/EpochInitiativesTable";
import { BribeMarketsInfo } from "./components/BribeMarketsInfo";
import { EpochVotingStatus } from "./components/EpochVotingStatus";
import { CastVotes } from "./components/CastVotes";

import type { FC } from "react";

export const PanelVoting: FC = () => {
  const { isLoading, ...votingState } = useVotingState();

  if (isLoading) {
    return <Loader />;
  }

  return (
    <PanelVotingProvider value={votingState}>
      <section
        className={css({
          display: "flex",
          justifyContent: "center",
          flexDirection: "column",
          gap: 16,
          width: "100%",
          paddingTop: 24,
        })}
      >
        <Header />
        <VotingRoundTimer />
        <CutoffWarning />
        <EpochInitiativesTable />
        <BribeMarketsInfo />
        <EpochVotingStatus />
        <CastVotes />
      </section>
    </PanelVotingProvider>
  );
};
