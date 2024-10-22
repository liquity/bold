import { Address, BigInt, dataSource } from "@graphprotocol/graph-ts";
import { BorrowerInfo, Collateral, InterestBatch, InterestRateBracket, Trove } from "../generated/schema";
import {
  BatchedTroveUpdated as BatchedTroveUpdatedEvent,
  BatchUpdated as BatchUpdatedEvent,
  TroveManager as TroveManagerContract,
  TroveOperation as TroveOperationEvent,
  TroveUpdated as TroveUpdatedEvent,
} from "../generated/templates/TroveManager/TroveManager";
import { TroveNFT as TroveNFTContract } from "../generated/templates/TroveManager/TroveNFT";

// see Operation enum in
// contracts/src/Interfaces/ITroveEvents.sol
//
// let OP_OPEN_TROVE = 0;
let OP_CLOSE_TROVE = 1;
// let OP_ADJUST_TROVE = 2;
// let OP_ADJUST_TROVE_INTEREST_RATE = 3;
// let OP_APPLY_PENDING_DEBT = 4;
let OP_LIQUIDATE = 5;
// let OP_REDEEM_COLLATERAL = 6;
let OP_OPEN_TROVE_AND_JOIN_BATCH = 7;
let OP_SET_INTEREST_BATCH_MANAGER = 8;
let OP_REMOVE_FROM_BATCH = 9;

