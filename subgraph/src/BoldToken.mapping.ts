import { Address, BigInt, DataSourceContext, log } from "@graphprotocol/graph-ts";
import {
  CollateralRegistryAddressChanged as CollateralRegistryAddressChangedEvent,
} from "../generated/BoldToken/BoldToken";
import { BorrowerOperations as BorrowerOperationsContract } from "../generated/BoldToken/BorrowerOperations";
import { CollateralRegistry as CollateralRegistryContract } from "../generated/BoldToken/CollateralRegistry";
import { ERC20 as ERC20Contract } from "../generated/BoldToken/ERC20";
import { TroveManager as TroveManagerContract } from "../generated/BoldToken/TroveManager";
import { Collateral, CollateralAddresses, StabilityPoolEpochScale, Token } from "../generated/schema";
import {
  StabilityPool as StabilityPoolTemplate,
  TroveManager as TroveManagerTemplate,
  TroveNFT as TroveNFTTemplate,
} from "../generated/templates";


/// @dev: the original code (commented out further below) exepcted all contracts to be deployed in the same block
///       this is not the case, so we need to get the addresses dynamically
///       we do this by using the token address as the id for the collateral
///       and then using the token address to get the addresses of the other contracts
///       this is a hack, but it works for now

/// @dev: we should figure out how to load addresses dynamically over multiple blocks ideally

function getTokenAddress(collIndex: i32): Address {
  switch (collIndex) {
    case 0:
      return Address.fromString("0x7b42e0d1b7f2111b04c6547fca8ca2b0f271498c");
    case 1:
      return Address.fromString("0x1f45f163c6fea687c66365f3d75f18c71706c069");
    case 2:
      return Address.fromString("0x985a39b8dfaa7689b05e6e7bd1b2a66b8b5b1e4e");
    default:
      return Address.fromString("0x0000000000000000000000000000000000000000");
  }
}

function getTroveManagerAddress(collIndex: i32): Address {
  switch (collIndex) {
    case 0:
      return Address.fromString("0x3f984c8ecbd25e0f3580853c4e081d376def8fdd");
    case 1:
      return Address.fromString("0x3fa5b92c2b53348d383fd265e6ec13473537fb21");
    case 2:
      return Address.fromString("0x0079eb9ebd9820c5961b406c1400e1e5dd177592");
    default:
      return Address.fromString("0x0000000000000000000000000000000000000000");
  }
}


function getMCR(collIndex: i32): BigInt {
  switch (collIndex) {
    case 0:
      return BigInt.fromI64(1200000000000000000);
    case 1:
      return BigInt.fromI64(1200000000000000000);
    case 2:
      return BigInt.fromI64(1200000000000000000);
    default:
      return BigInt.fromI32(0);
  }
}


function getContractAddresses(collIndex: i32): CollateralAddresses {
  let addresses = new CollateralAddresses(collIndex.toString());
  switch (collIndex) {
    case 0:
      addresses.collateral = collIndex.toString();
      addresses.borrowerOperations = Address.fromString("0xc7e8dbdd69fd6d1565a96aee00286d4c359c7241");
      addresses.sortedTroves = Address.fromString("0xc0b3cb26a3c64865a90a9e7a32300a56dc0b1daa");
      addresses.stabilityPool = Address.fromString("0xa33375289c39305dc98013d467bf6de16de5d581");
      addresses.token = getTokenAddress(collIndex);
      addresses.troveManager = getTroveManagerAddress(collIndex);
      addresses.troveNft = Address.fromString("0x3f984c8ecbd25e0f3580853c4e081d376def8fdd");
      return addresses;
    case 1:
      addresses.collateral = collIndex.toString();
      addresses.borrowerOperations = Address.fromString("0x8efefcf74abf3685be54a8ec92e4ce4b1996025b");
      addresses.sortedTroves = Address.fromString("0x01fe02feca72f10ce943aa38eb643d24d873832d");
      addresses.stabilityPool = Address.fromString("0x2731a265f55d78229b1066dbfa279bcf6e701a06");
      addresses.token = getTokenAddress(collIndex);
      addresses.troveManager = getTroveManagerAddress(collIndex);
      addresses.troveNft = Address.fromString("0x415717fe63dce2e921a550325950fc5e31e8cae9");
      return addresses;
    case 2:
      addresses.collateral = collIndex.toString();
      addresses.borrowerOperations = Address.fromString("0x7d07d81c00d41add8c25b898f9aaee8faafb4e82");
      addresses.sortedTroves = Address.fromString("0x37503a4e1b6f3b7c2e07c1b173536ec8d8507e29");
      addresses.stabilityPool = Address.fromString("0x019c2d19699b22e12119a6e6925972e354829542");
      addresses.token = getTokenAddress(collIndex);
      addresses.troveManager = getTroveManagerAddress(collIndex);
      addresses.troveNft = Address.fromString("0x1cf3d4b97c3fe8f66b9bb9127d2d5d0d6312a864");
      return addresses;
    default:
      return addresses;
  }
}


