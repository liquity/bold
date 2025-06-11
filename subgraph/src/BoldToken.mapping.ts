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
      return Address.fromString("0x5ff46c6b2b2dc0cd858e48f2791c247f603ed75f");
    default:
      return Address.fromString("0x0000000000000000000000000000000000000000");
  }
}

function getTroveManagerAddress(collIndex: i32): Address {
  switch (collIndex) {
    case 0:
      return Address.fromString("0xca56aa0b8b73b50a13ac9ef6174759316ca3d20e");
    default:
      return Address.fromString("0x0000000000000000000000000000000000000000");
  }
}


function getMCR(collIndex: i32): BigInt {
  switch (collIndex) {
    case 0:
      return BigInt.fromI64(1300000000000000000);
    default:
      return BigInt.fromI32(0);
  }
}


function getContractAddresses(collIndex: i32): CollateralAddresses {
  let addresses = new CollateralAddresses(collIndex.toString());
  switch (collIndex) {
    case 0:
      addresses.collateral = collIndex.toString();
      addresses.borrowerOperations = Address.fromString("0x173c78ef51a77f8ffef9dde7e1275da19cfd74fb");
      addresses.sortedTroves = Address.fromString("0x2548ca710bca9a1765437f8404e859462ef73d4f");
      addresses.stabilityPool = Address.fromString("0x720557ac2f681a6545ec6684543f976f3d13db03");
      addresses.token = getTokenAddress(collIndex);
      addresses.troveManager = getTroveManagerAddress(collIndex);
      addresses.troveNft = Address.fromString("0x37565067207b2edb9917b5446843d12d47bf8f47");
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