export function handleTroveOperation(event: TroveOperationEvent): void {
  let troveId = event.params._troveId;
  let collId = dataSource.context().getString("collId");
  let troveFullId = collId + ":" + troveId.toHexString();

  let trove = Trove.load(troveFullId);
  if (!trove) {
    throw new Error("Trove not found: " + troveFullId);
  }

  let operation = event.params._operation;

  if (operation === OP_REMOVE_FROM_BATCH) {
    leaveBatch(collId, troveId, event.params._annualInterestRate);
  }

  if (operation === OP_OPEN_TROVE_AND_JOIN_BATCH || operation === OP_SET_INTEREST_BATCH_MANAGER) {
    enterBatch(
      collId,
      troveId,
      TroveManagerContract
        .bind(event.address)
        .Troves(event.params._troveId)
        .getInterestBatchManager(),
    );
  }

  if (operation === OP_CLOSE_TROVE) {
    trove.closedAt = event.block.timestamp;
    trove.status = "closedByOwner";
    trove.save();
    return;
  }

  if (operation === OP_LIQUIDATE) {
    trove.closedAt = event.block.timestamp;
    trove.status = "closedByLiquidation";
    trove.save();
    return;
  }
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
function enterBatch(collId: string, troveId: BigInt, batchManager: Address): void {
  let troveFullId = collId + ":" + troveId.toHexString();
  let batchId = collId + ":" + batchManager.toHexString();

  let trove = Trove.load(troveFullId);
  if (!trove) {
    throw new Error("Trove not found: " + troveFullId);
  }

  let batch = InterestBatch.load(batchId);
  if (!batch) {
    throw new Error("Batch not found: " + batchId);
  }

  trove.interestBatch = batchId;
  trove.interestRate = BigInt.fromI32(0); // interest rate is set to 0 when in a batch

  let rateBracketId = collId + ":" + getRateFloored(batch.annualInterestRate).toString();
  let rateBracket = InterestRateBracket.load(rateBracketId);

  // the rate bracket must exist since it gets created by handleBatchUpdated()
  if (!rateBracket) {
    throw new Error("Rate bracket not found: " + rateBracketId);
  }

  // remove the debt from the rate bracket (handled by the batch updates from this point)
  rateBracket.totalDebt = rateBracket.totalDebt.minus(trove.debt);

  trove.save();
  rateBracket.save();
}

// When a trove leaves a batch:
//  1. remove the interest batch on the trove
//  2. set the interest rate to the new rate
//  3. add its debt to the rate bracket of the current rate
function leaveBatch(collId: string, troveId: BigInt, interestRate: BigInt): void {
  let troveFullId = collId + ":" + troveId.toHexString();

  let trove = Trove.load(troveFullId);
  if (trove === null) {
    throw new Error("Trove not found: " + troveFullId);
  }

  let batchId = trove.interestBatch;
  if (batchId === null) {
    throw new Error("Trove is not in a batch: " + troveFullId);
  }

  let batch = InterestBatch.load(batchId);
  if (batch === null) {
    throw new Error("Batch not found: " + batchId);
  }

  trove.interestBatch = null;
  trove.interestRate = interestRate;

  let rateBracketId = collId + ":" + getRateFloored(batch.annualInterestRate).toString();
  let rateBracket = InterestRateBracket.load(rateBracketId);

  // the rate bracket must exist since it gets created by handleBatchUpdated()
  if (!rateBracket) {
    throw new Error("Rate bracket not found: " + rateBracketId);
  }

  // add the debt to the rate bracket of the new rate
  rateBracket.totalDebt = rateBracket.totalDebt.plus(trove.debt);

  trove.save();
  rateBracket.save();
}

function loadOrCreateInterestRateBracket(
  collId: string,
  rateFloored: BigInt,
): InterestRateBracket {
  let rateBracketId = collId + ":" + rateFloored.toString();
  let rateBracket = InterestRateBracket.load(rateBracketId);

  if (!rateBracket) {
    rateBracket = new InterestRateBracket(rateBracketId);
    rateBracket.rate = rateFloored;
    rateBracket.totalDebt = BigInt.fromI32(0);
    rateBracket.collateral = collId;
  }

  return rateBracket;
}

// When a trove gets updated (either on TroveUpdated or BatchedTroveUpdated):
//  1. update the collateral total deposited & debt
//  2. create the trove if it doesn't exist
//  3. create the borrower if it doesn't exist
//  4. update the borrower's total trove count & trove count by collateral
//  5. for non-batched troves, update the prev & current interest rate brackets
//  6. update the trove's deposit, debt & stake
function updateTrove(
  troveManagerContract: TroveManagerContract,
  troveId: BigInt,
  timestamp: BigInt,
): void {
  let collId = dataSource.context().getString("collId");
  let collateral = Collateral.load(collId);
  if (!collateral) {
    throw new Error("Non-existent collateral: " + collId);
  }

  let troveData = troveManagerContract.getLatestTroveData(troveId);
  let newStake = troveManagerContract.Troves(troveId).getStake();

  let newInterestRate = troveData.annualInterestRate;
  let newDeposit = troveData.entireColl;
  let newDebt = troveData.recordedDebt;

  let troveFullId = collId + ":" + troveId.toHexString();
  let trove = Trove.load(troveFullId);

  // previous & new rates, floored to the nearest 0.1% (rate brackets)
  let prevRateFloored = trove
    ? getRateFloored(trove.interestRate)
    : null;

  let rateFloored = getRateFloored(newInterestRate);

  let prevDeposit = trove ? trove.deposit : BigInt.fromI32(0);

  let prevDebt = trove ? trove.debt : BigInt.fromI32(0);

  collateral.totalDeposited = collateral.totalDeposited.minus(prevDeposit).plus(newDeposit);
  collateral.totalDebt = collateral.totalDebt.minus(prevDebt).plus(newDebt);
  collateral.save();

  // create trove if needed
  if (!trove) {
    let borrowerAddress = TroveNFTContract.bind(Address.fromBytes(
      dataSource.context().getBytes("address:troveNft"),
    )).ownerOf(troveId);

    // create borrower if needed
    let borrowerInfo = BorrowerInfo.load(borrowerAddress.toHexString());
    if (!borrowerInfo) {
      borrowerInfo = new BorrowerInfo(borrowerAddress.toHexString());
      borrowerInfo.troves = 0;

      let totalCollaterals = dataSource.context().getI32("totalCollaterals");
      borrowerInfo.trovesByCollateral = (new Array<i32>(totalCollaterals)).fill(0);
      borrowerInfo.save();
    }

    trove = new Trove(troveFullId);
    trove.collateral = dataSource.context().getString("collId");
    trove.troveId = troveId.toHexString();
    trove.createdAt = timestamp;
    trove.borrower = borrowerAddress;
    trove.status = "active";

    borrowerInfo.troves += 1;

    let trovesByColl = borrowerInfo.trovesByCollateral;
    trovesByColl[collateral.collIndex] += 1;
    borrowerInfo.trovesByCollateral = trovesByColl;

    borrowerInfo.save();
  }

  // update interest rate brackets
  let inBatch = troveManagerContract.Troves(troveId).getInterestBatchManager() !== Address.zero();
  if (!inBatch) {
    let rateBracket = loadOrCreateInterestRateBracket(collId, rateFloored);
    if (!prevRateFloored || rateFloored.notEqual(prevRateFloored)) {
      let prevRateBracket = prevRateFloored
        ? InterestRateBracket.load(collId + ":" + prevRateFloored.toString())
        : null;

      if (prevRateBracket) {
        prevRateBracket.totalDebt = prevRateBracket.totalDebt.minus(trove.debt);
        prevRateBracket.save();
      }

      rateBracket.totalDebt = rateBracket.totalDebt.plus(newDebt);
    } else {
      rateBracket.totalDebt = rateBracket.totalDebt.minus(trove.debt).plus(newDebt);
    }

    rateBracket.save();

    trove.interestRate = newInterestRate;
  }

  trove.deposit = newDeposit;
  trove.debt = newDebt;
  trove.stake = newStake;

  trove.save();
}

export function handleTroveUpdated(event: TroveUpdatedEvent): void {
  updateTrove(
    TroveManagerContract.bind(event.address),
    event.params._troveId,
    event.block.timestamp,
  );
}

export function handleBatchedTroveUpdated(event: BatchedTroveUpdatedEvent): void {
  updateTrove(
    TroveManagerContract.bind(event.address),
    event.params._troveId,
    event.block.timestamp,
  );
}

// when a batch gets updated:
//  1. if needed, remove the debt from the previous rate bracket
//  2. update the total debt on the current rate bracket
//  3. update the batch, creating it if needed
export function handleBatchUpdated(event: BatchUpdatedEvent): void {
  let collId = dataSource.context().getString("collId");
  let batchId = collId + ":" + event.params._interestBatchManager.toHexString();
  let batch = InterestBatch.load(batchId);
  let rateFloored = getRateFloored(event.params._annualInterestRate);
  let prevRateFloored = batch ? getRateFloored(batch.annualInterestRate) : null;

  // remove the debt from the previous rate bracket
  if (batch && prevRateFloored && rateFloored.notEqual(prevRateFloored)) {
    let prevRateBracket = InterestRateBracket.load(collId + ":" + prevRateFloored.toString());
    if (prevRateBracket) {
      prevRateBracket.totalDebt = prevRateBracket.totalDebt.minus(batch.debt);
      prevRateBracket.save();
    }
  }

  // update the total debt of the current rate bracket
  let rateBracket = loadOrCreateInterestRateBracket(collId, rateFloored);
  rateBracket.totalDebt = rateBracket.totalDebt
    .minus(batch ? batch.debt : BigInt.fromI32(0))
    .plus(event.params._debt);
  rateBracket.save();

  // update batch
  if (!batch) {
    batch = new InterestBatch(batchId);
    batch.collateral = collId;
    batch.batchManager = event.params._interestBatchManager;
  }
  batch.collateral = collId;
  batch.batchManager = event.params._interestBatchManager;
  batch.debt = event.params._debt;
  batch.coll = event.params._coll;
  batch.annualInterestRate = event.params._annualInterestRate;
  batch.annualManagementFee = event.params._annualManagementFee;
  batch.save();
}
