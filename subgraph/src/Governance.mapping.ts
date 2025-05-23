import { RegisterInitiative as RegisterInitiativeEvent } from "../generated/Governance/Governance";
import { GovernanceInitiative } from "../generated/schema";

export function handleRegisterInitiative(event: RegisterInitiativeEvent): void {
  let initiative = new GovernanceInitiative(event.params.initiative.toHex());
  initiative.save();
}
