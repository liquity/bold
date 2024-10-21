import { Address, BigInt, dataSource } from "@graphprotocol/graph-ts";
import { BorrowerInfo, Collateral, InterestBatch, InterestRateBracket, Trove } from "../generated/schema";
import {
  BatchedTroveUpdated as BatchedTroveUpdatedEvent,
  BatchUpdated as BatchUpdatedEvent,
  TroveManager as TroveManagerContract,
  TroveOperation as TroveOperationEvent,
  TroveOperation__Params,
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
// let OP_LIQUIDATE = 5;
// let OP_REDEEM_COLLATERAL = 6;
// let OP_OPEN_TROVE_AND_JOIN_BATCH = 7;
// let OP_SET_INTEREST_BATCH_MANAGER = 8;
let OP_REMOVE_FROM_BATCH = 9;

// A note on how Trove.batch is updated from two different places:
// 1. handleTroveOperation() with OP_REMOVE_FROM_BATCH removes the batch manager
//   of a trove. This event gets called by removeFromBatch().
// 2. handleTroveOperation() with OP_OPEN_TROVE_AND_JOIN_BATCH or
//   OP_SET_INTEREST_BATCH_MANAGER cannot be used to set the batch manager,
//   because the batch manager address is not present in the event parameters
//   and there is no easy way to get this address from the contract.
// 3. So we are using handleBatchedTroveUpdated() to set the batch manager of a
//    trove. This event contains the batch manager address, and gets called by
//    both openTroveAndJoinBatch() and setInterestBatchManager().

function floorToDecimals(value: BigInt, decimals: u8): BigInt {
  let factor = BigInt.fromI32(10).pow(18 - decimals);
  return value.div(factor).times(factor);
}

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
    trove.batch = null;
    trove.interestRate = event.params._annualInterestRate;
    trove.save();
    return;
  }

  if (operation === OP_CLOSE_TROVE) {
    trove.closedAt = event.block.timestamp;

    // update rate bracket
    let rateFloored = floorToDecimals(event.params._annualInterestRate, 3);
    let rateBracket = InterestRateBracket.load(collId + ":" + rateFloored.toString());
    if (rateBracket) {
      rateBracket.totalDebt = rateBracket.totalDebt.minus(trove.debt);
      rateBracket.totalTroves = rateBracket.totalTroves - 1;
      rateBracket.save();
    }

    trove.interestRate = BigInt.fromI32(0);
    trove.save();
    return;
  }
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
    rateBracket.totalTroves = 0;
  }

  return rateBracket;
}

function updateTrove(
  troveManagerAddress: Address,
  troveId: BigInt,
  timestamp: BigInt,
  stake: BigInt,
  setBatchManager: Address | null,
): void {
  let collId = dataSource.context().getString("collId");

  let troveData = TroveManagerContract.bind(troveManagerAddress).getLatestTroveData(troveId);

  let annualInterestRate = troveData.annualInterestRate;
  let deposit = troveData.entireColl;
  let debt = troveData.recordedDebt;

  let troveFullId = collId + ":" + troveId.toHexString();

  let collateral = Collateral.load(collId);

  // should never happen
  if (!collateral) {
    return;
  }

  let trove = Trove.load(troveFullId);

  // previous & new rates, floored to the nearest 0.1% (rate brackets)
  let prevRateFloored = trove ? floorToDecimals(trove.interestRate, 3) : null;
  let rateFloored = floorToDecimals(annualInterestRate, 3);

  let prevDeposit = trove ? trove.deposit : BigInt.fromI32(0);

  let prevDebt = trove ? trove.debt : BigInt.fromI32(0);

  collateral.totalDeposited = collateral.totalDeposited.minus(prevDeposit).plus(deposit);
  collateral.totalDebt = collateral.totalDebt.minus(prevDebt).plus(debt);
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
    trove.troveId = troveId.toHexString();
    trove.createdAt = timestamp;
    trove.borrower = borrowerAddress;
    borrowerInfo.troves += 1;

    let trovesByColl = borrowerInfo.trovesByCollateral;
    trovesByColl[collateral.collIndex] += 1;
    borrowerInfo.trovesByCollateral = trovesByColl;

    borrowerInfo.save();
  }

  // update interest rate brackets
  let rateBracket = loadOrCreateInterestRateBracket(collId, rateFloored);
  if (!prevRateFloored || rateFloored.notEqual(prevRateFloored)) {
    let prevRateBracket = prevRateFloored
      ? InterestRateBracket.load(collId + ":" + prevRateFloored.toString())
      : null;
    if (prevRateBracket) {
      prevRateBracket.totalDebt = prevRateBracket.totalDebt.minus(trove.debt);
      prevRateBracket.totalTroves = prevRateBracket.totalTroves - 1;
      prevRateBracket.save();
    }

    rateBracket.totalDebt = rateBracket.totalDebt.plus(debt);
    rateBracket.totalTroves = rateBracket.totalTroves + 1;
  } else {
    rateBracket.totalDebt = rateBracket.totalDebt.minus(trove.debt).plus(debt);
  }

  rateBracket.save();

  trove.deposit = deposit;
  trove.debt = debt;
  trove.interestRate = annualInterestRate;
  trove.collateral = dataSource.context().getString("collId");
  trove.stake = stake;

  if (setBatchManager) {
    trove.batch = collId + ":" + setBatchManager.toHexString();
  }

  trove.save();
}

export function handleTroveUpdated(event: TroveUpdatedEvent): void {
  updateTrove(
    event.address,
    event.params._troveId,
    event.block.timestamp,
    event.params._stake,
    null,
  );
}

export function handleBatchedTroveUpdated(event: BatchedTroveUpdatedEvent): void {
  updateTrove(
    event.address,
    event.params._troveId,
    event.block.timestamp,
    event.params._stake,
    event.params._interestBatchManager,
  );
}

export function handleBatchUpdated(event: BatchUpdatedEvent): void {
  let collId = dataSource.context().getString("collId");
  let batchId = collId + ":" + event.params._interestBatchManager.toHexString();
  let batch = InterestBatch.load(batchId);

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
