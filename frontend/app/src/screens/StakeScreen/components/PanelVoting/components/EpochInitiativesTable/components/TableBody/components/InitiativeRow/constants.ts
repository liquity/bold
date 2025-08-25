import { InitiativeStatus } from '@/src/liquity-governance';

export const INITIATIVE_STATUS_LABELS: Partial<Record<InitiativeStatus, string>> = {
  "skip": "Active",
  "claimable": "Active",
  "claimed": "Active",
  "warm up": "Warm-up period",
  "unregisterable": "Unregistering",
  "disabled": "Disabled",
};
