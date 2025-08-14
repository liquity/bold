import { Address, BigInt, Bytes, dataSource } from "@graphprotocol/graph-ts";
import { Collateral, InterestBatch, InterestRateBracket, Trove } from "../generated/schema";
import {
  BatchUpdated as BatchUpdatedEvent,
  TroveManager as TroveManagerContract,
  TroveOperation as TroveOperationEvent,
} from "../generated/templates/TroveManager/TroveManager";
import { BorrowerTrovesCountUpdate, updateBorrowerTrovesCount } from "./shared";

const ZERO = BigInt.fromI32(0);

// decides whether to update the flag indicating
// that a trove might be leveraged or not.
enum LeverageUpdate {
  yes,
  no,
  unchanged,
}

// see Operation enum in
// contracts/src/Interfaces/ITroveEvents.sol
//
let OP_OPEN_TROVE = 0;
let OP_CLOSE_TROVE = 1;
let OP_ADJUST_TROVE = 2;
let OP_ADJUST_TROVE_INTEREST_RATE = 3;
let OP_APPLY_PENDING_DEBT = 4;
let OP_LIQUIDATE = 5;
let OP_REDEEM_COLLATERAL = 6;
let OP_OPEN_TROVE_AND_JOIN_BATCH = 7;
let OP_SET_INTEREST_BATCH_MANAGER = 8;
let OP_REMOVE_FROM_BATCH = 9;

let FLASH_LOAN_TOPIC = Bytes.fromHexString(
  // keccak256("FlashLoan(address,address,uint256,uint256)")
  "0x0d7d75e01ab95780d3cd1c8ec0dd6c2ce19e3a20427eec8bf53283b6fb8e95f0",
);

function touchedByUser(trove: Trove, timestamp: BigInt, status: string): void {
  trove.status = status;
  trove.lastUserActionAt = timestamp;
  trove.redemptionCount = 0;
  trove.redeemedColl = ZERO;
  trove.redeemedDebt = ZERO;
}

export function handleTroveOperation(event: TroveOperationEvent): void {
  let timestamp = event.block.timestamp;
  let troveId = event.params._troveId;
  let collId = dataSource.context().getString("collId");
  let collateral = Collateral.load(collId);

  if (!collateral) {
    throw new Error("Collateral not found: " + collId);
  }

  let operation = event.params._operation;
  let tm = TroveManagerContract.bind(event.address);
  let trove: Trove | null = null;

  if (operation === OP_OPEN_TROVE) {
    trove = updateTrove(tm, troveId, timestamp, getLeverageUpdate(event));
    return;
  }

  if (operation === OP_ADJUST_TROVE) {
    trove = updateTrove(tm, troveId, timestamp, getLeverageUpdate(event));
    touchedByUser(trove, timestamp, "active");
    trove.save();
    return;
  }

  if (operation === OP_APPLY_PENDING_DEBT) {
    updateTrove(tm, troveId, timestamp, LeverageUpdate.unchanged);
    return;
  }

  if (operation === OP_OPEN_TROVE_AND_JOIN_BATCH) {
    updateTrove(tm, troveId, timestamp, getLeverageUpdate(event));
    enterBatch(collId, troveId, timestamp, tm.Troves(troveId).getInterestBatchManager());
    return;
  }

  if (operation === OP_ADJUST_TROVE_INTEREST_RATE) {
    trove = updateTrove(tm, troveId, timestamp, getLeverageUpdate(event));
    touchedByUser(trove, timestamp, "active");
    trove.save();
    return;
  }

  if (operation === OP_SET_INTEREST_BATCH_MANAGER) {
    trove = enterBatch(collId, troveId, timestamp, tm.Troves(troveId).getInterestBatchManager());
    touchedByUser(trove, timestamp, "active");
    trove.save();
    return;
  }

  if (operation === OP_REMOVE_FROM_BATCH) {
    trove = leaveBatch(collId, troveId, timestamp, event.params._annualInterestRate);
    touchedByUser(trove, timestamp, "active");
    trove.save();
    return;
  }

  if (operation === OP_REDEEM_COLLATERAL) {
    trove = updateTrove(tm, troveId, timestamp, LeverageUpdate.unchanged);
    trove.status = "redeemed";
    trove.redemptionCount += 1;
    // increasing redemption accumulators by subtracting negative amounts
    trove.redeemedColl = trove.redeemedColl.minus(event.params._collChangeFromOperation);
    trove.redeemedDebt = trove.redeemedDebt.minus(event.params._debtChangeFromOperation);
    trove.save();
    return;
  }

  if (operation === OP_CLOSE_TROVE) {
    trove = updateTrove(tm, troveId, timestamp, LeverageUpdate.unchanged);
    if (trove.interestBatch !== null) {
      leaveBatch(collId, troveId, timestamp, ZERO);
    }

    updateBorrowerTrovesCount(
      BorrowerTrovesCountUpdate.remove,
      Address.fromBytes(trove.borrower),
      collateral.collIndex,
    );

    trove.closedAt = timestamp;
    touchedByUser(trove, timestamp, "closed");
    trove.save();
    return;
  }

  if (operation === OP_LIQUIDATE) {
    trove = updateTrove(tm, troveId, timestamp, LeverageUpdate.unchanged);
    if (trove.interestBatch !== null) {
      leaveBatch(collId, troveId, timestamp, ZERO);
    }
    trove.debt = ZERO;
    trove.deposit = ZERO;
    trove.closedAt = timestamp;
    trove.status = "liquidated";
    trove.save();
    return;
  }

  throw new Error("Unsupported operation: " + operation.toString());
}

