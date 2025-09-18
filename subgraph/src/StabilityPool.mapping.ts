import { Address, BigInt, dataSource } from "@graphprotocol/graph-ts";
import {
  StabilityPool,
  StabilityPoolDeposit,
  // StabilityPoolDepositSnapshot,
  StabilityPoolScale,
} from "../generated/schema";
import {
  B_Updated as B_UpdatedEvent,
  DepositOperation as DepositOperationEvent,
  DepositUpdated as DepositUpdatedEvent,
  S_Updated as S_UpdatedEvent,
  StabilityPoolCollBalanceUpdated as StabilityPoolCollBalanceUpdatedEvent,
  StabilityPoolBoldBalanceUpdated as StabilityPoolBoldBalanceUpdatedEvent,
} from "../generated/templates/StabilityPool/StabilityPool";

export function handleDepositUpdated(event: DepositUpdatedEvent): void {
  let collId = dataSource.context().getString("collId");

  let sp = loadOrCreateStabilityPool(collId);

  let spDeposit = loadOrCreateStabilityPoolDeposit(event.params._depositor, collId);
  // let spDepositSnapshot = loadOrCreateSnapshot(spDeposit.id);

  let diff = event.params._newDeposit.minus(spDeposit.deposit);
  sp.totalDeposited = sp.totalDeposited.plus(diff);
  sp.save();

  spDeposit.deposit = event.params._newDeposit;

  // spDepositSnapshot.P = event.params._snapshotP;
  // spDepositSnapshot.S = event.params._snapshotS;
  // spDepositSnapshot.B = event.params._snapshotB;
  // spDepositSnapshot.scale = event.params._snapshotScale;

  // spDepositSnapshot.save();
  spDeposit.save();
}

export function handleSUpdated(event: S_UpdatedEvent): void {
  let spEpochScale = loadOrCreateStabilityPoolScale(
    // event.params._epoch,
    event.params._scale,
  );
  spEpochScale.S = event.params._S;
  spEpochScale.save();
}

export function handleBUpdated(event: B_UpdatedEvent): void {
  let spEpochScale = loadOrCreateStabilityPoolScale(
    // event.params._epoch,
    event.params._scale,
  );
  spEpochScale.B = event.params._B;
  spEpochScale.save();
}

export function handleDepositOperation(event: DepositOperationEvent): void {
  let collId = dataSource.context().getString("collId");
  let depositor = event.params._depositor;

  // Load or create the stability pool
  let sp = loadOrCreateStabilityPool(collId);
  sp.save();

  // Load or create the stability pool deposit
  let spDeposit = loadOrCreateStabilityPoolDeposit(depositor, collId);
  
  // Update the deposit based on the operation type and deposit change
  // depositChange can be positive or negative depending on the operation
  // let depositChange = event.params._depositChange; <-- Old field name
  let depositChange = event.params._topUpOrWithdrawal;
  
  if (depositChange.gt(BigInt.fromI32(0))) {
    // Deposit increased
    sp.totalDeposited = sp.totalDeposited.plus(depositChange);
    spDeposit.deposit = spDeposit.deposit.plus(depositChange);
  } else if (depositChange.lt(BigInt.fromI32(0))) {
    // Deposit decreased (withdrawal)
    let absChange = depositChange.abs();
    sp.totalDeposited = sp.totalDeposited.minus(absChange);
    spDeposit.deposit = spDeposit.deposit.minus(absChange);
  }
  
  // Save the updated entities
  sp.save();
  spDeposit.save();
}

export function handleStabilityPoolCollBalanceUpdated(event: StabilityPoolCollBalanceUpdatedEvent): void {
  let collId = dataSource.context().getString("collId");
  
  // Load or create the stability pool
  let sp = loadOrCreateStabilityPool(collId);

  sp.collBalance = event.params._newBalance;
  
  // Since the StabilityPool entity doesn't have a collateralBalance field in the schema,
  // we don't update it directly. If needed, this data could be tracked in a separate entity 
  // or the schema could be updated to include this field.
  
  // The event is still processed, which means it's tracked in the subgraph
  sp.save();
}

export function handleStabilityPoolBoldBalanceUpdated(event: StabilityPoolBoldBalanceUpdatedEvent): void {
  let collId = dataSource.context().getString("collId");
  
  // Load or create the stability pool
  let sp = loadOrCreateStabilityPool(collId);

  sp.totalDeposited = event.params._newBalance;
  
  // Since the StabilityPool entity doesn't have a boldBalance field in the schema,
  // we don't update it directly. If needed, this data could be tracked in a separate entity 
  // or the schema could be updated to include this field.
  
  // The event is still processed, which means it's tracked in the subgraph
  sp.save();
}

function loadOrCreateStabilityPool(collId: string): StabilityPool {
  let sp = StabilityPool.load(collId);
  if (!sp) {
    sp = new StabilityPool(collId);
    sp.totalDeposited = BigInt.fromI32(0);
    sp.collBalance = BigInt.fromI32(0);
  }
  return sp;
}

function loadOrCreateStabilityPoolScale(
  // epoch: BigInt,
  scale: BigInt,
): StabilityPoolScale {
  let collId = dataSource.context().getString("collId");
  // let spEpochScaleId = collId + ":" + epoch.toString() + ":" + scale.toString(); <-- Old ID
  let spEpochScaleId = collId + ":" + scale.toString();

  let spEpochScale = StabilityPoolScale.load(spEpochScaleId);
  if (!spEpochScale) {
    spEpochScale = new StabilityPoolScale(spEpochScaleId);
    spEpochScale.B = BigInt.fromI32(0);
    spEpochScale.S = BigInt.fromI32(0);
  }

  return spEpochScale;
}

function loadOrCreateStabilityPoolDeposit(depositor: Address, collId: string): StabilityPoolDeposit {
  let spId = collId + ":" + depositor.toHexString().toLowerCase();
  let spDeposit = StabilityPoolDeposit.load(spId);

  if (!spDeposit) {
    spDeposit = new StabilityPoolDeposit(spId);
    spDeposit.collateral = collId;
    spDeposit.deposit = BigInt.fromI32(0);
    spDeposit.depositor = depositor;
    // spDeposit.snapshot = loadOrCreateSnapshot(spId).id;
  }

  return spDeposit;
}

// function loadOrCreateSnapshot(spId: string): StabilityPoolDepositSnapshot {
//   let snapshot = StabilityPoolDepositSnapshot.load(spId);
//   if (!snapshot) {
//     snapshot = new StabilityPoolDepositSnapshot(spId);
//     snapshot.P = BigInt.fromI32(0);
//     snapshot.S = BigInt.fromI32(0);
//     snapshot.B = BigInt.fromI32(0);
//     snapshot.scale = BigInt.fromI32(0);
//   }
//   return snapshot;
// }
