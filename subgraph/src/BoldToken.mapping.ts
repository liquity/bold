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

  let troveManagerContract = TroveManagerContract.bind(troveManagerAddress);

  let addresses = new CollateralAddresses(collId);
  addresses.collateral = collId;
  addresses.borrowerOperations = Address.fromString(collIndex === 0 ? "0x267f27704cb5c4fd85cab6b62acffbc3a0dd5097" : "0xe04dcc3422b75036c6b5e20e784043031e9bef9e");
  addresses.sortedTroves = Address.fromString(collIndex === 0 ? "0x8ecfd497d61c0798319134da322eb77447e37466" : "0xa3c7062d84de691aeee99cefaf04c78655829c7c");
  addresses.stabilityPool = Address.fromString(collIndex === 0 ? "0xc800a61ef17228b5f941b240620a48ff74db8019" : "0x4169ce06f30b39771d887b1e5e990c66011f1689");
  addresses.token = tokenAddress;
  addresses.troveManager = troveManagerAddress;
  addresses.troveNft = Address.fromString(collIndex === 0 ? "0x87e14803d0d705ac60ebb1c655634a5f84a6ee3b" : "0x256bc91a0159ecf159dab2d4289272249b266ad4");

  collateral.minCollRatio = BigInt.fromI64(1200000000000000000)

  // initial collId + epoch + scale => S
  let spEpochScale = new StabilityPoolEpochScale(collId + ":0:0");
  spEpochScale.B = BigInt.fromI32(0);
  spEpochScale.S = BigInt.fromI32(0);

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
  log.warning("CollateralRegistryAddressChanged: {}", [event.params._newCollateralRegistryAddress.toHex()])
  let registry = CollateralRegistryContract.bind(event.params._newCollateralRegistryAddress);
  let totalCollaterals = registry.totalCollaterals().toI32();
  log.warning("totalCollaterals: {}", [totalCollaterals.toString()])

  for (let index = 0; index < totalCollaterals; index++) {
    let tokenAddress = Address.fromBytes(registry.getToken(BigInt.fromI32(index)));
    log.warning("tokenAddress: {}", [tokenAddress.toHex()])
    let troveManagerAddress = Address.fromBytes(registry.getTroveManager(BigInt.fromI32(index)));
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