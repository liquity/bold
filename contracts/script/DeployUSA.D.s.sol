// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import {StdCheats} from "forge-std/StdCheats.sol";
import {IERC20Metadata} from "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {Strings} from "openzeppelin-contracts/contracts/utils/Strings.sol";
import {StringFormatting} from "test/Utils/StringFormatting.sol";
import {Accounts} from "test/TestContracts/Accounts.sol";
import {ETH_GAS_COMPENSATION} from "src/Dependencies/Constants.sol";
import {IBorrowerOperations} from "src/Interfaces/IBorrowerOperations.sol";
import "src/AddressesRegistry.sol";
import "src/ActivePool.sol";
import "src/BoldToken.sol";
import "src/BorrowerOperations.sol";
import "src/CollSurplusPool.sol";
import "src/DefaultPool.sol";
import "src/GasPool.sol";
import "src/HintHelpers.sol";
import "src/MultiTroveGetter.sol";
import "src/SortedTroves.sol";
import "src/TroveManager.sol";
import "src/StabilityPool.sol";
import "src/TroveNFT.sol";
import "src/CollateralRegistry.sol";
import {MetadataDeployment, MetadataNFT} from "test/TestContracts/MetadataDeployment.sol";
import "src/Zappers/WETHZapper.sol";
import "src/Zappers/GasCompZapper.sol";
import "src/Zappers/LeverageLSTZapper.sol";
import "src/Zappers/LeverageWETHZapper.sol";
import "src/Zappers/Modules/Exchanges/HybridCurveUniV3ExchangeHelpers.sol";
import {BalancerFlashLoan} from "src/Zappers/Modules/FlashLoans/BalancerFlashLoan.sol";
import "src/Zappers/Modules/Exchanges/Curve/ICurveStableswapNGFactory.sol";
import "src/Zappers/Modules/Exchanges/UniswapV3/ISwapRouter.sol";
import "src/Zappers/Modules/Exchanges/UniswapV3/IQuoterV2.sol";
import "src/Zappers/Modules/Exchanges/UniswapV3/IUniswapV3Pool.sol";
import "src/Zappers/Modules/Exchanges/UniswapV3/IUniswapV3Factory.sol";
import "src/Zappers/Modules/Exchanges/UniswapV3/INonfungiblePositionManager.sol";
import "src/Zappers/Modules/Exchanges/HybridCurveUniV3Exchange.sol";
import "forge-std/console2.sol";
import {WETHPriceFeed} from "src/PriceFeeds/WETHPriceFeed.sol";
import {IWETH} from "src/Interfaces/IWETH.sol";
import {InterestRouter} from "src/InterestRouter.sol";
import {ScrvUsdOracle} from "src/PriceFeeds/USA.D/ScrvUsdOracle.sol";
import {SdaiOracle} from "src/PriceFeeds/USA.D/SdaiOracle.sol";
import {SfrxEthOracle} from "src/PriceFeeds/USA.D/SfrxEthOracle.sol";
import {TbtcOracle} from "src/PriceFeeds/USA.D/TbtcOracle.sol";
import {WbtcOracle} from "src/PriceFeeds/USA.D/WbtcOracle.sol";
import {SusdsOracle} from "src/PriceFeeds/USA.D/SusdsOracle.sol";
import {CrvUsdFallbackOracle} from "src/PriceFeeds/USA.D/Fallbacks/CrvUsdFallbackOracle.sol";
import {SfrxEthFallbackOracle} from "src/PriceFeeds/USA.D/Fallbacks/SfrxEthFallbackOracle.sol";
import {TbtcFallbackOracle} from "src/PriceFeeds/USA.D/Fallbacks/TbtcFallbackOracle.sol";
import {WbtcFallbackOracle} from "src/PriceFeeds/USA.D/Fallbacks/WbtcFallbackOracle.sol";
import {USAZapper} from "src/Zappers/USAZapper.sol";

// ---- Usage ----

// deploy:
// forge script src/scripts/DeployUSA.D.s.sol:DeployUSADScript --verify --slow --legacy --etherscan-api-key $KEY --rpc-url $RPC_URL --broadcast

