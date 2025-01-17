import { Address, dataSource } from "@graphprotocol/graph-ts";
import { BorrowerInfo } from "../generated/schema";

export enum BorrowerTrovesCountUpdate {
  add,
  remove,
}

export function updateBorrowerTrovesCount(
  update: BorrowerTrovesCountUpdate,
  borrower: Address,
  collIndex: i32,
): BorrowerInfo {
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
  trovesByCollateral[collIndex] += update === BorrowerTrovesCountUpdate.add ? 1 : -1;
  borrowerInfo.trovesByCollateral = trovesByCollateral;

  // track the total amount of troves
  borrowerInfo.troves += update === BorrowerTrovesCountUpdate.add ? 1 : -1;

  // nextOwnerIndexes only ever goes up
  if (update === BorrowerTrovesCountUpdate.add) {
    let nextOwnerIndexes = borrowerInfo.nextOwnerIndexes;
    nextOwnerIndexes[collIndex] += 1;
    borrowerInfo.nextOwnerIndexes = nextOwnerIndexes;
  }

  borrowerInfo.save();

  return borrowerInfo;
}
