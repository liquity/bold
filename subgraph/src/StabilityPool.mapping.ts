import { Address, BigInt, dataSource } from "@graphprotocol/graph-ts";
import { StabilityPoolDeposit } from "../generated/schema";
import { DepositUpdated as DepositUpdatedEvent } from "../generated/templates/StabilityPool/StabilityPool";
import { getCollPrefixId } from "./collateral-context-utils";

function loadOrCreateStabilityPoolDeposit(depositor: Address, collateralId: string): StabilityPoolDeposit {
  let stabilityPoolDepositId = getCollPrefixId() + depositor.toHexString();
  let stabilityPoolDeposit = StabilityPoolDeposit.load(stabilityPoolDepositId);

  if (!stabilityPoolDeposit) {
    stabilityPoolDeposit = new StabilityPoolDeposit(stabilityPoolDepositId);

    stabilityPoolDeposit.depositor = depositor;
    stabilityPoolDeposit.collateral = collateralId;
    stabilityPoolDeposit.deposit = BigInt.fromI32(0);
    stabilityPoolDeposit.boldGain = BigInt.fromI32(0);
    stabilityPoolDeposit.collGain = BigInt.fromI32(0);
  }

  return stabilityPoolDeposit;
}

export function handleDepositUpdated(event: DepositUpdatedEvent): void {
  let collateralId = dataSource.context().getString("collateralId");
  let stabilityPoolDeposit = loadOrCreateStabilityPoolDeposit(event.params._depositor, collateralId);

  stabilityPoolDeposit.deposit = event.params._newDeposit;
  stabilityPoolDeposit.save();
}