contract DeployUSADScript is StdCheats, MetadataDeployment {
    using Strings for *;
    using StringFormatting for *;

    ICurveStableswapNGFactory constant curveStableswapFactory =
        ICurveStableswapNGFactory(0x6A8cbed756804B16E05E741eDaBd5cB544AE21bf);
    uint128 constant BOLD_TOKEN_INDEX = 0;
    uint128 constant USDC_INDEX = 1;

    bytes32 SALT;
    address deployer;

    uint256 lastTroveIndex;

    CrvUsdFallbackOracle scrvUsdFallbackOracle;
    SfrxEthFallbackOracle sfrxEthFallbackOracle;
    TbtcFallbackOracle tbtcFallbackOracle;
    WbtcFallbackOracle wbtcFallbackOracle;

    struct LiquityContractsTestnet {
        IAddressesRegistry addressesRegistry;
        IActivePool activePool;
        IBorrowerOperations borrowerOperations;
        ICollSurplusPool collSurplusPool;
        IDefaultPool defaultPool;
        ISortedTroves sortedTroves;
        IStabilityPool stabilityPool;
        ITroveManager troveManager;
        ITroveNFT troveNFT;
        MetadataNFT metadataNFT;
        WETHPriceFeed priceFeed;
        GasPool gasPool;
        IInterestRouter interestRouter;
        IERC20Metadata collToken;
        address zapper;
        GasCompZapper gasCompZapper;
        ILeverageZapper leverageZapper;
        address oracle;
    }

    struct LiquityContractAddresses {
        address activePool;
        address borrowerOperations;
        address collSurplusPool;
        address defaultPool;
        address sortedTroves;
        address stabilityPool;
        address troveManager;
        address troveNFT;
        address metadataNFT;
        address priceFeed;
        address gasPool;
        address interestRouter;
    }

    struct Zappers {
        WETHZapper wethZapper;
        GasCompZapper gasCompZapper;
    }

    struct TroveManagerParams {
        uint256 CCR;
        uint256 MCR;
        uint256 SCR;
        uint256 LIQUIDATION_PENALTY_SP;
        uint256 LIQUIDATION_PENALTY_REDISTRIBUTION;
    }

    struct DeploymentVarsTestnet {
        uint256 numCollaterals;
        IERC20Metadata[] collaterals;
        IAddressesRegistry[] addressesRegistries;
        ITroveManager[] troveManagers;
        LiquityContractsTestnet contracts;
        bytes bytecode;
        address boldTokenAddress;
        uint256 i;
    }

    struct DeploymentResult {
        LiquityContractsTestnet[] contractsArray;
        ICollateralRegistry collateralRegistry;
        IBoldToken boldToken;
        IERC20 usdc;
        ICurveStableswapNGPool usdcCurvePool;
        HintHelpers hintHelpers;
        MultiTroveGetter multiTroveGetter;
        IExchangeHelpers exchangeHelpers;
    }

    MetadataNFT metadataNFT;

    uint256 constant _24_HOURS = 86400;
    uint256 constant _1_HOUR = 3600;
    address constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address constant SCRVUSD = 0x0655977FEb2f289A4aB78af67BAB0d17aAb84367;
    address constant SDAI = 0x83F20F44975D03b1b09e64809B757c47f942BEeA;
    address constant SFRXETH = 0xac3E018457B222d93114458476f3E3416Abbe38F;
    address constant TBTC = 0x18084fbA666a33d37592fA2633fD49a74DD93a88;
    address constant WBTC = 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599;
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant SUSDS = 0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD;

    function run() public returns (DeploymentResult memory deployed) {
        SALT = keccak256(abi.encodePacked(block.timestamp));

        uint256 privateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        deployer = vm.addr(privateKey);
        vm.startBroadcast(privateKey);

        console2.log(deployer, "deployer");
        console2.log(deployer.balance, "deployer balance");

        TroveManagerParams[] memory troveManagerParamsArray = new TroveManagerParams[](6);
        troveManagerParamsArray[0] = TroveManagerParams(120e16, 110e16, 105e16, 5e16, 10e16); // scrvUSD
        troveManagerParamsArray[1] = TroveManagerParams(120e16, 110e16, 105e16, 5e16, 10e16); // sDAI
        troveManagerParamsArray[2] = TroveManagerParams(150e16, 120e16, 110e16, 5e16, 10e16); // sfrxETH
        troveManagerParamsArray[3] = TroveManagerParams(150e16, 125e16, 115e16, 5e16, 10e16); // tBTC
        troveManagerParamsArray[4] = TroveManagerParams(150e16, 120e16, 110e16, 5e16, 10e16); // WBTC
        troveManagerParamsArray[5] = TroveManagerParams(120e16, 110e16, 105e16, 5e16, 10e16); // sUSDS


        string[] memory collNames = new string[](6);
        string[] memory collSymbols = new string[](6);
        collNames[0] = "Savings crvUSD";
        collNames[1] = "Savings DAI";
        collNames[2] = "Staked Frax Ether";
        collNames[3] = "tBTC v2";
        collNames[4] = "Wrapped BTC";
        collNames[5] = "Savings USDS";
        collSymbols[0] = "scrvUSD";
        collSymbols[1] = "sDAI";
        collSymbols[2] = "sfrxETH";
        collSymbols[3] = "tBTC";
        collSymbols[4] = "WBTC";
        collSymbols[5] = "sUSDS";

        deployed =
            _deployAndConnectContracts(troveManagerParamsArray, collNames, collSymbols);

        vm.stopBroadcast();

        string memory governanceManifest = "";
        vm.writeFile("deployment-manifest.json", _getManifestJson(deployed, governanceManifest));
    }

    // See: https://solidity-by-example.org/app/create2/
    function getBytecode(bytes memory _creationCode, address _addressesRegistry) public pure returns (bytes memory) {
        return abi.encodePacked(_creationCode, abi.encode(_addressesRegistry));
    }

    function _deployAndConnectContracts(
        TroveManagerParams[] memory troveManagerParamsArray,
        string[] memory _collNames,
        string[] memory _collSymbols
    ) internal returns (DeploymentResult memory r) {
        assert(_collNames.length == troveManagerParamsArray.length);
        assert(_collSymbols.length == troveManagerParamsArray.length);

        DeploymentVarsTestnet memory vars;
        vars.numCollaterals = troveManagerParamsArray.length;
        // Deploy Bold
        vars.bytecode = abi.encodePacked(type(BoldToken).creationCode, abi.encode(deployer));
        vars.boldTokenAddress = vm.computeCreate2Address(SALT, keccak256(vars.bytecode));
        r.boldToken = new BoldToken{salt: SALT}(deployer);
        assert(address(r.boldToken) == vars.boldTokenAddress);

        // USDC and USDC-BOLD pool
        r.usdc = IERC20(USDC);
        r.usdcCurvePool = _deployCurveBoldUsdcPool(r.boldToken, r.usdc);

        r.contractsArray = new LiquityContractsTestnet[](vars.numCollaterals);
        vars.collaterals = new IERC20Metadata[](vars.numCollaterals);
        vars.addressesRegistries = new IAddressesRegistry[](vars.numCollaterals);
        vars.troveManagers = new ITroveManager[](vars.numCollaterals);

        vars.collaterals[0] = IERC20Metadata(SCRVUSD);
        vars.collaterals[1] = IERC20Metadata(SDAI);
        vars.collaterals[2] = IERC20Metadata(SFRXETH);
        vars.collaterals[3] = IERC20Metadata(TBTC);
        vars.collaterals[4] = IERC20Metadata(WBTC);
        vars.collaterals[5] = IERC20Metadata(SUSDS);


        // Deploy AddressesRegistries and get TroveManager addresses
        for (vars.i = 0; vars.i < vars.numCollaterals; vars.i++) {
            (IAddressesRegistry addressesRegistry, address troveManagerAddress) =
                _deployAddressesRegistry(troveManagerParamsArray[vars.i]);
            vars.addressesRegistries[vars.i] = addressesRegistry;
            vars.troveManagers[vars.i] = ITroveManager(troveManagerAddress);
        }

        r.collateralRegistry = new CollateralRegistry(r.boldToken, vars.collaterals, vars.troveManagers);
        r.hintHelpers = new HintHelpers(r.collateralRegistry);
        r.multiTroveGetter = new MultiTroveGetter(r.collateralRegistry);

        metadataNFT = deployMetadata(SALT);

        // Deploy per-branch contracts for each branch
        for (vars.i = 0; vars.i < vars.numCollaterals; vars.i++) {
            vars.contracts = _deployAndConnectCollateralContractsMainnet(
                vars.collaterals[vars.i],
                r.boldToken,
                r.collateralRegistry,
                vars.addressesRegistries[vars.i],
                address(vars.troveManagers[vars.i]),
                r.hintHelpers,
                r.multiTroveGetter
            );
            r.contractsArray[vars.i] = vars.contracts;
        }

        r.boldToken.setCollateralRegistry(address(r.collateralRegistry));
    }

    function _deployAddressesRegistry(TroveManagerParams memory _troveManagerParams)
        internal
        returns (IAddressesRegistry, address)
    {
        IAddressesRegistry addressesRegistry = new AddressesRegistry(
            deployer,
            _troveManagerParams.CCR,
            _troveManagerParams.MCR,
            _troveManagerParams.SCR,
            _troveManagerParams.LIQUIDATION_PENALTY_SP,
            _troveManagerParams.LIQUIDATION_PENALTY_REDISTRIBUTION
        );
        address troveManagerAddress = vm.computeCreate2Address(
            SALT, keccak256(getBytecode(type(TroveManager).creationCode, address(addressesRegistry)))
        );

        return (addressesRegistry, troveManagerAddress);
    }

    function _deployAndConnectCollateralContractsMainnet(
        IERC20Metadata _collToken,
        IBoldToken _boldToken,
        ICollateralRegistry _collateralRegistry,
        IAddressesRegistry _addressesRegistry,
        address _troveManagerAddress,
        IHintHelpers _hintHelpers,
        IMultiTroveGetter _multiTroveGetter
    ) internal returns (LiquityContractsTestnet memory contracts) {
        LiquityContractAddresses memory addresses;
        contracts.collToken = _collToken;

        // Deploy all contracts, using testers for TM and PriceFeed
        contracts.addressesRegistry = _addressesRegistry;

        // Deploy Metadata
        contracts.metadataNFT = metadataNFT;
        addresses.metadataNFT = address(metadataNFT);

        addresses.borrowerOperations = vm.computeCreate2Address(
            SALT, keccak256(getBytecode(type(BorrowerOperations).creationCode, address(contracts.addressesRegistry)))
        );

        uint256 _stalenessThreshold;
        if (address(_collToken) == SCRVUSD) {
            _stalenessThreshold = _24_HOURS; // CL crvUSD/USD heartbeat. Fallback is block.timestamp
            CrvUsdFallbackOracle fallbackOracle = new CrvUsdFallbackOracle();
            contracts.oracle = address(new ScrvUsdOracle(address(fallbackOracle)));
            scrvUsdFallbackOracle = fallbackOracle;
        } else if (address(_collToken) == SDAI) {
            _stalenessThreshold = _1_HOUR; // CL DAI/USD heartbeat. No Fallback
            contracts.oracle = address(new SdaiOracle());
        } else if (address(_collToken) == SFRXETH) {
            _stalenessThreshold = _1_HOUR; // CL ETH/USD heartbeat. Fallback is block.timestamp
            SfrxEthFallbackOracle fallbackOracle = new SfrxEthFallbackOracle();
            contracts.oracle = address(new SfrxEthOracle(address(fallbackOracle)));
            sfrxEthFallbackOracle = fallbackOracle;
        } else if (address(_collToken) == TBTC) {
            _stalenessThreshold = _24_HOURS; // CL tBTC/USD heartbeat. Fallback is block.timestamp
            TbtcFallbackOracle fallbackOracle = new TbtcFallbackOracle();
            contracts.oracle = address(new TbtcOracle(address(fallbackOracle)));
            tbtcFallbackOracle = fallbackOracle;
        } else if (address(_collToken) == WBTC) {
            _stalenessThreshold = _24_HOURS; // CL WBTC/BTC heartbeat. Fallback is block.timestamp
            WbtcFallbackOracle fallbackOracle = new WbtcFallbackOracle();
            contracts.oracle = address(new WbtcOracle(address(fallbackOracle)));
            wbtcFallbackOracle = fallbackOracle;
        } else if (address(_collToken) == SUSDS) {
            _stalenessThreshold = _1_HOUR; // CL DAI/USD heartbeat. No Fallback
            contracts.oracle = address(new SusdsOracle());
        } else {
            revert("Collateral not supported");
        }

        contracts.priceFeed = new WETHPriceFeed(addresses.borrowerOperations, contracts.oracle, _stalenessThreshold);
        contracts.interestRouter = new InterestRouter();

        addresses.troveManager = _troveManagerAddress;
        addresses.troveNFT = vm.computeCreate2Address(
            SALT, keccak256(getBytecode(type(TroveNFT).creationCode, address(contracts.addressesRegistry)))
        );
        addresses.stabilityPool = vm.computeCreate2Address(
            SALT, keccak256(getBytecode(type(StabilityPool).creationCode, address(contracts.addressesRegistry)))
        );
        addresses.activePool = vm.computeCreate2Address(
            SALT, keccak256(getBytecode(type(ActivePool).creationCode, address(contracts.addressesRegistry)))
        );
        addresses.defaultPool = vm.computeCreate2Address(
            SALT, keccak256(getBytecode(type(DefaultPool).creationCode, address(contracts.addressesRegistry)))
        );
        addresses.gasPool = vm.computeCreate2Address(
            SALT, keccak256(getBytecode(type(GasPool).creationCode, address(contracts.addressesRegistry)))
        );
        addresses.collSurplusPool = vm.computeCreate2Address(
            SALT, keccak256(getBytecode(type(CollSurplusPool).creationCode, address(contracts.addressesRegistry)))
        );
        addresses.sortedTroves = vm.computeCreate2Address(
            SALT, keccak256(getBytecode(type(SortedTroves).creationCode, address(contracts.addressesRegistry)))
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
            WETH: IWETH(WETH)
        });
        contracts.addressesRegistry.setAddresses(addressVars);

        contracts.borrowerOperations = new BorrowerOperations{salt: SALT}(contracts.addressesRegistry);
        contracts.troveManager = new TroveManager{salt: SALT}(contracts.addressesRegistry);
        contracts.troveNFT = new TroveNFT{salt: SALT}(contracts.addressesRegistry);
        contracts.stabilityPool = new StabilityPool{salt: SALT}(contracts.addressesRegistry);
        contracts.activePool = new ActivePool{salt: SALT}(contracts.addressesRegistry);
        contracts.defaultPool = new DefaultPool{salt: SALT}(contracts.addressesRegistry);
        contracts.gasPool = new GasPool{salt: SALT}(contracts.addressesRegistry);
        contracts.collSurplusPool = new CollSurplusPool{salt: SALT}(contracts.addressesRegistry);
        contracts.sortedTroves = new SortedTroves{salt: SALT}(contracts.addressesRegistry);

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

        contracts.zapper = address(new USAZapper(contracts.addressesRegistry));
    }

    function _deployCurveBoldUsdcPool(IBoldToken _boldToken, IERC20 _usdc) internal returns (ICurveStableswapNGPool) {
        // // deploy Curve StableswapNG pool
        // address[] memory coins = new address[](2);
        // coins[BOLD_TOKEN_INDEX] = address(_boldToken);
        // coins[USDC_INDEX] = address(_usdc);
        // uint8[] memory assetTypes = new uint8[](2); // 0: standard
        // bytes4[] memory methodIds = new bytes4[](2);
        // address[] memory oracles = new address[](2);
        // ICurveStableswapNGPool curvePool = curveStableswapFactory.deploy_plain_pool(
        //     "USDC-USA.d",
        //     "USDCUSA.d",
        //     coins,
        //     100, // A
        //     1000000, // fee
        //     20000000000, // _offpeg_fee_multiplier
        //     866, // _ma_exp_time
        //     0, // implementation id
        //     assetTypes,
        //     methodIds,
        //     oracles
        // );

        // return curvePool;
    }

    function _getBranchContractsJson(LiquityContractsTestnet memory c) internal pure returns (string memory) {
        return string.concat(
            "{",
            string.concat(
                // Avoid stack too deep by chunking concats
                string.concat(
                    string.concat('"addressesRegistry":"', address(c.addressesRegistry).toHexString(), '",'),
                    string.concat('"activePool":"', address(c.activePool).toHexString(), '",'),
                    string.concat('"borrowerOperations":"', address(c.borrowerOperations).toHexString(), '",'),
                    string.concat('"collSurplusPool":"', address(c.collSurplusPool).toHexString(), '",'),
                    string.concat('"defaultPool":"', address(c.defaultPool).toHexString(), '",'),
                    string.concat('"sortedTroves":"', address(c.sortedTroves).toHexString(), '",'),
                    string.concat('"stabilityPool":"', address(c.stabilityPool).toHexString(), '",'),
                    string.concat('"troveManager":"', address(c.troveManager).toHexString(), '",')
                ),
                string.concat(
                    string.concat('"troveNFT":"', address(c.troveNFT).toHexString(), '",'),
                    string.concat('"metadataNFT":"', address(c.metadataNFT).toHexString(), '",'),
                    string.concat('"priceFeed":"', address(c.priceFeed).toHexString(), '",'),
                    string.concat('"gasPool":"', address(c.gasPool).toHexString(), '",'),
                    string.concat('"interestRouter":"', address(c.interestRouter).toHexString(), '",'),
                    string.concat('"zapper":"', address(c.zapper).toHexString(), '",'),
                    string.concat('"gasCompZapper":"', address(c.gasCompZapper).toHexString(), '",'),
                    string.concat('"leverageZapper":"', address(c.leverageZapper).toHexString(), '",')
                ),
                string.concat(
                    string.concat('"collToken":"', address(c.collToken).toHexString(), '"') // no comma
                )
            ),
            "}"
        );
    }

    function _getDeploymentConstants() internal pure returns (string memory) {
        return string.concat(
            "{",
            string.concat(
                string.concat('"ETH_GAS_COMPENSATION":"', ETH_GAS_COMPENSATION.toString(), '",'),
                string.concat('"INTEREST_RATE_ADJ_COOLDOWN":"', INTEREST_RATE_ADJ_COOLDOWN.toString(), '",'),
                string.concat('"MAX_ANNUAL_INTEREST_RATE":"', MAX_ANNUAL_INTEREST_RATE.toString(), '",'),
                string.concat('"MIN_ANNUAL_INTEREST_RATE":"', MIN_ANNUAL_INTEREST_RATE.toString(), '",'),
                string.concat('"MIN_DEBT":"', MIN_DEBT.toString(), '",'),
                string.concat('"SP_YIELD_SPLIT":"', SP_YIELD_SPLIT.toString(), '",'),
                string.concat('"UPFRONT_INTEREST_PERIOD":"', UPFRONT_INTEREST_PERIOD.toString(), '"') // no comma
            ),
            "}"
        );
    }

    function _getManifestJson(DeploymentResult memory deployed, string memory _governanceManifest)
        internal
        pure
        returns (string memory)
    {
        string[] memory branches = new string[](deployed.contractsArray.length);

        // Poor man's .map()
        for (uint256 i = 0; i < branches.length; ++i) {
            branches[i] = _getBranchContractsJson(deployed.contractsArray[i]);
        }

        return string.concat(
            "{",
            string.concat(
                string.concat('"constants":', _getDeploymentConstants(), ","),
                string.concat('"collateralRegistry":"', address(deployed.collateralRegistry).toHexString(), '",'),
                string.concat('"boldToken":"', address(deployed.boldToken).toHexString(), '",'),
                string.concat('"hintHelpers":"', address(deployed.hintHelpers).toHexString(), '",'),
                string.concat('"multiTroveGetter":"', address(deployed.multiTroveGetter).toHexString(), '",'),
                string.concat('"exchangeHelpers":"', address(deployed.exchangeHelpers).toHexString(), '",'),
                string.concat('"branches":[', branches.join(","), "],"),
                string.concat('"governance":', _governanceManifest, '" ') // no comma
            ),
            "}"
        );
    }
}