function addCollateral(
  collIndex: i32,
  totalCollaterals: i32,
  tokenAddress: Address,
  troveManagerAddress: Address,
): void {
  let collId = collIndex.toString();

  let collateral = new Collateral(collId);
  collateral.collIndex = collIndex;
  collateral.token = collId;

  let token = new Token(collId);
  let tokenContract = ERC20Contract.bind(tokenAddress);
  token.collateral = collId;
  token.name = tokenContract.name();
  token.symbol = tokenContract.symbol();
  token.decimals = tokenContract.decimals();
  collateral.minCollRatio = getMCR(collIndex);

  // initial collId + epoch + scale => S
  let spEpochScale = new StabilityPoolEpochScale(collId + ":0:0");
  spEpochScale.B = BigInt.fromI32(0);
  spEpochScale.S = BigInt.fromI32(0);

  // //  @dev: if all addresses would be deployed in the same block we could use the following code to get the values dynamically
  // // let troveManagerContract = TroveManagerContract.bind(troveManagerAddress);
  // // let addresses = new CollateralAddresses(collId);
  // // addresses.collateral = collId;
  // // addresses.borrowerOperations = troveManagerContract.borrowerOperations();
  // // addresses.sortedTroves = troveManagerContract.sortedTroves();
  // // addresses.stabilityPool = troveManagerContract.stabilityPool();
  // // addresses.token = tokenAddress;
  // // addresses.troveManager = troveManagerAddress;
  // // addresses.troveNft = troveManagerContract.troveNFT();
  // // collateral.minCollRatio = BorrowerOperationsContract.bind(
  // //   Address.fromBytes(addresses.borrowerOperations),
  // // ).MCR();


  let addresses = getContractAddresses(collIndex);

  collateral.save();
  token.save();
  addresses.save();
  spEpochScale.save();

  let context = new DataSourceContext();
  context.setBytes("address:borrowerOperations", addresses.borrowerOperations);
  context.setBytes("address:sortedTroves", addresses.sortedTroves);
  context.setBytes("address:stabilityPool", addresses.stabilityPool);
  context.setBytes("address:token", addresses.token);
  context.setBytes("address:troveManager", addresses.troveManager);
  context.setBytes("address:troveNft", addresses.troveNft);
  context.setString("collId", collId);
  context.setI32("collIndex", collIndex);
  context.setI32("totalCollaterals", totalCollaterals);

  TroveManagerTemplate.createWithContext(troveManagerAddress, context);
  TroveNFTTemplate.createWithContext(Address.fromBytes(addresses.troveNft), context);
  StabilityPoolTemplate.createWithContext(Address.fromBytes(addresses.stabilityPool), context);
}

export function handleCollateralRegistryAddressChanged(event: CollateralRegistryAddressChangedEvent): void {
  let registry = CollateralRegistryContract.bind(event.params._newCollateralRegistryAddress);
  let totalCollaterals = registry.totalCollaterals().toI32();

  for (let index = 0; index < totalCollaterals; index++) {
    //let tokenAddress = Address.fromBytes(registry.getToken(BigInt.fromI32(index)));
    //let troveManagerAddress = Address.fromBytes(registry.getTroveManager(BigInt.fromI32(index)));

    let tokenAddress = getTokenAddress(index);
    let troveManagerAddress = getTroveManagerAddress(index);

    if (tokenAddress.toHex() === Address.zero().toHex() || troveManagerAddress.toHex() === Address.zero().toHex()) {
      break;
    }

    // we use the token address as the id for the collateral
    if (!Collateral.load(tokenAddress.toHexString())) {
      addCollateral(
        index,
        totalCollaterals,
        tokenAddress,
        troveManagerAddress,
      );
    }
  }
}