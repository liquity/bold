import { Address, BigInt, dataSource } from "@graphprotocol/graph-ts";
import { leverageZappers } from "../addresses";
import { BorrowerInfo, Collateral, InterestBatch, InterestRateBracket, Trove } from "../generated/schema";
import {
  BatchUpdated as BatchUpdatedEvent,
  TroveManager as TroveManagerContract,
  TroveOperation as TroveOperationEvent,
} from "../generated/templates/TroveManager/TroveManager";
import { TroveNFT as TroveNFTContract } from "../generated/templates/TroveManager/TroveNFT";

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

// let FLASH_LOAN_TOPIC_HASH = crypto.keccak256(
//   ByteArray.fromUTF8("FlashLoan(address,address,uint256,uint256)"),
// ).toHexString();

export function handleTroveOperation(event: TroveOperationEvent): void {
  let timestamp = event.block.timestamp;
  let troveId = event.params._troveId;
  let collId = dataSource.context().getString("collId");
  let collIndex = dataSource.context().getI32("collIndex");
  let troveFullId = collId + ":" + troveId.toHexString();

  let operation = event.params._operation;
  let tm = TroveManagerContract.bind(event.address);

  let to = event.transaction.to;
  let leverageZapper = Address.fromString(leverageZappers[collIndex]);
  let toLeverageZapper = to ? leverageZapper.equals(to) : false;

  // let hasFlashLoan = false;
  // let receipt = event.receipt;
  // if (receipt) {
  //   for (let i = 0; i < receipt.logs.length; i++) {
  //     const currentLog = receipt.logs[i];
  //     const topicHash = currentLog.topics[0].toHexString();
  //     if (topicHash == FLASH_LOAN_TOPIC_HASH) {
  //       hasFlashLoan = true;
  //       break;
  //     }
  //   }
  // }

  switch (operation) {
    case OP_OPEN_TROVE:
    case OP_ADJUST_TROVE:
    case OP_ADJUST_TROVE_INTEREST_RATE:
    case OP_APPLY_PENDING_DEBT:
    case OP_REDEEM_COLLATERAL:
      updateTrove(tm, troveId, timestamp, toLeverageZapper);
      break;

    case OP_OPEN_TROVE_AND_JOIN_BATCH:
      updateTrove(tm, troveId, timestamp, toLeverageZapper);
      enterBatch(
        collId,
        troveId,
        tm.Troves(troveId).getInterestBatchManager(),
      );
      break;

    case OP_SET_INTEREST_BATCH_MANAGER:
      enterBatch(
        collId,
        troveId,
        tm.Troves(troveId).getInterestBatchManager(),
      );
      break;

    case OP_REMOVE_FROM_BATCH:
      leaveBatch(collId, troveId, event.params._annualInterestRate);
      break;

    case OP_CLOSE_TROVE:
    case OP_LIQUIDATE:
      updateTrove(tm, troveId, timestamp, toLeverageZapper);

      let trove = Trove.load(troveFullId);
      if (!trove) {
        throw new Error("Trove not found: " + troveFullId);
      }
      if (trove.interestBatch !== null) {
        leaveBatch(collId, troveId, BigInt.fromI32(0));
      }
      trove.closedAt = timestamp;
      trove.status = operation === OP_LIQUIDATE ? "closedByLiquidation" : "closedByOwner";
      trove.save();
      break;
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

  // leave the previous batch if needed
  if (trove.interestBatch !== null) {
    leaveBatch(collId, troveId, BigInt.fromI32(0));
  }

  let batch = InterestBatch.load(batchId);
  if (!batch) {
    throw new Error("Batch not found: " + batchId);
  }

  updateRateBracketDebt(
    collId,
    trove.interestRate,
    BigInt.fromI32(0), // moving rate to 0 (in batch)
    trove.debt,
    BigInt.fromI32(0), // debt is 0 too (handled at the batch level)
  );

  trove.interestBatch = batchId;
  trove.interestRate = BigInt.fromI32(0);
  trove.save();
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

  updateRateBracketDebt(
    collId,
    BigInt.fromI32(0), // coming from rate 0 (in batch)
    interestRate,
    BigInt.fromI32(0), // debt was 0 too (in batch)
    trove.debt,
  );

  trove.interestBatch = null;
  trove.interestRate = interestRate;
  trove.save();
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
    rateBracket.totalDebt = BigInt.fromI32(0);
  }

  return rateBracket;
}

