import { Address, BigInt, dataSource } from "@graphprotocol/graph-ts";
import { Collateral, InterestRateBracket, Trove } from "../generated/schema";
import { TroveNFT } from "../generated/templates/TroveManager/TroveNFT";
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

function floorToDecimals(value: BigInt, decimals: u8): BigInt {
  let factor = BigInt.fromI32(10).pow(18 - decimals);
  return value.div(factor).times(factor);
}

export function handleTroveOperation(event: TroveOperationEvent): void {
  let id = event.params._troveId;
  let trove = Trove.load(id.toHex());

  if (!trove) {
    return;
  }

  if (event.params._operation === OP_CLOSE_TROVE) {
    trove.closedAt = event.block.timestamp;

    // update rate bracket
    let rateFloored = floorToDecimals(event.params._annualInterestRate, 3);
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
  let id = event.params._troveId;
  let trove = Trove.load(id.toHex());
  let context = dataSource.context();

  // previous & new rates, floored to the nearest 0.1% (rate brackets)
  let prevRateFloored = trove ? floorToDecimals(trove.interestRate, 3) : null;
  let rateFloored = floorToDecimals(event.params._annualInterestRate, 3);

  let prevDeposit = trove ? trove.deposit : BigInt.fromI32(0);
  let deposit = event.params._coll;

  let prevDebt = trove ? trove.debt : BigInt.fromI32(0);
  let debt = event.params._debt;

  let collId = context.getBytes("address:token").toHexString();
  let collateral = Collateral.load(collId);

  // should never happen
  if (!collateral) {
    return;
  }

  collateral.totalDeposited = collateral.totalDeposited.minus(prevDeposit).plus(deposit);
  collateral.totalDebt = collateral.totalDebt.minus(prevDebt).plus(debt);
  collateral.save();

  // create trove if it doesn't exist
  if (!trove) {
    trove = new Trove(id.toHex());
    trove.borrower = TroveNFT.bind(Address.fromBytes(context.getBytes("address:troveNft"))).ownerOf(id);
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
  trove.collateral = context.getBytes("address:token").toHexString();
  trove.stake = event.params._stake;

  trove.save();
}
