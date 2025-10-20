import { Address, BigInt, Bytes, dataSource, ethereum } from "@graphprotocol/graph-ts";
import { InterestBatch, InterestRateBracket, Trove } from "../generated/schema";
import {
  BatchedTroveUpdated as BatchedTroveUpdatedEvent,
  BatchUpdated as BatchUpdatedEvent,
  TroveOperation as TroveOperationEvent,
  TroveUpdated as TroveUpdatedEvent,
} from "../generated/templates/TroveManager/TroveManager";

// see Operation enum in
// contracts/src/Interfaces/ITroveEvents.sol
//
const OP_OPEN_TROVE = 0;
const OP_CLOSE_TROVE = 1;
const OP_ADJUST_TROVE = 2;
// const OP_ADJUST_TROVE_INTEREST_RATE = 3;
const OP_APPLY_PENDING_DEBT = 4;
const OP_LIQUIDATE = 5;
const OP_REDEEM_COLLATERAL = 6;
const OP_OPEN_TROVE_AND_JOIN_BATCH = 7;
// const OP_SET_INTEREST_BATCH_MANAGER = 8;
// const OP_REMOVE_FROM_BATCH = 9;

const FLASH_LOAN_TOPIC = Bytes.fromHexString(
  // keccak256("FlashLoan(address,address,uint256,uint256)")
  "0x0d7d75e01ab95780d3cd1c8ec0dd6c2ce19e3a20427eec8bf53283b6fb8e95f0",
);

function decodeAddress(data: Bytes, i: i32 = 0): ethereum.Value {
  return ethereum.Value.fromAddress(
    Address.fromBytes(
      Bytes.fromUint8Array(
        data.subarray(i * 32 + 12, i * 32 + 32),
      ),
    ),
  );
}

function decodeUint8(data: Bytes, i: i32 = 0): ethereum.Value {
  return ethereum.Value.fromI32(
    data[i * 32 + 31],
  );
}

function decodeUint256(data: Bytes, i: i32 = 0): ethereum.Value {
  return ethereum.Value.fromUnsignedBigInt(
    BigInt.fromUnsignedBytes(
      Bytes.fromUint8Array(
        data.subarray(i * 32, i * 32 + 32).reverse(),
      ),
    ),
  );
}

function getBatchUpdatedEventFrom(batchedTroveUpdatedEvent: BatchedTroveUpdatedEvent): BatchUpdatedEvent {
  let receipt = batchedTroveUpdatedEvent.receipt;

  if (!receipt) {
    throw new Error("Missing TX receipt");
  }

  let batchUpdatedLogIndex = -1;

  for (let i = 0; i < receipt.logs.length; ++i) {
    if (receipt.logs[i].logIndex.equals(batchedTroveUpdatedEvent.logIndex.plus(BigInt.fromI32(2)))) {
      batchUpdatedLogIndex = i;
      break;
    }
  }

  if (batchUpdatedLogIndex < 0) {
    throw new Error("Missing BatchUpdated log");
  }

  let batchUpdatedLog = receipt.logs[batchUpdatedLogIndex];

  return new BatchUpdatedEvent(
    batchUpdatedLog.address,
    batchUpdatedLog.logIndex,
    batchUpdatedLog.transactionLogIndex,
    batchUpdatedLog.logType,
    batchedTroveUpdatedEvent.block,
    batchedTroveUpdatedEvent.transaction,
    [
      new ethereum.EventParam("_interestBatchManager", decodeAddress(batchUpdatedLog.topics[1])),
      new ethereum.EventParam("_operation", decodeUint8(batchUpdatedLog.data, 0)),
      new ethereum.EventParam("_debt", decodeUint256(batchUpdatedLog.data, 1)),
      new ethereum.EventParam("_coll", decodeUint256(batchUpdatedLog.data, 2)),
      new ethereum.EventParam("_annualInterestRate", decodeUint256(batchUpdatedLog.data, 3)),
      new ethereum.EventParam("_annualManagementFee", decodeUint256(batchUpdatedLog.data, 4)),
      new ethereum.EventParam("_totalDebtShares", decodeUint256(batchUpdatedLog.data, 5)),
      new ethereum.EventParam("_debtIncreaseFromUpfrontFee", decodeUint256(batchUpdatedLog.data, 6)),
    ],
    batchedTroveUpdatedEvent.receipt,
  );
}

