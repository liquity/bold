import { Address, BigInt, dataSource, log } from "@graphprotocol/graph-ts";
import { InterestRateBracket, Trove } from "../generated/schema";
import {
  TroveOperation as TroveOperationEvent,
  TroveUpdated as TroveUpdatedEvent,
} from "../generated/TroveManager/TroveManager";

// see Operation enum in
// contracts/src/Interfaces/ITroveEvents.sol
let OP_CLOSE_TROVE = 1;
// let OP_OPEN_TROVE = 0;
// let OP_ADJUST_TROVE = 2;
// let OP_ADJUST_TROVE_INTEREST_RATE = 3;
// let OP_APPLY_TROVE_INTEREST_PERMISSIONLESS = 4;
// let OP_LIQUIDATE = 5;
// let OP_REDEEM_COLLATERAL = 6;

let _1e15 = BigInt.fromI32(10).pow(15);
let _1e16 = BigInt.fromI32(10).pow(16);

export function handleTroveOperation(event: TroveOperationEvent): void {
  let id = event.params._troveId.toHex();
  let trove = Trove.load(id);

  if (!trove) {
    return;
  }

  if (event.params._operation === OP_CLOSE_TROVE) {
    trove.closedAt = event.block.timestamp;

    // update rate bracket
    let rateFloored = event.params._annualInterestRate.div(_1e15).times(_1e16);
    let rateBracket = InterestRateBracket.load(rateFloored.toString());
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

function loadOrCreateInterestRateBracket(rateFloored: BigInt): InterestRateBracket {
  let rateBracket = InterestRateBracket.load(rateFloored.toString());
  if (!rateBracket) {
    rateBracket = new InterestRateBracket(rateFloored.toString());
    rateBracket.rate = rateFloored;
    rateBracket.totalDebt = BigInt.fromI32(0);
    rateBracket.totalTroves = 0;
  }
  rateBracket.save();
  return rateBracket;
}

export function handleTroveUpdated(event: TroveUpdatedEvent): void {
  let id = event.params._troveId.toHex();
  let trove = Trove.load(id);

  // previous & new rates, floored to the nearest 0.1% (rate brackets)
  let prevRateFloored = trove ? trove.interestRate.div(_1e15).times(_1e16) : null;
  let rateFloored = event.params._annualInterestRate.div(_1e15).times(_1e16);

  // create trove if it doesn't exist
  if (!trove) {
    trove = new Trove(id);
    trove.borrower = event.transaction.from;
    trove.createdAt = event.block.timestamp;
  }

  // update interest rate brackets
  let rateBracket = loadOrCreateInterestRateBracket(rateFloored);
  if (!prevRateFloored || rateFloored.notEqual(prevRateFloored)) {
    let prevRateBracket = prevRateFloored ? InterestRateBracket.load(prevRateFloored.toString()) : null;
    if (prevRateBracket) {
      prevRateBracket.totalDebt = prevRateBracket.totalDebt.minus(trove.debt);
      prevRateBracket.totalTroves = prevRateBracket.totalTroves - 1;
      prevRateBracket.save();
    }

    rateBracket.totalDebt = rateBracket.totalDebt.plus(event.params._debt);
    rateBracket.totalTroves = rateBracket.totalTroves + 1;
  } else {
    rateBracket.totalDebt = rateBracket.totalDebt.minus(trove.debt).plus(event.params._debt);
  }

  rateBracket.save();

  trove.deposit = event.params._coll;
  trove.debt = event.params._debt;
  trove.interestRate = event.params._annualInterestRate;
  trove.collateral = dataSource.context().getBytes("tokenAddress").toHexString();
  trove.stake = event.params._stake;

  trove.save();
}
