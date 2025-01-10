import { Address } from "@graphprotocol/graph-ts";
import { BorrowerInfo, Trove } from "../generated/schema";
import { Transfer as TransferEvent } from "../generated/templates/TroveNFT/TroveNFT";

enum BorrowerInfoUpdate {
  add,
  remove,
}

function updateBorrowerInfo(
  borrowerAddress: Address,
  troveId: string,
  update: BorrowerInfoUpdate,
): void {
  let trove = Trove.load(troveId);
  if (!trove) {
    throw new Error("Trove does not exist: " + troveId);
  }

  let borrower = BorrowerInfo.load(borrowerAddress.toHexString());

  if (!borrower && update == BorrowerInfoUpdate.add) {
    borrower = new BorrowerInfo(borrowerAddress.toHexString());
    borrower.troves = 0;
    borrower.trovesByCollateral = [];
  }

  if (!borrower) {
    throw new Error("BorrowerInfo does not exist: " + borrowerAddress.toHexString());
  }

  let diff = update == BorrowerInfoUpdate.add ? 1 : -1;

  let trovesByColl = borrower.trovesByCollateral;
  let collIndex = <i32>parseInt(trove.collateral);
  trovesByColl[collIndex] += diff;

  borrower.trovesByCollateral = trovesByColl;
  borrower.troves += diff;
  borrower.save();
}

export function handleTransfer(event: TransferEvent): void {
  // Minting doesn’t need to be handled as we are already
  // handling OP_OPEN_TROVE & OP_OPEN_TROVE_AND_JOIN_BATCH
  // in TroveManager.mapping.ts.
  if (event.params.from.equals(Address.zero())) {
    return;
  }

  let troveId = event.params.tokenId.toHexString();

  // update BorrowerInfo for the previous owner
  updateBorrowerInfo(event.params.from, troveId, BorrowerInfoUpdate.remove);

  // update BorrowerInfo for the new owner (including zero address)
  updateBorrowerInfo(event.params.to, troveId, BorrowerInfoUpdate.add);

  // update the trove borrower
  let trove = Trove.load(troveId);
  if (trove) {
    trove.borrower = event.params.to;
    trove.save();
  }
}