export function handleTroveUpdated(event: TroveUpdatedEvent): void {
  let collId = dataSource.context().getString("collId");
  let troveId = event.params._troveId;
  let troveFullId = collId + ":" + troveId.toHexString();
  let trove = Trove.load(troveFullId);

  if (!trove) {
    throw new Error("Trove not found: " + troveFullId);
  }

  updateRateBracketDebt(
    collId,
    trove.interestRate,
    event.params._annualInterestRate,
    trove.debt,
    event.params._debt,
    trove.updatedAt,
    event.block.timestamp,
  );

  trove.debt = event.params._debt;
  trove.deposit = event.params._coll;
  trove.stake = event.params._stake;
  trove.interestRate = event.params._annualInterestRate;
  trove.interestBatch = null;
  trove.updatedAt = event.block.timestamp;
  trove.save();
}

export function handleBatchedTroveUpdated(batchedTroveUpdatedEvent: BatchedTroveUpdatedEvent): void {
  let batchUpdatedEvent = getBatchUpdatedEventFrom(batchedTroveUpdatedEvent);
  let collId = dataSource.context().getString("collId");
  let troveId = batchedTroveUpdatedEvent.params._troveId;
  let troveFullId = collId + ":" + troveId.toHexString();
  let trove = Trove.load(troveFullId);

  if (!trove) {
    throw new Error("Trove not found: " + troveFullId);
  }

  updateRateBracketDebt(
    collId,
    trove.interestRate,
    BigInt.zero(),
    trove.debt,
    BigInt.zero(), // batched debt handled at batch level
    trove.updatedAt,
    batchedTroveUpdatedEvent.block.timestamp,
  );

  trove.debt = batchUpdatedEvent.params._totalDebtShares.notEqual(BigInt.zero())
    ? batchUpdatedEvent.params._debt
      .times(batchedTroveUpdatedEvent.params._batchDebtShares)
      .div(batchUpdatedEvent.params._totalDebtShares)
    : BigInt.zero();
  trove.deposit = batchedTroveUpdatedEvent.params._coll;
  trove.stake = batchedTroveUpdatedEvent.params._stake;
  trove.interestRate = BigInt.zero();
  trove.interestBatch = collId + ":" + batchedTroveUpdatedEvent.params._interestBatchManager.toHexString();
  trove.updatedAt = batchedTroveUpdatedEvent.block.timestamp;
  trove.save();
}

export function handleTroveOperation(event: TroveOperationEvent): void {
  let collId = dataSource.context().getString("collId");
  let troveId = event.params._troveId;
  let troveFullId = collId + ":" + troveId.toHexString();
  let trove = Trove.load(troveFullId);

  if (!trove) {
    throw new Error("Trove not found: " + troveFullId);
  }

  let operation = event.params._operation;
  let timestamp = event.block.timestamp;

  // Opening
  if (operation === OP_OPEN_TROVE || operation === OP_OPEN_TROVE_AND_JOIN_BATCH) {
    trove.createdAt = timestamp;
  }

  // Closing
  if (operation === OP_CLOSE_TROVE || operation === OP_LIQUIDATE) {
    trove.closedAt = timestamp;
  }

  // User action
  if (operation !== OP_REDEEM_COLLATERAL && operation !== OP_LIQUIDATE && operation !== OP_APPLY_PENDING_DEBT) {
    trove.lastUserActionAt = timestamp;
    trove.redemptionCount = 0;
    trove.redeemedColl = BigInt.zero();
    trove.redeemedDebt = BigInt.zero();
    trove.status = operation === OP_CLOSE_TROVE ? "closed" : "active";
  }

  // Redemption
  if (operation === OP_REDEEM_COLLATERAL) {
    trove.status = "redeemed";
    trove.redemptionCount += 1;
    // increasing redemption accumulators by subtracting negative amounts
    trove.redeemedColl = trove.redeemedColl.minus(event.params._collChangeFromOperation);
    trove.redeemedDebt = trove.redeemedDebt.minus(event.params._debtChangeFromOperation);
  }

  // Liquidation
  if (operation === OP_LIQUIDATE) {
    trove.status = "liquidated";
  }

  // Infer leverage flag on opening & adjustment
  if (operation === OP_OPEN_TROVE || operation === OP_OPEN_TROVE_AND_JOIN_BATCH || operation === OP_ADJUST_TROVE) {
    trove.mightBeLeveraged = inferLeverage(event);
  }

  trove.save();
}

