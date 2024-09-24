import { Address, BigInt, DataSourceContext } from "@graphprotocol/graph-ts";
import {
  CollateralRegistryAddressChanged as CollateralRegistryAddressChangedEvent,
} from "../generated/BoldToken/BoldToken";
import { BorrowerOperations } from "../generated/BoldToken/BorrowerOperations";
import { CollateralRegistry } from "../generated/BoldToken/CollateralRegistry";
import { ERC20 } from "../generated/BoldToken/ERC20";
import { TroveManager } from "../generated/BoldToken/TroveManager";
import { Collateral, CollateralAddresses, Token } from "../generated/schema";
import { TroveManager as TroveManagerTemplate } from "../generated/templates";

function addCollateral(
  tokenAddress: Address,
  troveManagerAddress: Address,
): void {
  let id = tokenAddress.toHexString();
  let collateral = new Collateral(id);
  collateral.token = id;
  collateral.totalDebt = BigInt.fromI32(0);
  collateral.totalDeposited = BigInt.fromI32(0);

  let token = new Token(id);
  let tokenContract = ERC20.bind(tokenAddress);
  token.collateral = id;
  token.name = tokenContract.name();
  token.symbol = tokenContract.symbol();
  token.decimals = tokenContract.decimals();

  let troveManager = TroveManager.bind(troveManagerAddress);

  let addresses = new CollateralAddresses(id);
  addresses.collateral = id;
  addresses.borrowerOperations = troveManager.borrowerOperations();
  addresses.sortedTroves = troveManager.sortedTroves();
  addresses.stabilityPool = troveManager.stabilityPool();
  addresses.token = tokenAddress;
  addresses.troveManager = troveManagerAddress;
  addresses.troveNft = troveManager.troveNFT();

  collateral.minCollRatio = BorrowerOperations.bind(Address.fromBytes(addresses.borrowerOperations)).MCR();

  collateral.save();
  addresses.save();
  token.save();

  let context = new DataSourceContext();
  context.setBytes("address:borrowerOperations", addresses.borrowerOperations);
  context.setBytes("address:sortedTroves", addresses.sortedTroves);
  context.setBytes("address:stabilityPool", addresses.stabilityPool);
  context.setBytes("address:token", addresses.token);
  context.setBytes("address:troveManager", addresses.troveManager);
  context.setBytes("address:troveNft", addresses.troveNft);

  TroveManagerTemplate.createWithContext(troveManagerAddress, context);
}

export function handleCollateralRegistryAddressChanged(event: CollateralRegistryAddressChangedEvent): void {
  let registry = CollateralRegistry.bind(event.params._newCollateralRegistryAddress);
  let colls = registry.totalCollaterals().toI32();

  for (let i = 0; i < colls; i++) {
    let tokenAddress = Address.fromBytes(registry.getToken(BigInt.fromI32(i)));
    let troveManagerAddress = Address.fromBytes(registry.getTroveManager(BigInt.fromI32(i)));

    if (tokenAddress.toHex() === Address.zero().toHex() || troveManagerAddress.toHex() === Address.zero().toHex()) {
      break;
    }

    // we use the token address as the id for the collateral
    if (!Collateral.load(tokenAddress.toHexString())) {
      addCollateral(tokenAddress, troveManagerAddress);
    }
  }
}
