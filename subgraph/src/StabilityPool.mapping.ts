import { Address, BigInt, dataSource } from "@graphprotocol/graph-ts";
import {
  StabilityPool,
  StabilityPoolDeposit,
  StabilityPoolDepositSnapshot,
  StabilityPoolEpochScale,
} from "../generated/schema";
import {
  B_Updated as B_UpdatedEvent,
  DepositUpdated as DepositUpdatedEvent,
  S_Updated as S_UpdatedEvent,
} from "../generated/templates/StabilityPool/StabilityPool";

export function handleDepositUpdated(event: DepositUpdatedEvent): void {
  let collId = dataSource.context().getString("collId");

  let sp = StabilityPool.load(collId);
  if (!sp) {
    sp = new StabilityPool(collId);
    sp.totalDeposited = BigInt.fromI32(0);
  }

  let spDeposit = loadOrCreateStabilityPoolDeposit(event.params._depositor, collId);
  let spDepositSnapshot = loadOrCreateSnapshot(spDeposit.id);

  let diff = event.params._newDeposit.minus(spDeposit.deposit);
  sp.totalDeposited = sp.totalDeposited.plus(diff);
  sp.save();

  spDeposit.deposit = event.params._newDeposit;

  spDepositSnapshot.P = event.params._snapshotP;
  spDepositSnapshot.S = event.params._snapshotS;
  spDepositSnapshot.B = event.params._snapshotB;
  spDepositSnapshot.scale = event.params._snapshotScale;
  spDepositSnapshot.epoch = event.params._snapshotEpoch;

  spDepositSnapshot.save();
  spDeposit.save();
}

export function handleSUpdated(event: S_UpdatedEvent): void {
  let spEpochScale = loadOrCreateStabilitiPoolEpochScale(
    event.params._epoch,
    event.params._scale,
  );
  spEpochScale.S = event.params._S;
  spEpochScale.save();
}

export function handleBUpdated(event: B_UpdatedEvent): void {
  let spEpochScale = loadOrCreateStabilitiPoolEpochScale(
    event.params._epoch,
    event.params._scale,
  );
  spEpochScale.B = event.params._B;
  spEpochScale.save();
}

function loadOrCreateStabilitiPoolEpochScale(
  epoch: BigInt,
  scale: BigInt,
): StabilityPoolEpochScale {
  let collId = dataSource.context().getString("collId");
  let spEpochScaleId = collId + ":" + epoch.toString() + ":" + scale.toString();

  let spEpochScale = StabilityPoolEpochScale.load(spEpochScaleId);
  if (!spEpochScale) {
    spEpochScale = new StabilityPoolEpochScale(spEpochScaleId);
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
    spDeposit.snapshot = loadOrCreateSnapshot(spId).id;
  }

  return spDeposit;
}

function loadOrCreateSnapshot(spId: string): StabilityPoolDepositSnapshot {
  let snapshot = StabilityPoolDepositSnapshot.load(spId);
  if (!snapshot) {
    snapshot = new StabilityPoolDepositSnapshot(spId);
    snapshot.P = BigInt.fromI32(0);
    snapshot.S = BigInt.fromI32(0);
    snapshot.B = BigInt.fromI32(0);
    snapshot.scale = BigInt.fromI32(0);
    snapshot.epoch = BigInt.fromI32(0);
  }
  return snapshot;
}
