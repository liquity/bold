import {  useContext } from 'react';
import { context } from '@/src/screens/StakeScreen/components/PanelVoting/providers/PanelVotingProvider/context.ts';

export const useVotingStateContext = () => useContext(context)
