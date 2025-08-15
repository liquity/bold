import { Address, BigInt, Bytes, dataSource } from "@graphprotocol/graph-ts";
import { BorrowerInfo, Trove } from "../generated/schema";
import { Transfer as TransferEvent } from "../generated/templates/TroveNFT/TroveNFT";

export function handleTransfer(event: TransferEvent): void {
  let collIndex = dataSource.context().getI32("collIndex");
  let trove: Trove | null;

  if (event.params.from.equals(Address.zero())) {
    trove = createTrove(event.params.tokenId);
  } else {
    let collId = dataSource.context().getString("collId");
    let troveFullId = collId + ":" + event.params.tokenId.toHexString();
    trove = Trove.load(troveFullId);

    if (!trove) {
      throw new Error("Trove does not exist: " + troveFullId);
    }
  }

  // update the trove borrower
  trove.previousOwner = trove.borrower;
  trove.borrower = event.params.to;
  trove.save();

  // update troves count & ownerIndex for the previous owner
  updateBorrowerTrovesCount(-1, event.params.from, collIndex);

  // update troves count & ownerIndex for the current owner (including zero address)
  updateBorrowerTrovesCount(1, event.params.to, collIndex);
}

function createTrove(troveId: BigInt): Trove {
  let collId = dataSource.context().getString("collId");
  let troveFullId = collId + ":" + troveId.toHexString();
  let trove = Trove.load(troveFullId);

  if (trove) {
    throw new Error("Trove already exists: " + troveFullId);
  }

  trove = new Trove(troveFullId);
  trove.borrower = Address.zero();
  trove.collateral = collId;
  trove.createdAt = BigInt.zero();
  trove.debt = BigInt.zero();
  trove.deposit = BigInt.zero();
  trove.stake = BigInt.zero();
  trove.status = "active";
  trove.troveId = troveId.toHexString();
  trove.updatedAt = BigInt.zero();
  trove.lastUserActionAt = BigInt.zero();
  trove.previousOwner = Address.zero();
  trove.redemptionCount = 0;
  trove.redeemedColl = BigInt.zero();
  trove.redeemedDebt = BigInt.zero();
  trove.interestRate = BigInt.zero();
  trove.interestBatch = null;
  trove.mightBeLeveraged = false;

  return trove;
}

function updateBorrowerTrovesCount(delta: i32, borrower: Bytes, collIndex: i32): void {
  let borrowerId = borrower.toHexString();
  let borrowerInfo = BorrowerInfo.load(borrowerId);
  let collateralsCount = dataSource.context().getI32("totalCollaterals");

  if (!borrowerInfo) {
    borrowerInfo = new BorrowerInfo(borrowerId);
    borrowerInfo.troves = 0;
    borrowerInfo.trovesByCollateral = (new Array<i32>(collateralsCount)).fill(0);
    borrowerInfo.nextOwnerIndexes = (new Array<i32>(collateralsCount)).fill(0);
  }

  // track the amount of troves per collateral
  let trovesByCollateral = borrowerInfo.trovesByCollateral;
  trovesByCollateral[collIndex] += delta;
  borrowerInfo.trovesByCollateral = trovesByCollateral;

  // track the total amount of troves
  borrowerInfo.troves += delta;

  // nextOwnerIndexes only ever goes up
  if (delta > 0) {
    let nextOwnerIndexes = borrowerInfo.nextOwnerIndexes;
    nextOwnerIndexes[collIndex] += 1;
    borrowerInfo.nextOwnerIndexes = nextOwnerIndexes;
  }

  borrowerInfo.save();
}
