import { Address, BigInt, DataSourceContext } from "@graphprotocol/graph-ts";
import {
  CollateralRegistryAddressChanged as CollateralRegistryAddressChangedEvent,
  TroveManagerAddressAdded as TroveManagerAddressAddedEvent,
  StabilityPoolAddressAdded as StabilityPoolAddressAddedEvent,
  BorrowerOperationsAddressAdded as BorrowerOperationsAddressAddedEvent,
  ActivePoolAddressAdded as ActivePoolAddressAddedEvent,
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
  ActivePool as ActivePoolTemplate,
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
  addresses.borrowerOperations = troveManagerContract.borrowerOperations();
  addresses.sortedTroves = troveManagerContract.sortedTroves();
  addresses.stabilityPool = troveManagerContract.stabilityPool();
  addresses.token = tokenAddress;
  addresses.troveManager = troveManagerAddress;
  addresses.troveNft = troveManagerContract.troveNFT();

  collateral.minCollRatio = BorrowerOperationsContract.bind(
    Address.fromBytes(addresses.borrowerOperations),
  ).MCR();

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
  let registry = CollateralRegistryContract.bind(event.params._newCollateralRegistryAddress);
  let totalCollaterals = registry.totalCollaterals().toI32();

  for (let index = 0; index < totalCollaterals; index++) {
    let tokenAddress = Address.fromBytes(registry.getToken(BigInt.fromI32(index)));
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

export function handleTroveManagerAddressAdded(event: TroveManagerAddressAddedEvent): void {
  // When a new TroveManager address is added to the BoldToken contract
  let troveManagerAddress = event.params._newTroveManagerAddress;
  
  // We can create a template for the new TroveManager
  // When creating with context, we only include minimal data
  let context = new DataSourceContext();
  context.setBytes("address:troveManager", troveManagerAddress);
  
  // Since we don't know which collateral this is for yet, we'll set up the basic template
  // The full initialization will happen when the CollateralRegistry is updated
  TroveManagerTemplate.createWithContext(troveManagerAddress, context);
}

export function handleStabilityPoolAddressAdded(event: StabilityPoolAddressAddedEvent): void {
  // When a new StabilityPool address is added to the BoldToken contract
  let stabilityPoolAddress = event.params._newStabilityPoolAddress;
  
  // Create a template for the new StabilityPool
  let context = new DataSourceContext();
  context.setBytes("address:stabilityPool", stabilityPoolAddress);
  
  // The full initialization will happen when the CollateralRegistry is updated
  StabilityPoolTemplate.createWithContext(stabilityPoolAddress, context);
}

export function handleBorrowerOperationsAddressAdded(event: BorrowerOperationsAddressAddedEvent): void {
  // Get the BorrowerOperations address from the event
  let borrowerOperationsAddress = event.params._newBorrowerOperationsAddress;
  
  // Find the collateral registry address from the BoldToken contract
  let boldToken = event.address;
  let registry = CollateralRegistryContract.bind(boldToken);
  
  try {
    // Get the first collateral to check if it's related to this BorrowerOperations
    let token = registry.getToken(BigInt.fromI32(0));
    let troveManager = registry.getTroveManager(BigInt.fromI32(0));
    
    if (!token.equals(Address.zero()) && !troveManager.equals(Address.zero())) {
      // We have at least one collateral - check if its TroveManager uses this BorrowerOperations
      let tmContract = TroveManagerContract.bind(troveManager);
      let bo = tmContract.borrowerOperations();
      
      if (bo.equals(borrowerOperationsAddress)) {
        // This BorrowerOperations is for the first collateral
        let collateralAddresses = CollateralAddresses.load("0");
        if (collateralAddresses) {
          collateralAddresses.borrowerOperations = borrowerOperationsAddress;
          collateralAddresses.save();
        }
      }
    }
  } catch (e) {
    // The registry might not be set up yet or there might be no collaterals
    // That's okay - the addresses will be linked when the registry is updated
  }
}

export function handleActivePoolAddressAdded(event: ActivePoolAddressAddedEvent): void {
  // Get the ActivePool address from the event
  let activePoolAddress = event.params._newActivePoolAddress;
  
  // Create a template for the new ActivePool
  let context = new DataSourceContext();
  context.setBytes("address:activePool", activePoolAddress);

  ActivePoolTemplate.createWithContext(activePoolAddress, context);
}
