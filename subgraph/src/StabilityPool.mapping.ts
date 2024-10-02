import { Address, BigInt, dataSource } from "@graphprotocol/graph-ts";
import { StabilityPool, StabilityPoolDeposit } from "../generated/schema";
import { DepositUpdated as DepositUpdatedEvent } from "../generated/templates/StabilityPool/StabilityPool";

function loadOrCreateStabilityPool(collId: string): StabilityPool {
  let sp = StabilityPool.load(collId);

  if (!sp) {
    sp = new StabilityPool(collId);
    sp.totalDeposited = BigInt.fromI32(0);
  }

  return sp;
}

function loadOrCreateStabilityPoolDeposit(depositor: Address, collId: string): StabilityPoolDeposit {
  let spId = collId + ":" + depositor.toHexString().toLowerCase();
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
  let collId = dataSource.context().getString("collId");
  let newDeposit = event.params._newDeposit;
  let depositor = event.params._depositor;

  let sp = loadOrCreateStabilityPool(collId);
  let spDeposit = loadOrCreateStabilityPoolDeposit(depositor, collId);

  let diff = newDeposit.minus(spDeposit.deposit);
  sp.totalDeposited = sp.totalDeposited.plus(diff);
  sp.save();

  spDeposit.deposit = newDeposit;
  spDeposit.save();
}
