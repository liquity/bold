// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../BaseScript.sol";
import "../DeployHelper.s.sol";
import { BoldToken } from "src/BoldToken.sol";
import { WETHTester } from "test/TestContracts/WETHTester.sol";
import { DefaultFaucetERC20 } from "test/mock/DefaultFaucetERC20.t.sol";
import "src/Dependencies/Constants.sol";

import { WETHPriceFeed } from "src/PriceFeeds/WETHPriceFeed.sol";
import { PriceFeedTestnet } from "test/TestContracts/PriceFeedTestnet.sol";
import { MetadataDeployment } from "test/TestContracts/MetadataDeployment.sol";

contract DeploySonata is BaseScript, DeployHelper, MetadataDeployment {
  bytes32 private constant DEPLOYMENT_SALT = keccak256("SONATA_V1");
  uint256 private constant ETH_USD_STALENESS_THRESHOLD = 24 hours;
  uint256 private constant STETH_USD_STALENESS_THRESHOLD = 24 hours;
  uint256 private constant RETH_ETH_STALENESS_THRESHOLD = 48 hours;

  ScriptMetadata scriptMetadata;
  Config config;

  function run() external override {
    bool isTestnet = _isTestnet();

    _fetch_tokens(isTestnet);
    _deploy_contracts(isTestnet);

    vm.startBroadcast(_getDeployerPrivateKey());
    _deploy_trove_manager(isTestnet);
    vm.stopBroadcast();
  }

  function _fetch_tokens(bool isTestnet) internal {
    (scriptMetadata.boldToken,) = _tryDeployContractCREATE2(
      CONTRACT_BOLD_NAME,
      DEPLOYMENT_SALT,
      type(BoldToken).creationCode,
      abi.encode(deployer)
    );

    if (isTestnet) {
      (scriptMetadata.wSonic,) = _tryDeployContractCREATE2(
        CONTRACT_WSONIC_TESTNET_NAME,
        DEPLOYMENT_SALT,
        type(WETHTester).creationCode,
        abi.encode(10e18)
      );

      (scriptMetadata.usdc,) = _tryDeployContractCREATE2(
        CONTRACT_USDC_TESTNET_NAME,
        DEPLOYMENT_SALT,
        type(DefaultFaucetERC20).creationCode,
        abi.encode("USDC", "USDC", 18, 10e18)
      );

      (scriptMetadata.lBTC,) = _tryDeployContractCREATE2(
        CONTRACT_LBTC_TESTNET_NAME,
        DEPLOYMENT_SALT,
        type(DefaultFaucetERC20).creationCode,
        abi.encode("LBTC", "LBTC", 8, 10e8)
      );
    } else {
      scriptMetadata.wSonic = config.wSonic;
      scriptMetadata.usdc = config.usdc;
      scriptMetadata.lBTC = config.lBTC;
    }
  }

  function _deploy_contracts(bool isTestnet) internal {
    // TODO: Implement this
    // (scriptMetadata.stakingProtocolToken, ) =
    // _tryDeployContractCREATE2(CONTRACT_STAKING_PROTOCOL_TOKEN_NAME, DEPLOYMENT_SALT,
    //   type(DefaultFaucetERC20).creationCode,
    //   abi.encode("STAKING_PROTOCOL_TOKEN", "STAKING_PROTOCOL_TOKEN", 18, 10e18));

    // TODO: Implement this
    // (address governanceAddress, string memory governanceManifest) = deployGovernance(
    //   deployGovernanceParams,
    //   address(curveStableswapFactory),
    //   address(deployed.usdcCurvePool),
    //   address(lusdCurvePool)
    // );
    // address computedGovernanceAddress =
    // computeGovernanceAddress(deployGovernanceParams);
    // assert(governanceAddress == computedGovernanceAddress);
  }

  function _deploy_trove_manager(bool isTestnet) internal {
    TroveManagerParams[] memory troveManagerParamsArray = new TroveManagerParams[](3);

    // wSonic
    troveManagerParamsArray[0] = TroveManagerParams({
      CCR: CCR_WETH,
      MCR: MCR_WETH,
      SCR: SCR_WETH,
      BCR: BCR_ALL,
      LIQUIDATION_PENALTY_SP: LIQUIDATION_PENALTY_SP_WETH,
      LIQUIDATION_PENALTY_REDISTRIBUTION: LIQUIDATION_PENALTY_REDISTRIBUTION_WETH
    });

    // lBTC
    troveManagerParamsArray[1] = TroveManagerParams({
      CCR: CCR_SETH,
      MCR: MCR_SETH,
      SCR: SCR_SETH,
      BCR: BCR_ALL,
      LIQUIDATION_PENALTY_SP: LIQUIDATION_PENALTY_SP_SETH,
      LIQUIDATION_PENALTY_REDISTRIBUTION: LIQUIDATION_PENALTY_REDISTRIBUTION_SETH
    });

    string[] memory collNames = new string[](1);
    string[] memory collSymbols = new string[](1);
    collNames[0] = " Lombard BTC";
    collSymbols[0] = "LBTC";

    uint256 totalCollaterals = troveManagerParamsArray.length;

    LiquityContracts[] memory protocolContracts = new LiquityContracts[](totalCollaterals);
    IERC20Metadata[] memory collaterals = new IERC20Metadata[](totalCollaterals);
    IPriceFeed[] memory priceFeeds = new IPriceFeed[](totalCollaterals);
    IAddressesRegistry[] memory addressesRegistries =
      new IAddressesRegistry[](totalCollateralslength);
    ITroveManager[] memory troveManagers = new ITroveManager[](totalCollaterals);

    if (isTestnet) {
      collaterals[0] = IERC20Metadata(scriptMetadata.wSonic);
      vars.priceFeeds[0] = new PriceFeedTestnet();

      for (uint256 i = 1; i < totalCollaterals; ++i) {
        collaterals[i] =
          new DefaultFaucetERC20(collNames[i - 1], collSymbols[i - 1], 100e18);

        priceFeeds[i] = new PriceFeedTestnet();
      }
    } else {
      collaterals[0] = IERC20Metadata(scriptMetadata.wSonic);
      vars.priceFeeds[0] = new WETHPriceFeed(
        deployer, config.sonicOracleContract, ETH_USD_STALENESS_THRESHOLD
      );
      collaterals[1] = IERC20Metadata(scriptMetadata.lBTC);
      // TODO: Add price feed for lBTC
      vars.priceFeeds[1] = new PriceFeedTestnet();
    }

    for (uint256 i = 0; i < totalCollaterals; ++i) {
      (addressesRegistries[i], troveManagers[i]) =
        _deployAddressesRegistry(troveManagerParamsArray[i]);
    }

    CollateralRegistry collateralRegistry =
      new CollateralRegistry(scriptMetadata.boldToken, collaterals, troveManagers);
    HintHelpers hintHelpers = new HintHelpers(collateralRegistry);
    MultiTroveGetter multiTroveGetter = new MultiTroveGetter(collateralRegistry);

    // Deploy per-branch contracts for each branch
    for (uint256 i = 0; i < totalCollaterals; ++i) {
      protocolContracts[i] = _deployAndConnectCollateralContracts(
        collaterals[i],
        priceFeeds[i],
        IBoldToken(scriptMetadata.boldToken),
        collateralRegistry,
        addressesRegistries[i],
        troveManagers[i],
        hintHelpers,
        multiTroveGetter,
        computeGovernanceAddress(_deployGovernanceParams)
      );
    }

    IBoldToken(scriptMetadata.boldToken).setCollateralContracts(
      address(collateralRegistry)
    );
  }

  function _deployAddressesRegistry(TroveManagerParams memory _troveManagerParams)
    internal
    returns (IAddressesRegistry, ITroveManager)
  {
    IAddressesRegistry addressesRegistry = new AddressesRegistry(
      deployer,
      _troveManagerParams.CCR,
      _troveManagerParams.MCR,
      _troveManagerParams.BCR,
      _troveManagerParams.SCR,
      _troveManagerParams.LIQUIDATION_PENALTY_SP,
      _troveManagerParams.LIQUIDATION_PENALTY_REDISTRIBUTION
    );

    address troveManagerAddress = vm.computeCreate2Address(
      DEPLOYMENT_SALT,
      keccak256(getBytecode(type(TroveManager).creationCode, address(addressesRegistry)))
    );

    return (addressesRegistry, ITroveManager(troveManagerAddress));
  }

  function _deployAndConnectCollateralContracts(
    IERC20Metadata _collToken,
    IPriceFeed _priceFeed,
    IBoldToken _boldToken,
    ICollateralRegistry _collateralRegistry,
    IAddressesRegistry _addressesRegistry,
    address _troveManagerAddress,
    IHintHelpers _hintHelpers,
    IMultiTroveGetter _multiTroveGetter,
    address _governance
  ) internal returns (LiquityContracts memory contracts) {
    LiquityContractAddresses memory addresses;
    contracts.collToken = _collToken;

    // Deploy all contracts, using testers for TM and PriceFeed
    contracts.addressesRegistry = _addressesRegistry;

    // Deploy Metadata
    contracts.metadataNFT = deployMetadata(DEPLOYMENT_SALT);
    addresses.metadataNFT = address(contracts.metadataNFT);

    contracts.priceFeed = _priceFeed;
    contracts.interestRouter = IInterestRouter(_governance);
    addresses.borrowerOperations = vm.computeCreate2Address(
      DEPLOYMENT_SALT,
      keccak256(
        getBytecode(
          type(BorrowerOperations).creationCode, address(contracts.addressesRegistry)
        )
      )
    );
    addresses.troveManager = _troveManagerAddress;
    addresses.troveNFT = vm.computeCreate2Address(
      DEPLOYMENT_SALT,
      keccak256(
        getBytecode(type(TroveNFT).creationCode, address(contracts.addressesRegistry))
      )
    );
    addresses.stabilityPool = vm.computeCreate2Address(
      DEPLOYMENT_SALT,
      keccak256(
        getBytecode(
          type(StabilityPool).creationCode, address(contracts.addressesRegistry)
        )
      )
    );
    addresses.activePool = vm.computeCreate2Address(
      DEPLOYMENT_SALT,
      keccak256(
        getBytecode(type(ActivePool).creationCode, address(contracts.addressesRegistry))
      )
    );
    addresses.defaultPool = vm.computeCreate2Address(
      DEPLOYMENT_SALT,
      keccak256(
        getBytecode(type(DefaultPool).creationCode, address(contracts.addressesRegistry))
      )
    );
    addresses.gasPool = vm.computeCreate2Address(
      DEPLOYMENT_SALT,
      keccak256(
        getBytecode(type(GasPool).creationCode, address(contracts.addressesRegistry))
      )
    );
    addresses.collSurplusPool = vm.computeCreate2Address(
      DEPLOYMENT_SALT,
      keccak256(
        getBytecode(
          type(CollSurplusPool).creationCode, address(contracts.addressesRegistry)
        )
      )
    );
    addresses.sortedTroves = vm.computeCreate2Address(
      DEPLOYMENT_SALT,
      keccak256(
        getBytecode(type(SortedTroves).creationCode, address(contracts.addressesRegistry))
      )
    );

    IAddressesRegistry.AddressVars memory addressVars = IAddressesRegistry.AddressVars({
      collToken: _collToken,
      borrowerOperations: IBorrowerOperations(addresses.borrowerOperations),
      troveManager: ITroveManager(addresses.troveManager),
      troveNFT: ITroveNFT(addresses.troveNFT),
      metadataNFT: IMetadataNFT(addresses.metadataNFT),
      stabilityPool: IStabilityPool(addresses.stabilityPool),
      priceFeed: contracts.priceFeed,
      activePool: IActivePool(addresses.activePool),
      defaultPool: IDefaultPool(addresses.defaultPool),
      gasPoolAddress: addresses.gasPool,
      collSurplusPool: ICollSurplusPool(addresses.collSurplusPool),
      sortedTroves: ISortedTroves(addresses.sortedTroves),
      interestRouter: contracts.interestRouter,
      hintHelpers: _hintHelpers,
      multiTroveGetter: _multiTroveGetter,
      collateralRegistry: _collateralRegistry,
      boldToken: _boldToken,
      WETH: WETH
    });
    contracts.addressesRegistry.setAddresses(addressVars);
    contracts.priceFeed.setAddresses(addresses.borrowerOperations);

    contracts.borrowerOperations =
      new BorrowerOperations{ salt: DEPLOYMENT_SALT }(contracts.addressesRegistry);
    contracts.troveManager =
      new TroveManager{ salt: DEPLOYMENT_SALT }(contracts.addressesRegistry);
    contracts.troveNFT =
      new TroveNFT{ salt: DEPLOYMENT_SALT }(contracts.addressesRegistry);
    contracts.stabilityPool =
      new StabilityPool{ salt: DEPLOYMENT_SALT }(contracts.addressesRegistry);
    contracts.activePool =
      new ActivePool{ salt: DEPLOYMENT_SALT }(contracts.addressesRegistry);
    contracts.defaultPool =
      new DefaultPool{ salt: DEPLOYMENT_SALT }(contracts.addressesRegistry);
    contracts.gasPool = new GasPool{ salt: DEPLOYMENT_SALT }(contracts.addressesRegistry);
    contracts.collSurplusPool =
      new CollSurplusPool{ salt: DEPLOYMENT_SALT }(contracts.addressesRegistry);
    contracts.sortedTroves =
      new SortedTroves{ salt: DEPLOYMENT_SALT }(contracts.addressesRegistry);

    assert(address(contracts.borrowerOperations) == addresses.borrowerOperations);
    assert(address(contracts.troveManager) == addresses.troveManager);
    assert(address(contracts.troveNFT) == addresses.troveNFT);
    assert(address(contracts.stabilityPool) == addresses.stabilityPool);
    assert(address(contracts.activePool) == addresses.activePool);
    assert(address(contracts.defaultPool) == addresses.defaultPool);
    assert(address(contracts.gasPool) == addresses.gasPool);
    assert(address(contracts.collSurplusPool) == addresses.collSurplusPool);
    assert(address(contracts.sortedTroves) == addresses.sortedTroves);

    // Connect contracts
    _boldToken.setBranchAddresses(
      address(contracts.troveManager),
      address(contracts.stabilityPool),
      address(contracts.borrowerOperations),
      address(contracts.activePool)
    );
  }
}
