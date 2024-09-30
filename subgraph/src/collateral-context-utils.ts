import { dataSource } from "@graphprotocol/graph-ts";
import { Collateral } from "../generated/schema";

// prefix an id with the collateral index
export function getCollPrefixId(): string {
  let collId = dataSource.context().getBytes("address:token").toHexString();
  let collateral = Collateral.load(collId);
  if (!collateral) {
    throw new Error("Collateral not found: " + collId);
  }
  return collateral.collIndex.toString() + ":";
}
