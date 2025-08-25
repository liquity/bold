import type { InitiativeStatus } from '@/src/liquity-governance';
import {
  INITIATIVE_STATUS_LABELS
} from '@/src/screens/StakeScreen/components/PanelVoting/components/EpochInitiativesTable/components/TableBody/components/InitiativeRow/constants';

export const initiativeStatusLabel = (status: InitiativeStatus) => INITIATIVE_STATUS_LABELS[status] ?? "";