function updateRateBracketDebt(
  collId: string,
  prevRate: BigInt | null,
  newRate: BigInt,
  prevDebt: BigInt,
  newDebt: BigInt,
): void {
  let prevRateFloored = prevRate ? getRateFloored(prevRate) : null;
  let newRateFloored = getRateFloored(newRate);

  // remove debt from prev bracket
  if (prevRateFloored !== null) {
    let prevRateBracket = InterestRateBracket.load(collId + ":" + prevRateFloored.toString());
    if (prevRateBracket) {
      prevRateBracket.totalDebt = prevRateBracket.totalDebt.minus(prevDebt);
      prevRateBracket.save();
    }
  }

  // add debt to new bracket
  let newRateBracket = loadOrCreateInterestRateBracket(collId, newRateFloored);
  newRateBracket.totalDebt = newRateBracket.totalDebt.plus(newDebt);
  newRateBracket.save();
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
  usedLeverageZapper: boolean,
): void {
  let collId = dataSource.context().getString("collId");

  let collateral = Collateral.load(collId);
  if (!collateral) {
    throw new Error("Non-existent collateral: " + collId);
  }

  let troveFullId = collId + ":" + troveId.toHexString();
  let trove = Trove.load(troveFullId);

  let prevDebt = trove ? trove.debt : BigInt.fromI32(0);
  let prevDeposit = trove ? trove.deposit : BigInt.fromI32(0);
  let prevInterestRate = trove ? trove.interestRate : null;

  let troveData = troveManagerContract.getLatestTroveData(troveId);
  let newDebt = troveData.entireDebt;
  let newDeposit = troveData.entireColl;
  let newInterestRate = troveData.annualInterestRate;
  let newStake = troveManagerContract.Troves(troveId).getStake();

  collateral.totalDeposited = collateral.totalDeposited.minus(prevDeposit).plus(newDeposit);
  collateral.totalDebt = collateral.totalDebt.minus(prevDebt).plus(newDebt);
  collateral.save();

  // create trove if needed
  if (!trove) {
    let borrower = TroveNFTContract.bind(Address.fromBytes(
      dataSource.context().getBytes("address:troveNft"),
    )).ownerOf(troveId);

    // create borrower info if needed
    let borrowerInfo = BorrowerInfo.load(borrower.toHexString());
    if (!borrowerInfo) {
      borrowerInfo = new BorrowerInfo(borrower.toHexString());
      borrowerInfo.troves = 0;

      let totalCollaterals = dataSource.context().getI32("totalCollaterals");
      borrowerInfo.trovesByCollateral = (new Array<i32>(totalCollaterals)).fill(0);
    }

    // update borrower info
    let trovesByColl = borrowerInfo.trovesByCollateral;
    trovesByColl[collateral.collIndex] += 1;
    borrowerInfo.trovesByCollateral = trovesByColl;
    borrowerInfo.troves += 1;
    borrowerInfo.save();

    // create trove
    trove = new Trove(troveFullId);
    trove.borrower = borrower;
    trove.collateral = collId;
    trove.createdAt = timestamp;
    trove.debt = newDebt;
    trove.deposit = newDeposit;
    trove.interestRate = trove.interestBatch === null
      ? newInterestRate
      : BigInt.fromI32(0);
    trove.stake = newStake;
    trove.status = "active";
    trove.troveId = troveId.toHexString();
    trove.updatedAt = timestamp;
    trove.usedLeverageZapper = usedLeverageZapper;
    trove.save();
  }

  // update interest rate brackets for non-batched troves
  if (trove.interestBatch === null) {
    updateRateBracketDebt(
      collId,
      prevInterestRate,
      newInterestRate,
      prevDebt,
      newDebt,
    );
  }

  trove.debt = newDebt;
  trove.deposit = newDeposit;
  trove.interestRate = trove.interestBatch === null
    ? newInterestRate
    : BigInt.fromI32(0);
  trove.stake = newStake;
  trove.updatedAt = timestamp;
  trove.usedLeverageZapper = usedLeverageZapper;
  trove.save();
}

// when a batch gets updated:
//  1. if needed, remove the debt from the previous rate bracket
//  2. update the total debt on the current rate bracket
//  3. update the batch, creating it if needed
export function handleBatchUpdated(event: BatchUpdatedEvent): void {
  let collId = dataSource.context().getString("collId");
  let batchId = collId + ":" + event.params._interestBatchManager.toHexString();
  let batch = InterestBatch.load(batchId);

  let prevRate = batch ? batch.annualInterestRate : null;
  let newRate = event.params._annualInterestRate;

  let prevDebt = batch ? batch.debt : BigInt.fromI32(0);
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
