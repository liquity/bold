import type { FC } from "react";
import { Provider as PanelVotingProvider } from "./providers/PanelVotingProvider";
import { useVotingState } from "@/src/screens/StakeScreen/components/PanelVoting/providers/PanelVotingProvider/hooks";
import { Loader } from './components/Loader';
import { css } from '@/styled-system/css';
import { Header } from '@/src/screens/StakeScreen/components/PanelVoting/components/Header';
import { VotingRoundTimer } from '@/src/screens/StakeScreen/components/PanelVoting/components/VotingRoundTimer';
import { CutoffWarning } from '@/src/screens/StakeScreen/components/PanelVoting/components/CutoffWarning';

export const PanelVoting: FC = () => {
  const { isLoading, ...votingState } = useVotingState();

  if(isLoading) {
    return <Loader />
  }

  return <PanelVotingProvider value={votingState}>
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
    </section></PanelVotingProvider>;
};