// deployed: struct DeployUSADScript.DeploymentResult DeploymentResult({ contractsArray: [LiquityContractsTestnet({ addressesRegistry: 0x3249b3196798cAfc3a3fF023f719196410C7836e, activePool: 0xcB1db13418ff25217080F8feeE4E31d34f3F3040, borrowerOperations: 0x01646d82f996EBC90422c62BDD17689d57E3c30F, collSurplusPool: 0x8d901B07903a94dab90Dd323201466D630541ea4, defaultPool: 0x29fd891A5157b7C66703358C9E737056842A4b7A, sortedTroves: 0x54A14A67D584d579eb46c274F93277f4cefB3e04, stabilityPool: 0x8a7cDe8AaF70536810624b18Fb0e393Fa604CE61, troveManager: 0x13b86Eb24De4828611Dfa009f931830623Adf664, troveNFT: 0x7aE819f1cC95DD0AB70be8e0d565aE5d994E6334, metadataNFT: 0xb3B266eBCd5460e9385db31FcA92dAE362EEE26C, priceFeed: 0x37B2090bBd1ba4e46D803286E18775CbbaC86259, gasPool: 0x15EDc50a5C5d6656a7972D6490A481884C0d3dFf, interestRouter: 0xf5878971316acb5072f115A046D1F405D71E9173, collToken: 0x0655977FEb2f289A4aB78af67BAB0d17aAb84367, zapper: 0x2FE5E05B34aefc2a1d7eeaBad313872e963dec84, gasCompZapper: 0x0000000000000000000000000000000000000000, leverageZapper: 0x0000000000000000000000000000000000000000, oracle: 0xF121B5C4a37335fD1189aeA306b996487aae55B8 }), LiquityContractsTestnet({ addressesRegistry: 0x6b284E60B80682be76134b1b2a6CA85f6A360E81, activePool: 0x91B302BeDf3fc152B96912517CFbe262f30608b3, borrowerOperations: 0x925422EbBDd70c2EB9bfDdee5B3E80f663beC86A, collSurplusPool: 0xf1bF81fF146E71019eA321b75C0437842f6745BF, defaultPool: 0x34b31fF9D7001650BCD313cD5b0Eed55c88DD883, sortedTroves: 0x4De90a797d7680e8f03B740174DC3e542048E539, stabilityPool: 0x631330C8b8317aA58cF7cbC95BBbFe5b9CB1930e, troveManager: 0x165ff647c2674fdB519dB2490d586599c9C807a3, troveNFT: 0x16F4B80C1079c8d79bD37F7d22c2c438CE1CDCcB, metadataNFT: 0xb3B266eBCd5460e9385db31FcA92dAE362EEE26C, priceFeed: 0xEd07B701ED7b1B12Cecc0dFAEa27ee8Cc94D4ee0, gasPool: 0x479b11f447049f5e5Ba3F7fCBf8DFab9d2AE05a3, interestRouter: 0x7471760bd5B6F8778a69a7bdC5490A5Fac0c1fA4, collToken: 0x83F20F44975D03b1b09e64809B757c47f942BEeA, zapper: 0x90695d1A4eCF1821BE75bA954293E6dDdDB6273F, gasCompZapper: 0x0000000000000000000000000000000000000000, leverageZapper: 0x0000000000000000000000000000000000000000, oracle: 0x08E16cb013e06F9C7B1f915CcD560263398680E7 }), LiquityContractsTestnet({ addressesRegistry: 0x37C47dF67d664aBbC382D9D80B629678F3F83004, activePool: 0xDF083be7595564716349680Cc5D7525199BBBBCB, borrowerOperations: 0xdA8d4691C9C82c1c6635222195B669CF7E00A7a4, collSurplusPool: 0xE4A3B291B924eA690086ac7839A43F616bd47918, defaultPool: 0x447821d723ECAB9865dC2d8e3D49B4163025BD74, sortedTroves: 0x9eF10447165e3EfEE7042dA970B4Ee2949596200, stabilityPool: 0x4eE3751E853c550B8De2fCFA05bC41762970892A, troveManager: 0x972b5e84A9aC72B77fFCf4f00ACB80240b6437e4, troveNFT: 0x7d458EA4385C34004647dd7C7e83e6A52bE716E5, metadataNFT: 0xb3B266eBCd5460e9385db31FcA92dAE362EEE26C, priceFeed: 0xfE8cF186616e5B3e4dE0a5e2bdAD06167D53A621, gasPool: 0x9e9Cd432Bf62851431cDd647bdD0CAB5EBb88eB6, interestRouter: 0x3314E933182F0DCd2c032a1b70bD76e5E87Fc7A2, collToken: 0xac3E018457B222d93114458476f3E3416Abbe38F, zapper: 0xDbD0258DF0F0cE2899aed1540c5A9F175b7815BE, gasCompZapper: 0x0000000000000000000000000000000000000000, leverageZapper: 0x0000000000000000000000000000000000000000, oracle: 0x1d27f835B6201572B65dcA622aEa185B01fbA54A }), LiquityContractsTestnet({ addressesRegistry: 0x452eB8c3d70B343890A4B16f3971918DFDd96007, activePool: 0x69a90e48376CEa03F7e8a79ce45710C61EEF6968, borrowerOperations: 0x0F5e9FdF728Ea8CED48e57A42299A0909F89dFDd, collSurplusPool: 0x24B0EC88A9550cDa5eEDd0A94016cA9c032a00D6, defaultPool: 0x84067D80A190fc4d639B753c9BE3D6762e388fE5, sortedTroves: 0x287B28c9cD5aC5C3f15811429a3E1A0337206BeC, stabilityPool: 0x4bB3FA8ba566b62b4abF358f826a7a979263CCc4, troveManager: 0x8B22339221B8A5A78AdE6F4A3389EfA6C974BeF6, troveNFT: 0x12942Aa8758B6f78c362AeE84C45B00698bD74aE, metadataNFT: 0xb3B266eBCd5460e9385db31FcA92dAE362EEE26C, priceFeed: 0xfB8CB432FC736F24Ed198e49438361573fEe2571, gasPool: 0x75C959d58DEa777D8066a321750D7A1e1b564E57, interestRouter: 0x6845e84E422Eb97C2Cc2f65757cd0fC5F6E7d644, collToken: 0x18084fbA666a33d37592fA2633fD49a74DD93a88, zapper: 0x6ecf29c3A81471879e94ddCc0127F12164cb331D, gasCompZapper: 0x0000000000000000000000000000000000000000, leverageZapper: 0x0000000000000000000000000000000000000000, oracle: 0xF53A7E09512b5475bb9f34E0b27Faa3fDdC8E17D }), LiquityContractsTestnet({ addressesRegistry: 0x4FC2Cbc3417D6b0915BD768081c34A4537941BF6, activePool: 0xd31d245c75aaFF8221df5EB220bfA0CFCb0e96E6, borrowerOperations: 0x2A838a1976c40326F78c3Ae79E58DaC34B99dD09, collSurplusPool: 0xfA7A6f5fb5385Faf2E3C82bF53524a60686951FD, defaultPool: 0x441c948aD5857f5664a3F4574BdA41DD9f9350be, sortedTroves: 0x075D96b9F4684f0D238BF970d549130323058A13, stabilityPool: 0x1916CBB322456c40649579aee5C7f0c8b463cF3C, troveManager: 0x3318ba0fc72c6a76Db46edB6771F729B77CB9138, troveNFT: 0xbdE004753f9A68CAcB7400DE3220664898B3d7b4, metadataNFT: 0xb3B266eBCd5460e9385db31FcA92dAE362EEE26C, priceFeed: 0x963A4194E7EDFc1D644697048Fb21e4fCDe7a25E, gasPool: 0x36A4bdBb719A066566b0cFB5710b121DAf67a004, interestRouter: 0x5AF17540921cd9d388eAa9344c42c507f38490ce, collToken: 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599, zapper: 0x8387e72cccE6d2C6cEe66E164d1b744d83aD8fa9, gasCompZapper: 0x0000000000000000000000000000000000000000, leverageZapper: 0x0000000000000000000000000000000000000000, oracle: 0x8bee5807853A6e6A15Cfea8da4207D245C82966b }), LiquityContractsTestnet({ addressesRegistry: 0x84F899d30B440D4d1CFFFf08Cd400f07C592CBc1, activePool: 0x40647F2bbd226F74d197Ef6974A266773B24a63a, borrowerOperations: 0x972AD09A47D227172D0055AFfa0b88b1C8e460f0, collSurplusPool: 0x5b2fFA05E1Bf1AFBD669fa3a2204FaB8cf787D8c, defaultPool: 0x5Ad7B79370fD88732F8D5629FB8711f5E95fFa0f, sortedTroves: 0x2874940c308A8b6D47930C7C6da5506d3D079Ef1, stabilityPool: 0xda436f9192EC7468D1589d967B19d9E22A1fF13e, troveManager: 0xaAd0fC75D2B094e56b4298e50f7Faf1A22450D5B, troveNFT: 0xcb87f5AE4c7ef2f9030AE834a7Dc3C0EE37735A7, metadataNFT: 0xb3B266eBCd5460e9385db31FcA92dAE362EEE26C, priceFeed: 0xcd0BAd5D45495c07bcD771657eCA0df50baeD871, gasPool: 0x3367720F7B50396B92954527b5bC171bc7695f93, interestRouter: 0x69BCfAb2eE06458c8001E4e53E1E5D258D46d355, collToken: 0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD, zapper: 0xa38f7a780820E5081Dd51DB94c5F359ca0d5CeEa, gasCompZapper: 0x0000000000000000000000000000000000000000, leverageZapper: 0x0000000000000000000000000000000000000000, oracle: 0xa8076d11890fEa2c400151DbB8377802f5e2aabA })], collateralRegistry: 0xd5D9C0D32890Be92D7680B65E785e4A95C366a35, boldToken: 0x7c6762f4b23317D5f7b51E79ec6Da9449b71C20c, usdc: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48, usdcCurvePool: 0x0000000000000000000000000000000000000000, hintHelpers: 0x94F931867eE170b48673408fC51560C8712f3540, multiTroveGetter: 0x24c62ec7f0d0275934Ef6fC9432921Df87b17ee7, exchangeHelpers: 0x0000000000000000000000000000000000000000 })
