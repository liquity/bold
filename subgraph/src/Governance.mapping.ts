import {
  RegisterInitiative as RegisterInitiativeEvent,
  UnregisterInitiative as UnregisterInitiativeEvent,
} from "../generated/Governance/Governance";
import { GovernanceInitiative } from "../generated/schema";

export function handleRegisterInitiative(event: RegisterInitiativeEvent): void {
  let initiative = new GovernanceInitiative(event.params.initiative.toHex());
  initiative.registered = true;
  initiative.save();
}

export function handleUnregisterInitiative(event: UnregisterInitiativeEvent): void {
  let initiative = GovernanceInitiative.load(event.params.initiative.toHex());
  if (initiative === null) {
    throw new Error("UnregisterInitiative event for non-existing initiative");
  }
  initiative.registered = false;
  initiative.save();
}
