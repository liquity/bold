import { Address, dataSource } from "@graphprotocol/graph-ts";
import { Trove } from "../generated/schema";
import { Transfer as TransferEvent } from "../generated/templates/TroveNFT/TroveNFT";
import { BorrowerTrovesCountUpdate, updateBorrowerTrovesCount } from "./shared";

export function handleTransfer(event: TransferEvent): void {
  // Minting doesn’t need to be handled as we are already
  // handling OP_OPEN_TROVE & OP_OPEN_TROVE_AND_JOIN_BATCH
  // in TroveManager.mapping.ts.
  if (event.params.from.equals(Address.zero())) {
    return;
  }

  let collId = dataSource.context().getString("collId");
  let troveFullId = collId + ":" + event.params.tokenId.toHexString();

  let trove = Trove.load(troveFullId);
  if (!trove) {
    throw new Error("Trove does not exist: " + troveFullId);
  }

  let collIndex = <i32> parseInt(trove.collateral);

  // update troves count & ownerIndex for the previous owner
  updateBorrowerTrovesCount(
    BorrowerTrovesCountUpdate.remove,
    event.params.from,
    collIndex,
  );

  // update troves count & ownerIndex for the current owner (including zero address)
  updateBorrowerTrovesCount(
    BorrowerTrovesCountUpdate.add,
    event.params.to,
    collIndex,
  );

  // update the trove borrower
  trove.borrower = event.params.to;
  trove.save();
}
