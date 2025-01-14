import { Address, BigInt, dataSource } from "@graphprotocol/graph-ts";
import { BorrowerInfo, Trove } from "../generated/schema";
import { Transfer as TransferEvent } from "../generated/templates/TroveNFT/TroveNFT";

enum BorrowerInfoUpdate {
  add,
  remove,
}

function updateBorrowerInfo(
  borrowerAddress: Address,
  troveFullId: string,
  update: BorrowerInfoUpdate,
): void {
  let trove = Trove.load(troveFullId);
  if (!trove) {
    throw new Error("Trove does not exist: " + troveFullId);
  }

  let borrowerInfo = BorrowerInfo.load(borrowerAddress.toHexString());

  if (!borrowerInfo && update == BorrowerInfoUpdate.add) {
    borrowerInfo = new BorrowerInfo(borrowerAddress.toHexString());
    borrowerInfo.troves = 0;

    let totalCollaterals = dataSource.context().getI32("totalCollaterals");
    borrowerInfo.trovesByCollateral = (new Array<i32>(totalCollaterals)).fill(0);
  }

  if (!borrowerInfo) {
    throw new Error("BorrowerInfo does not exist: " + borrowerAddress.toHexString());
  }

  let diff = update == BorrowerInfoUpdate.add ? 1 : -1;

  let trovesByColl = borrowerInfo.trovesByCollateral;
  let collIndex = <i32> parseInt(trove.collateral);
  trovesByColl[collIndex] += diff;

  borrowerInfo.trovesByCollateral = trovesByColl;
  borrowerInfo.troves += diff;
  borrowerInfo.save();
}

export function handleTransfer(event: TransferEvent): void {
  // Minting doesn’t need to be handled as we are already
  // handling OP_OPEN_TROVE & OP_OPEN_TROVE_AND_JOIN_BATCH
  // in TroveManager.mapping.ts.
  if (event.params.from.equals(Address.zero())) {
    return;
  }

  let collId = dataSource.context().getString("collId");
  let troveFullId = collId + ":" + event.params.tokenId.toHexString();

  // update BorrowerInfo for the previous owner
  updateBorrowerInfo(event.params.from, troveFullId, BorrowerInfoUpdate.remove);

  // update BorrowerInfo for the new owner (including zero address)
  updateBorrowerInfo(event.params.to, troveFullId, BorrowerInfoUpdate.add);

  // update the trove borrower
  let trove = Trove.load(troveFullId);
  if (trove) {
    trove.borrower = event.params.to;
    trove.save();
  }
}