function getLeverageUpdate(event: TroveOperationEvent): LeverageUpdate {
  let receipt = event.receipt;
  let logs = receipt ? receipt.logs : [];
  for (let i = 0; i < logs.length; i++) {
    if (logs[i].topics.length > 0 && logs[i].topics[0].equals(FLASH_LOAN_TOPIC)) {
      return LeverageUpdate.yes;
    }
  }
  return LeverageUpdate.no;
}

function floorToDecimals(value: BigInt, decimals: u8): BigInt {
  let factor = BigInt.fromI32(10).pow(18 - decimals);
  return value.div(factor).times(factor);
}

function getRateFloored(rate: BigInt): BigInt {
  return floorToDecimals(rate, 3);
}

// When a trove enters a batch:
//  1. set the interest batch on the trove
//  2. set the interest rate to 0 (indicating that the trove is in a batch)
//  3. remove its debt from its rate bracket (handled at the batch level)
function enterBatch(
  collId: string,
  troveId: BigInt,
  timestamp: BigInt,
  batchManager: Address,
): Trove {
  let troveFullId = collId + ":" + troveId.toHexString();
  let batchId = collId + ":" + batchManager.toHexString();

  let trove = Trove.load(troveFullId);
  if (trove === null) {
    throw new Error("Trove not found: " + troveFullId);
  }

  updateRateBracketDebt(
    collId,
    trove.interestRate,
    ZERO, // moving rate to 0 (in batch)
    trove.debt,
    ZERO, // debt is 0 too (handled at the batch level)
  );

  trove.interestBatch = batchId;
  trove.interestRate = ZERO;
  trove.updatedAt = timestamp;
  trove.save();

  return trove;
}

// When a trove leaves a batch:
//  1. remove the interest batch on the trove
//  2. set the interest rate to the new rate
//  3. add its debt to the rate bracket of the current rate
function leaveBatch(
  collId: string,
  troveId: BigInt,
  timestamp: BigInt,
  interestRate: BigInt,
): Trove {
  let troveFullId = collId + ":" + troveId.toHexString();

  let trove = Trove.load(troveFullId);
  if (trove === null) {
    throw new Error("Trove not found: " + troveFullId);
  }

  if (trove.interestBatch === null) {
    throw new Error("Trove is not in a batch: " + troveFullId);
  }

  updateRateBracketDebt(
    collId,
    ZERO, // coming from rate 0 (in batch)
    interestRate,
    ZERO, // debt was 0 too (in batch)
    trove.debt,
  );

  trove.interestBatch = null;
  trove.interestRate = interestRate;
  trove.status = "active"; // always reset the status when leaving a batch
  trove.updatedAt = timestamp;
  trove.save();

  return trove;
}

function loadOrCreateInterestRateBracket(
  collId: string,
  rateFloored: BigInt,
): InterestRateBracket {
  let rateBracketId = collId + ":" + rateFloored.toString();
  let rateBracket = InterestRateBracket.load(rateBracketId);

  if (!rateBracket) {
    rateBracket = new InterestRateBracket(rateBracketId);
    rateBracket.collateral = collId;
    rateBracket.rate = rateFloored;
    rateBracket.totalDebt = ZERO;
  }

  return rateBracket;
}