function inferLeverage(event: TroveOperationEvent): boolean {
  let receipt = event.receipt;

  if (!receipt) {
    throw new Error("Missing TX receipt");
  }

  return !!receipt.logs.some(
    (log) => (
      log.topics.length > 0
      && log.topics[0].equals(FLASH_LOAN_TOPIC)
    ),
  );
}

function floorToDecimals(value: BigInt, decimals: u8): BigInt {
  let factor = BigInt.fromI32(10).pow(18 - decimals);
  return value.div(factor).times(factor);
}

function getRateFloored(rate: BigInt): BigInt {
  return floorToDecimals(rate, 3);
}

function updateRateBracketDebt(
  collId: string,
  prevRate: BigInt,
  newRate: BigInt,
  prevDebt: BigInt,
  newDebt: BigInt,
  prevTime: BigInt,
  newTime: BigInt,
): void {
  let rateBracket: InterestRateBracket | null = null;

  // remove debt from prev bracket
  if (prevRate.notEqual(BigInt.zero())) {
    let rateFloored = getRateFloored(prevRate);
    let rateBracketId = collId + ":" + rateFloored.toString();

    if (!(rateBracket = InterestRateBracket.load(rateBracketId))) {
      throw new Error("InterestRateBracket not found: " + rateBracketId);
    }

    rateBracket.totalDebt = rateBracket.totalDebt
      .minus(prevDebt);
    rateBracket.pendingDebtTimesOneYearD36 = rateBracket.pendingDebtTimesOneYearD36
      .plus(newTime.minus(rateBracket.updatedAt).times(rateBracket.sumDebtTimesRateD36))
      .minus(newTime.minus(prevTime).times(prevDebt).times(prevRate));
    rateBracket.sumDebtTimesRateD36 = rateBracket.sumDebtTimesRateD36
      .minus(prevDebt.times(prevRate));
    rateBracket.updatedAt = newTime;
  }

  // add debt to new bracket
  if (newRate.notEqual(BigInt.zero())) {
    let rateFloored = getRateFloored(newRate);
    let rateBracketId = collId + ":" + rateFloored.toString();

    if (!rateBracket || rateBracket.id !== rateBracketId) {
      if (rateBracket) rateBracket.save();

      if (!(rateBracket = InterestRateBracket.load(rateBracketId))) {
        rateBracket = new InterestRateBracket(rateBracketId);
        rateBracket.collateral = collId;
        rateBracket.rate = rateFloored;
        rateBracket.totalDebt = BigInt.zero();
        rateBracket.sumDebtTimesRateD36 = BigInt.zero();
        rateBracket.pendingDebtTimesOneYearD36 = BigInt.zero();
        rateBracket.updatedAt = newTime;
      }
    }

    rateBracket.totalDebt = rateBracket.totalDebt
      .plus(newDebt);
    rateBracket.pendingDebtTimesOneYearD36 = rateBracket.pendingDebtTimesOneYearD36
      .plus(newTime.minus(rateBracket.updatedAt).times(rateBracket.sumDebtTimesRateD36));
    rateBracket.sumDebtTimesRateD36 = rateBracket.sumDebtTimesRateD36
      .plus(newDebt.times(newRate));
    rateBracket.updatedAt = newTime;
  }

  if (rateBracket) rateBracket.save();
}

export function handleBatchUpdated(event: BatchUpdatedEvent): void {
  let collId = dataSource.context().getString("collId");
  let batchId = collId + ":" + event.params._interestBatchManager.toHexString();
  let batch = InterestBatch.load(batchId);

  if (!batch) {
    batch = new InterestBatch(batchId);
    batch.collateral = collId;
    batch.batchManager = event.params._interestBatchManager;
    batch.annualInterestRate = BigInt.zero();
    batch.debt = BigInt.zero();
    batch.updatedAt = event.block.timestamp;
  }

  updateRateBracketDebt(
    collId,
    batch.annualInterestRate,
    event.params._annualInterestRate,
    batch.debt,
    event.params._debt,
    batch.updatedAt,
    event.block.timestamp,
  );

  batch.debt = event.params._debt;
  batch.coll = event.params._coll;
  batch.annualInterestRate = event.params._annualInterestRate;
  batch.annualManagementFee = event.params._annualManagementFee;
  batch.updatedAt = event.block.timestamp;
  batch.save();
}
