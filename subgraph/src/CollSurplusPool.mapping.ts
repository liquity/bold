import { Address, BigInt, Bytes, dataSource, DataSourceContext } from "@graphprotocol/graph-ts";
import { BorrowerInfo, CollateralAddresses } from "../generated/schema";
import { CollSurplusPool as CollSurplusPoolTemplate } from "../generated/templates";
import { CollBalanceUpdated as CollBalanceUpdatedEvent } from "../generated/templates/CollSurplusPool/CollSurplusPool";
import { TroveOperation as TroveOperationEvent } from "../generated/templates/TroveManager/TroveManager";
import { decodeAddress, decodeUint256 } from "./shared/decoding";

const COLL_BALANCE_UPDATED_TOPIC = Bytes.fromHexString(
  // keccak256("CollBalanceUpdated(address,uint256)")
  "0xf0393a34d05e6567686ad4e097f9d9d2781565957394f1f0d984e5d8e6378f20",
);

function getCollSurplusBalanceChange(account: Address, newBalance: BigInt): BigInt {
  let borrowerInfoId = account.toHexString();
  let borrowerInfo = BorrowerInfo.load(borrowerInfoId);

  if (!borrowerInfo) {
    throw new Error("BorrowerInfo not found: " + borrowerInfoId);
  }

  let collIndex = dataSource.context().getI32("collIndex");
  let collSurplusBalance = borrowerInfo.collSurplusBalance;
  let balanceChange = newBalance.minus(collSurplusBalance[collIndex]);
  collSurplusBalance[collIndex] = newBalance;
  borrowerInfo.collSurplusBalance = collSurplusBalance;
  borrowerInfo.save();

  return balanceChange;
}

export function getCollSurplusFrom(troveOperationEvent: TroveOperationEvent): BigInt {
  let receipt = troveOperationEvent.receipt;

  if (!receipt) {
    throw new Error("Missing TX receipt");
  }

  let collBalanceUpdatedLogIndex = -1;

  for (let i = 0; i < receipt.logs.length; ++i) {
    if (receipt.logs[i].logIndex.equals(troveOperationEvent.logIndex.minus(BigInt.fromI32(4)))) {
      if (receipt.logs[i].topics.length > 0 && receipt.logs[i].topics[0].equals(COLL_BALANCE_UPDATED_TOPIC)) {
        collBalanceUpdatedLogIndex = i;
      }
      break;
    }
  }

  if (collBalanceUpdatedLogIndex < 0) {
    return BigInt.zero();
  }

  let collBalanceUpdatedLog = receipt.logs[collBalanceUpdatedLogIndex];
  let collId = dataSource.context().getString("collId");
  let addresses = CollateralAddresses.load(collId);

  if (!addresses) {
    throw new Error("CollateralAddresses not found: " + collId);
  }

  // XXX extremely ugly hack: there's no easy way to get the CollSurplusPool address,
  // so we lazily set it here, and more importantly: instantiate a data source for it
  if (!addresses.collSurplusPool) {
    let context = new DataSourceContext();
    context.setI32("collIndex", dataSource.context().getI32("collIndex"));
    CollSurplusPoolTemplate.createWithContext(collBalanceUpdatedLog.address, context);

    addresses.collSurplusPool = collBalanceUpdatedLog.address;
    addresses.save();
  }

  return getCollSurplusBalanceChange(
    decodeAddress(collBalanceUpdatedLog.topics[1]).toAddress(),
    decodeUint256(collBalanceUpdatedLog.data).toBigInt(),
  );
}

export function handleCollBalanceUpdated(event: CollBalanceUpdatedEvent): void {
  // Top-ups are handled by `getCollSurplusFrom(troveOperationEvent)`
  if (event.params._newBalance.notEqual(BigInt.zero())) return;

  let borrowerInfoId = event.params._account.toHexString();
  let borrowerInfo = BorrowerInfo.load(borrowerInfoId);

  if (!borrowerInfo) {
    throw new Error("BorrowerInfo not found: " + borrowerInfoId);
  }

  let collIndex = dataSource.context().getI32("collIndex");
  let collSurplusBalance = borrowerInfo.collSurplusBalance;
  let lastCollSurplusClaimAt = borrowerInfo.lastCollSurplusClaimAt;
  collSurplusBalance[collIndex] = BigInt.zero();
  lastCollSurplusClaimAt[collIndex] = event.block.timestamp;
  borrowerInfo.collSurplusBalance = collSurplusBalance;
  borrowerInfo.lastCollSurplusClaimAt = lastCollSurplusClaimAt;
  borrowerInfo.save();
}
