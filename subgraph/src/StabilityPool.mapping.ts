import { Address, BigInt, dataSource } from "@graphprotocol/graph-ts";
import { StabilityPoolDeposit } from "../generated/schema";
import { DepositUpdated as DepositUpdatedEvent } from "../generated/templates/StabilityPool/StabilityPool";

function loadOrCreateStabilityPoolDeposit(depositor: Address, collId: string): StabilityPoolDeposit {
  let spId = collId + ":" + depositor.toHexString();
  let spDeposit = StabilityPoolDeposit.load(spId);

  if (!spDeposit) {
    spDeposit = new StabilityPoolDeposit(spId);
    spDeposit.boldGain = BigInt.fromI32(0);
    spDeposit.collGain = BigInt.fromI32(0);
    spDeposit.collateral = collId;
    spDeposit.deposit = BigInt.fromI32(0);
    spDeposit.depositor = depositor;
  }

  return spDeposit;
}

export function handleDepositUpdated(event: DepositUpdatedEvent): void {
  let spDeposit = loadOrCreateStabilityPoolDeposit(
    event.params._depositor,
    dataSource.context().getString("collId"),
  );

  spDeposit.deposit = event.params._newDeposit;
  spDeposit.save();
}