function updateRateBracketDebt(
  collId: string,
  prevRate: BigInt,
  newRate: BigInt,
  prevDebt: BigInt,
  newDebt: BigInt,
): void {
  // remove debt from prev bracket
  if (prevRate.notEqual(ZERO)) {
    let prevRateBracket = InterestRateBracket.load(collId + ":" + getRateFloored(prevRate).toString());
    if (prevRateBracket) {
      prevRateBracket.totalDebt = prevRateBracket.totalDebt.minus(prevDebt);
      prevRateBracket.save();
    }
  }

  // add debt to new bracket
  let newRateBracket = loadOrCreateInterestRateBracket(collId, getRateFloored(newRate));
  newRateBracket.totalDebt = newRateBracket.totalDebt.plus(newDebt);
  newRateBracket.save();
}

// called by TroveNFT.mapping.ts upon minting
// we'll keep it in this file so as not to scatter the code that deals with Trove entities
export function createTrove(
  troveId: BigInt,
  borrower: Address,
  timestamp: BigInt,
): void {
  let collId = dataSource.context().getString("collId");
  let troveFullId = collId + ":" + troveId.toHexString();

  let collateral = Collateral.load(collId);
  if (!collateral) {
    throw new Error("Non-existent collateral: " + collId);
  }

  let trove = Trove.load(troveFullId);
  if (trove) {
    throw new Error("Trove already exists: " + troveFullId);
  }

  updateBorrowerTrovesCount(
    BorrowerTrovesCountUpdate.add,
    borrower,
    collateral.collIndex,
  );

  trove = new Trove(troveFullId);
  trove.borrower = borrower;
  trove.collateral = collId;
  trove.createdAt = timestamp;
  trove.debt = ZERO;
  trove.deposit = ZERO;
  trove.stake = ZERO;
  trove.status = "active";
  trove.troveId = troveId.toHexString();
  trove.updatedAt = timestamp;
  trove.lastUserActionAt = timestamp;
  trove.previousOwner = Address.zero();
  trove.redemptionCount = 0;
  trove.redeemedColl = ZERO;
  trove.redeemedDebt = ZERO;
  trove.interestRate = ZERO;
  trove.interestBatch = null;
  trove.mightBeLeveraged = false;
  trove.save();
}

function updateTrove(
  troveManagerContract: TroveManagerContract,
  troveId: BigInt,
  timestamp: BigInt,
  leverageUpdate: LeverageUpdate,
): Trove {
  let collId = dataSource.context().getString("collId");
  let collateral = Collateral.load(collId);
  if (!collateral) {
    throw new Error("Non-existent collateral: " + collId);
  }

  let troveFullId = collId + ":" + troveId.toHexString();
  let trove = Trove.load(troveFullId);
  if (!trove) {
    throw new Error("Trove not found: " + troveFullId);
  }

  let newTrove = troveManagerContract.getLatestTroveData(troveId);
  let newStake = troveManagerContract.Troves(troveId).getStake();

  // update interest rate brackets for non-batched troves
  if (trove.interestBatch === null) {
    updateRateBracketDebt(
      collId,
      trove.interestRate,
      newTrove.annualInterestRate,
      trove.debt,
      newTrove.entireDebt,
    );
  }

  trove.debt = newTrove.entireDebt;
  trove.deposit = newTrove.entireColl;
  trove.interestRate = trove.interestBatch === null ? newTrove.annualInterestRate : ZERO;
  trove.stake = newStake;

  if (leverageUpdate !== LeverageUpdate.unchanged) {
    trove.mightBeLeveraged = leverageUpdate === LeverageUpdate.yes;
  }

  trove.updatedAt = timestamp;
  trove.save();

  return trove;
}

// when a batch gets updated:
//  1. if needed, remove the debt from the previous rate bracket
//  2. update the total debt on the current rate bracket
//  3. update the batch, creating it if needed
export function handleBatchUpdated(event: BatchUpdatedEvent): void {
  let collId = dataSource.context().getString("collId");
  let batchId = collId + ":" + event.params._interestBatchManager.toHexString();
  let batch = InterestBatch.load(batchId);

  let prevRate = batch ? batch.annualInterestRate : ZERO;
  let newRate = event.params._annualInterestRate;

  let prevDebt = batch ? batch.debt : ZERO;
  let newDebt = event.params._debt;

  updateRateBracketDebt(collId, prevRate, newRate, prevDebt, newDebt);

  // update batch
  if (!batch) {
    batch = new InterestBatch(batchId);
    batch.collateral = collId;
    batch.batchManager = event.params._interestBatchManager;
  }

  batch.collateral = collId;
  batch.batchManager = event.params._interestBatchManager;
  batch.debt = newDebt;
  batch.coll = event.params._coll;
  batch.annualInterestRate = event.params._annualInterestRate;
  batch.annualManagementFee = event.params._annualManagementFee;
  batch.save();
}
