import { Address, BigInt, Bytes, DataSourceContext } from "@graphprotocol/graph-ts";
import { CollateralRegistry } from "../generated/CollateralRegistry/CollateralRegistry";
import { BaseRateUpdated as BaseRateUpdatedEvent } from "../generated/CollateralRegistry/CollateralRegistry";
import { ERC20 } from "../generated/CollateralRegistry/ERC20";
import { Collateral, CollateralAddresses, Token } from "../generated/schema";
import { TroveManager as TroveManagerTemplate } from "../generated/templates";

function addCollateral(
  id: string,
  tokenAddress: Address,
  troveManagerAddress: Address,
): void {
  let collateral = new Collateral(id);
  collateral.token = id;
  collateral.minCollRatio = BigInt.fromI32(0);

  let token = new Token(id);
  let tokenContract = ERC20.bind(tokenAddress);
  token.collateral = id;
  token.name = tokenContract.name();
  token.symbol = tokenContract.symbol();
  token.decimals = tokenContract.decimals();

  let addresses = new CollateralAddresses(id);
  addresses.collateral = id;
  addresses.activePool = Address.zero();
  addresses.borrowerOperations = Address.zero();
  addresses.defaultPool = Address.zero();
  addresses.priceFeed = Address.zero();
  addresses.sortedTroves = Address.zero();
  addresses.stabilityPool = Address.zero();
  addresses.token = tokenAddress;
  addresses.troveManager = troveManagerAddress;

  collateral.save();
  addresses.save();
  token.save();

  let context = new DataSourceContext();
  context.setBytes("tokenAddress", tokenAddress);
  context.setBytes("troveManagerAddress", troveManagerAddress);

  TroveManagerTemplate.createWithContext(troveManagerAddress, context);
}

export function handleBaseRateUpdated(event: BaseRateUpdatedEvent): void {
  let registry = CollateralRegistry.bind(event.address);
  let colls = registry.totalCollaterals().toI32();

  for (let i = 0; i < colls; i++) {
    let tokenAddress: Address = Address.fromBytes(registry.getToken(BigInt.fromI32(i)));
    let troveManagerAddress: Address = Address.fromBytes(registry.getTroveManager(BigInt.fromI32(i)));

    if (tokenAddress.toHex() === Address.zero().toHex() || troveManagerAddress.toHex() === Address.zero().toHex()) {
      break;
    }

    // we use the token address as the id for the collateral
    let id = tokenAddress.toHexString();

    if (!Collateral.load(id)) {
      addCollateral(id, tokenAddress, troveManagerAddress);
    }
  }
}
