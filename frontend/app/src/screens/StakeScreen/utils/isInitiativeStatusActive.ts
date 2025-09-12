import type { InitiativeStatus } from '@/src/liquity-governance.ts';

export function isInitiativeStatusActive(
  status: InitiativeStatus,
): status is Exclude<
  InitiativeStatus,
  "disabled" | "nonexistent" | "unregisterable" | "warm up"
> {
  return (
    status !== "disabled" &&
    status !== "nonexistent" &&
    status !== "unregisterable" &&
    status !== "warm up"
  );
}
