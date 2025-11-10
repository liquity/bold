// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.23;

import {StdCheats} from "forge-std/StdCheats.sol";
import {IERC20Metadata} from "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {Strings} from "openzeppelin-contracts/contracts/utils/Strings.sol";
import {IERC20 as IERC20_GOV} from "openzeppelin/contracts/token/ERC20/IERC20.sol";

import {StringFormatting} from "test/Utils/StringFormatting.sol";
import {Accounts} from "test/TestContracts/Accounts.sol";
import {ERC20Faucet} from "test/TestContracts/ERC20Faucet.sol";
import {ETH_GAS_COMPENSATION} from "src/Dependencies/Constants.sol";
import {IBorrowerOperations} from "src/Interfaces/IBorrowerOperations.sol";
import {IWrappedToken} from "src/Interfaces/IWrappedToken.sol";
import "src/AddressesRegistry.sol";
import "src/ActivePool.sol";
import "src/BoldToken.sol";
import "src/BorrowerOperations.sol";
import "src/TroveManager.sol";
import "src/TroveNFT.sol";
import "src/CollSurplusPool.sol";
import "src/DefaultPool.sol";
import "src/GasPool.sol";
import "src/HintHelpers.sol";
import "src/MultiTroveGetter.sol";
import "src/SortedTroves.sol";
import "src/StabilityPool.sol";
import "src/PriceFeeds/WETHPriceFeed.sol";
import "src/PriceFeeds/yETHPriceFeed.sol";
import "src/PriceFeeds/TBTCPriceFeed.sol";
import "src/PriceFeeds/SAGAPriceFeed.sol";
import "src/PriceFeeds/stATOMPriceFeed.sol";
import "src/PriceFeeds/KINGPriceFeed.sol";
import "src/PriceFeeds/yUSDPriceFeed.sol";
import "src/CollateralRegistry.sol";
import "test/TestContracts/PriceFeedTestnet.sol";
import "test/TestContracts/MetadataDeployment.sol";
import "test/Utils/Logging.sol";
import "test/Utils/StringEquality.sol";
import "src/Zappers/WETHZapper.sol";
import "src/Zappers/GasCompZapper.sol";
import "src/Zappers/WrappedTokenZapper.sol";
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
import "src/Zappers/Modules/Exchanges/UniswapV3/UniPriceConverter.sol";
import "src/Zappers/Modules/Exchanges/HybridCurveUniV3Exchange.sol";
import "src/ERC20Wrappers/WrappedToken.sol";
import {WETHTester} from "test/TestContracts/WETHTester.sol";
import "forge-std/console2.sol";
import {IRateProvider, IWeightedPool, IWeightedPoolFactory} from "./Interfaces/Balancer/IWeightedPool.sol";
import {IVault} from "./Interfaces/Balancer/IVault.sol";
import {MockStakingV1} from "V2-gov/test/mocks/MockStakingV1.sol";

import {DeployGovernance} from "./DeployGovernance.s.sol";

function _latestUTCMidnightBetweenWednesdayAndThursday() view returns (uint256) {
    return block.timestamp / 1 weeks * 1 weeks;
}

contract DeployLiquity2Script is DeployGovernance, UniPriceConverter, StdCheats, MetadataDeployment, Logging {
    using Strings for *;
    using StringFormatting for *;
    using StringEquality for string;

    // TODO: Change these values
    address GOVERNANCE_ADDRESS = 0x92A857b519F73783E27642c0f4A5DBAc8953e66B;
    string GOVERNANCE_MANIFEST = "";
    uint256 CHAIN_ID = 5464; // Saga EVM Chain ID: 5464

    string constant DEPLOYMENT_MODE_COMPLETE = "complete";
    string constant DEPLOYMENT_MODE_BOLD_ONLY = "bold-only";
    string constant DEPLOYMENT_MODE_USE_EXISTING_BOLD = "use-existing-bold";

    uint256 constant NUM_BRANCHES = 7;

    // used for gas compensation and as collateral of the first branch
    // tapping disallowed
    IWETH WETH;
    IERC20Metadata WRAPPED_SAGA;
    IERC20Metadata WRAPPED_STATOM;
    // IERC20Metadata USDC;
    address WETH_ADDRESS = 0xeb41D53F14Cb9a67907f2b8b5DBc223944158cCb;
    address YETH_ADDRESS = 0xA6F89de43315B444114258f6E6700765D08bcd56;
    address TBTC_ADDRESS = 0x7cF468a019C5bf734311D10C3a429bB504CAF3ce;
    address SAGA_ADDRESS = 0xA19377761FED745723B90993988E04d641c2CfFE; //6 decimals, so we use a wrapper
    address STATOM_ADDRESS = 0xDaF9d9032b5d5C92528d6aFf6a215514B7c21056; //6 decimals, so we use a wrapper
    address KING_ADDRESS = 0x58d9fbBc6037dedfBA99cAfA28e4C371b795ad97;
    address YUSD_ADDRESS = 0x839e7e610108Cf3DCc9b40329db33b6E6bc9baCE;

    //oracles
    address ETH_ORACLE_ADDRESS = 0x069ee88bA5D95df65fC22Aa5281D6E67727ba050;
    address YETH_ORACLE_ADDRESS = 0x26d141cbC1C6bc850AE2cf0038D6394aDE437f7e;
    address TBTC_ORACLE_ADDRESS = 0x52A127e3e394AC2185781b366C6843Cc9ea5d5bD;
    address BTC_ORACLE_ADDRESS = 0xcEbb4f8cDDf5274F9a9253493D22efFc7De2d5a3;
    address SAGA_ORACLE_ADDRESS = 0x96e6662856D9B6cdaAd4876f39989CC538Faa0B1;
    address STATOM_ORACLE_ADDRESS = 0x8730443901DF14D353B9dcc5C77dD2A8Db13A055; //18 decimals.
    address KING_ORACLE_ADDRESS = 0x01196d6E2A543818Dcf4a4ce91Eb23e148c5df9a;
    address YUSD_ORACLE_ADDRESS = 0xc6a0F156f1c6905661d69F437e1ba753C4145528;

    ///////////////////////////////
    //staleness thresholds
    uint256 ETH_USD_STALENESS_THRESHOLD = 25 hours;
    // uint256 STETH_USD_STALENESS_THRESHOLD = 24 hours;
    uint256 YETH_USD_STALENESS_THRESHOLD = 25 hours;
    uint256 TBTC_ETH_STALENESS_THRESHOLD = 25 hours;
    uint256 BTC_USD_STALENESS_THRESHOLD = 25 hours;
    uint256 SAGA_USD_STALENESS_THRESHOLD = 25 hours;
    uint256 STATOM_USD_STALENESS_THRESHOLD = 25 hours;
    uint256 KING_USD_STALENESS_THRESHOLD = 25 hours;
    uint256 YUSD_USD_STALENESS_THRESHOLD = 25 hours;


    bytes32 SALT;
    address deployer;
    bool useTestnetPriceFeeds;

    uint256 lastTroveIndex;

    struct LiquityContracts {
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
        IPriceFeed priceFeed;
        GasPool gasPool;
        IInterestRouter interestRouter;
        IERC20Metadata collToken;
        WETHZapper wethZapper;
        GasCompZapper gasCompZapper;
        ILeverageZapper leverageZapper;
        WrappedTokenZapper wrappedTokenZapper;
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
        uint256 BCR;
        uint256 DEBT_LIMIT;
        uint256 LIQUIDATION_PENALTY_SP;
        uint256 LIQUIDATION_PENALTY_REDISTRIBUTION;
    }

    struct DeploymentVars {
        uint256 numCollaterals;
        IERC20Metadata[] collaterals;
        IAddressesRegistry[] addressesRegistries;
        ITroveManager[] troveManagers;
        LiquityContracts contracts;
        bytes bytecode;
        address boldTokenAddress;
        uint256 i;
    }

    struct DemoTroveParams {
        uint256 collIndex;
        uint256 owner;
        uint256 ownerIndex;
        uint256 coll;
        uint256 debt;
        uint256 annualInterestRate;
    }

    struct DeploymentResult {
        LiquityContracts[] contractsArray;
        ICollateralRegistry collateralRegistry;
        IBoldToken boldToken;
        ICurveStableswapNGPool usdcCurvePool;
        HintHelpers hintHelpers;
        MultiTroveGetter multiTroveGetter;
        IExchangeHelpers exchangeHelpers;
    }

    function run() external {
        string memory saltStr = vm.envOr("SALT", block.timestamp.toString());
        SALT = keccak256(bytes(saltStr));

        if (vm.envBytes("DEPLOYER").length == 20) {
            // address
            deployer = vm.envAddress("DEPLOYER");
            vm.startBroadcast(deployer);
        } else {
            // private key
            uint256 privateKey = vm.envUint("DEPLOYER");
            deployer = vm.addr(privateKey);
            vm.startBroadcast(privateKey);
        }

        string memory deploymentMode = vm.envOr("DEPLOYMENT_MODE", DEPLOYMENT_MODE_COMPLETE);
        require(
            deploymentMode.eq(DEPLOYMENT_MODE_COMPLETE) || deploymentMode.eq(DEPLOYMENT_MODE_BOLD_ONLY)
                || deploymentMode.eq(DEPLOYMENT_MODE_USE_EXISTING_BOLD),
            string.concat("Bad deployment mode: ", deploymentMode)
        );

        // uint256 epochStart = vm.envOr(
        //     "EPOCH_START",
        //     (block.chainid == CHAIN_ID ? _latestUTCMidnightBetweenWednesdayAndThursday() : block.timestamp) - EPOCH_DURATION
        // );

        useTestnetPriceFeeds = vm.envOr("USE_TESTNET_PRICEFEEDS", false);

        _log("Deployer:               ", deployer.toHexString());
        _log("Deployer balance:       ", deployer.balance.decimal());
        _log("Deployment mode:        ", deploymentMode);
        _log("CREATE2 salt:           ", 'keccak256(bytes("', saltStr, '")) = ', uint256(SALT).toHexString());
        // _log("Governance epoch start: ", epochStart.toString());
        _log("Use testnet PriceFeeds: ", useTestnetPriceFeeds ? "yes" : "no");

        // Deploy Bold or pick up existing deployment
        bytes memory boldBytecode = bytes.concat(type(BoldToken).creationCode, abi.encode(deployer));
        address boldAddress = vm.computeCreate2Address(SALT, keccak256(boldBytecode));
        BoldToken boldToken;

        if (deploymentMode.eq(DEPLOYMENT_MODE_USE_EXISTING_BOLD)) {
            require(boldAddress.code.length > 0, string.concat("BOLD not found at ", boldAddress.toHexString()));
            boldToken = BoldToken(boldAddress);

            // Check BOLD is untouched
            require(boldToken.totalSupply() == 0, "Some BOLD has been minted!");
            require(boldToken.collateralRegistryAddress() == address(0), "Collateral registry already set");
            require(boldToken.owner() == deployer, "Not BOLD owner");
        } else {
            vm.sleep(3000);
            boldToken = new BoldToken{salt: SALT}(deployer);
            assert(address(boldToken) == boldAddress);
        }

        if (deploymentMode.eq(DEPLOYMENT_MODE_BOLD_ONLY)) {
            vm.writeFile("deployment-manifest.json", string.concat('{"boldToken":"', boldAddress.toHexString(), '"}'));
            return;
        }

        if (block.chainid == CHAIN_ID) {
            // mainnet
            WETH = IWETH(WETH_ADDRESS);
            // USDC = IERC20Metadata(USDC_ADDRESS);
        } else {
            // sepolia, local
            if (block.chainid == 31337) {
                // local
                WETH = new WETHTester({_tapAmount: 100 ether, _tapPeriod: 1 days});
            } else {
                // sepolia
                WETH = new WETHTester({_tapAmount: 0, _tapPeriod: type(uint256).max});
            }
            // USDC = new ERC20Faucet("USDC", "USDC", 0, type(uint256).max);
        }

        TroveManagerParams[] memory troveManagerParamsArray = new TroveManagerParams[](NUM_BRANCHES);

        // WETH
        troveManagerParamsArray[0] = TroveManagerParams({
            CCR: CCR_WETH,
            MCR: MCR_WETH,
            SCR: SCR_WETH,
            BCR: BCR_ALL,
            DEBT_LIMIT: WETH_DEBT_LIMIT,
            LIQUIDATION_PENALTY_SP: LIQUIDATION_PENALTY_SP_WETH,
            LIQUIDATION_PENALTY_REDISTRIBUTION: LIQUIDATION_PENALTY_REDISTRIBUTION_WETH
        });

        // yETH
        troveManagerParamsArray[1] = TroveManagerParams({
            CCR: CCR_YETH,
            MCR: MCR_YETH,
            SCR: SCR_YETH,
            BCR: BCR_ALL,
            DEBT_LIMIT: YETH_DEBT_LIMIT,
            LIQUIDATION_PENALTY_SP: LIQUIDATION_PENALTY_SP_YETH,
            LIQUIDATION_PENALTY_REDISTRIBUTION: LIQUIDATION_PENALTY_REDISTRIBUTION_YETH
        });

        // tBTC
        troveManagerParamsArray[2] = TroveManagerParams({
            CCR: CCR_TBTC,
            MCR: MCR_TBTC,
            SCR: SCR_TBTC,
            BCR: BCR_ALL,
            DEBT_LIMIT: TBTC_DEBT_LIMIT,
            LIQUIDATION_PENALTY_SP: LIQUIDATION_PENALTY_SP_TBTC,
            LIQUIDATION_PENALTY_REDISTRIBUTION: LIQUIDATION_PENALTY_REDISTRIBUTION_TBTC
        });
        
        // SAGA
        troveManagerParamsArray[3] = TroveManagerParams({
            CCR: CCR_SAGA,
            MCR: MCR_SAGA,
            SCR: SCR_SAGA,
            BCR: BCR_ALL,
            DEBT_LIMIT: SAGA_DEBT_LIMIT,
            LIQUIDATION_PENALTY_SP: LIQUIDATION_PENALTY_SP_SAGA,
            LIQUIDATION_PENALTY_REDISTRIBUTION: LIQUIDATION_PENALTY_REDISTRIBUTION_SAGA
        });

        // stATOM
        troveManagerParamsArray[4] = TroveManagerParams({
            CCR: CCR_STATOM,
            MCR: MCR_STATOM,
            SCR: SCR_STATOM,
            BCR: BCR_ALL,
            DEBT_LIMIT: STATOM_DEBT_LIMIT,
            LIQUIDATION_PENALTY_SP: LIQUIDATION_PENALTY_SP_STATOM,
            LIQUIDATION_PENALTY_REDISTRIBUTION: LIQUIDATION_PENALTY_REDISTRIBUTION_STATOM
        });
        

        // KING
        troveManagerParamsArray[5] = TroveManagerParams({
            CCR: CCR_KING,
            MCR: MCR_KING,
            SCR: SCR_KING,
            BCR: BCR_ALL,
            DEBT_LIMIT: KING_DEBT_LIMIT,
            LIQUIDATION_PENALTY_SP: LIQUIDATION_PENALTY_SP_KING,
            LIQUIDATION_PENALTY_REDISTRIBUTION: LIQUIDATION_PENALTY_REDISTRIBUTION_KING
        });

        // yUSD
        troveManagerParamsArray[6] = TroveManagerParams({
            CCR: CCR_YUSD,
            MCR: MCR_YUSD,
            SCR: SCR_YUSD,
            BCR: BCR_ALL,
            DEBT_LIMIT: YUSD_DEBT_LIMIT,
            LIQUIDATION_PENALTY_SP: LIQUIDATION_PENALTY_SP_YUSD,
            LIQUIDATION_PENALTY_REDISTRIBUTION: LIQUIDATION_PENALTY_REDISTRIBUTION_YUSD
        });

        string[] memory collNames = new string[](NUM_BRANCHES - 1);
        string[] memory collSymbols = new string[](NUM_BRANCHES - 1);
        // collNames[0] = "Wrapped Ether";
        // collSymbols[0] = "WETH";
        collNames[0] = "YieldFi ETH";
        collSymbols[0] = "yETH";
        collNames[1] = "Threshold BTC";
        collSymbols[1] = "tBTC";
        collNames[2] = "Saga";
        collSymbols[2] = "SAGA";
        collNames[3] = "Stride Staked ATOM";
        collSymbols[3] = "stATOM";
        collNames[4] = "King";
        collSymbols[4] = "KING";
        collNames[5] = "YieldFi USD";
        collSymbols[5] = "yUSD";


        DeploymentResult memory deployed =
            // _deployAndConnectContracts(troveManagerParamsArray, collNames, collSymbols, deployGovernanceParams);
            _deployAndConnectContracts(troveManagerParamsArray, collNames, collSymbols, boldAddress, GOVERNANCE_ADDRESS);

        // ICurveStableswapNGPool lusdCurvePool;
        // if (block.chainid == 1) {
        //     lusdCurvePool = _deployCurvePool(deployed.boldToken, IERC20Metadata(LUSD_ADDRESS));
        // }

        // Governance
        // (address governanceAddress, string memory governanceManifest) = deployGovernance(
        //     deployGovernanceParams,
        //     address(curveStableswapFactory),
        //     address(deployed.usdcCurvePool),
        //     address(lusdCurvePool)
        // );
        // address computedGovernanceAddress = computeGovernanceAddress(deployGovernanceParams);
        // assert(governanceAddress == computedGovernanceAddress);
        string memory governanceManifest = GOVERNANCE_MANIFEST;

        vm.stopBroadcast();

        vm.writeFile("deployment-manifest.json", _getManifestJson(deployed, governanceManifest));

        if (vm.envOr("OPEN_DEMO_TROVES", false)) {
            // Anvil default accounts
            // TODO: get accounts from env
            uint256[] memory demoAccounts = new uint256[](8);
            demoAccounts[0] = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
            demoAccounts[1] = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;
            demoAccounts[2] = 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a;
            demoAccounts[3] = 0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6;
            demoAccounts[4] = 0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a;
            demoAccounts[5] = 0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba;
            demoAccounts[6] = 0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e;
            demoAccounts[7] = 0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356;

            DemoTroveParams[] memory demoTroves = new DemoTroveParams[](24);

            demoTroves[0] = DemoTroveParams(0, demoAccounts[0], 0, 35 ether, 2_800 ether, 5.0e16);
            demoTroves[1] = DemoTroveParams(0, demoAccounts[1], 0, 47 ether, 2_400 ether, 4.7e16);
            demoTroves[2] = DemoTroveParams(0, demoAccounts[2], 0, 40 ether, 4_000 ether, 3.3e16);
            demoTroves[3] = DemoTroveParams(0, demoAccounts[3], 0, 75 ether, 6_000 ether, 4.3e16);
            demoTroves[4] = DemoTroveParams(0, demoAccounts[4], 0, 29 ether, 2_280 ether, 5.0e16);
            demoTroves[5] = DemoTroveParams(0, demoAccounts[5], 0, 58.37 ether, 4_400 ether, 4.7e16);
            demoTroves[6] = DemoTroveParams(0, demoAccounts[6], 0, 43.92 ether, 5_500 ether, 3.8e16);
            demoTroves[7] = DemoTroveParams(0, demoAccounts[7], 0, 57.2 ether, 6_000 ether, 4.3e16);

            demoTroves[8] = DemoTroveParams(1, demoAccounts[0], 0, 31 ether, 2_000 ether, 3.3e16);
            demoTroves[9] = DemoTroveParams(1, demoAccounts[1], 0, 26 ether, 2_000 ether, 4.1e16);
            demoTroves[10] = DemoTroveParams(1, demoAccounts[2], 0, 28 ether, 2_300 ether, 3.8e16);
            demoTroves[11] = DemoTroveParams(1, demoAccounts[3], 0, 32 ether, 2_200 ether, 4.3e16);
            demoTroves[12] = DemoTroveParams(1, demoAccounts[4], 0, 95 ether, 12_000 ether, 7.0e16);
            demoTroves[13] = DemoTroveParams(1, demoAccounts[5], 0, 97 ether, 4_000 ether, 4.4e16);
            demoTroves[14] = DemoTroveParams(1, demoAccounts[6], 0, 81 ether, 11_000 ether, 3.3e16);
            demoTroves[15] = DemoTroveParams(1, demoAccounts[7], 0, 94 ether, 12_800 ether, 4.4e16);

            demoTroves[16] = DemoTroveParams(2, demoAccounts[0], 0, 45 ether, 3_000 ether, 2.4e16);
            demoTroves[17] = DemoTroveParams(2, demoAccounts[1], 0, 35 ether, 2_100 ether, 5.0e16);
            demoTroves[18] = DemoTroveParams(2, demoAccounts[2], 0, 67 ether, 2_200 ether, 4.5e16);
            demoTroves[19] = DemoTroveParams(2, demoAccounts[3], 0, 32 ether, 4_900 ether, 3.2e16);
            demoTroves[20] = DemoTroveParams(2, demoAccounts[4], 0, 82 ether, 4_500 ether, 6.9e16);
            demoTroves[21] = DemoTroveParams(2, demoAccounts[5], 0, 74 ether, 7_300 ether, 4.1e16);
            demoTroves[22] = DemoTroveParams(2, demoAccounts[6], 0, 54 ether, 6_900 ether, 2.9e16);
            demoTroves[23] = DemoTroveParams(2, demoAccounts[7], 0, 65 ether, 8_100 ether, 1.5e16);

            for (uint256 i = 0; i < deployed.contractsArray.length; i++) {
                tapFaucet(demoAccounts, deployed.contractsArray[i]);
            }

            openDemoTroves(demoTroves, deployed.contractsArray);
        }
    }

    function tapFaucet(uint256[] memory accounts, LiquityContracts memory contracts) internal {
        for (uint256 i = 0; i < accounts.length; i++) {
            ERC20Faucet token = ERC20Faucet(address(contracts.collToken));

            vm.startBroadcast(accounts[i]);
            token.tap();
            vm.stopBroadcast();

            console2.log(
                "%s.tap() => %s (balance: %s)",
                token.symbol(),
                vm.addr(accounts[i]),
                string.concat(formatAmount(token.balanceOf(vm.addr(accounts[i])), 18, 2), " ", token.symbol())
            );
        }
    }

    function openDemoTroves(DemoTroveParams[] memory demoTroves, LiquityContracts[] memory contractsArray) internal {
        for (uint256 i = 0; i < demoTroves.length; i++) {
            console2.log(
                "openTrove({ coll: %18e, borrow: %18e, rate: %18e%% })",
                demoTroves[i].coll,
                demoTroves[i].debt,
                demoTroves[i].annualInterestRate * 100
            );

            DemoTroveParams memory trove = demoTroves[i];
            LiquityContracts memory contracts = contractsArray[trove.collIndex];

            vm.startBroadcast(trove.owner);

            IERC20 collToken = IERC20(contracts.collToken);
            IERC20 wethToken = IERC20(contracts.addressesRegistry.WETH());

            // Approve collToken to BorrowerOperations
            if (collToken == wethToken) {
                wethToken.approve(address(contracts.borrowerOperations), trove.coll + ETH_GAS_COMPENSATION);
            } else {
                wethToken.approve(address(contracts.borrowerOperations), ETH_GAS_COMPENSATION);
                collToken.approve(address(contracts.borrowerOperations), trove.coll);
            }

            IBorrowerOperations(contracts.borrowerOperations).openTrove(
                vm.addr(trove.owner), //     _owner
                trove.ownerIndex, //         _ownerIndex
                trove.coll, //               _collAmount
                trove.debt, //               _boldAmount
                0, //                        _upperHint
                0, //                        _lowerHint
                trove.annualInterestRate, // _annualInterestRate
                type(uint256).max, //        _maxUpfrontFee
                address(0), //               _addManager
                address(0), //               _removeManager
                address(0) //                _receiver
            );

            vm.stopBroadcast();
        }
    }

    // See: https://solidity-by-example.org/app/create2/
    function getBytecode(bytes memory _creationCode, address _addressesRegistry) public pure returns (bytes memory) {
        return abi.encodePacked(_creationCode, abi.encode(_addressesRegistry));
    }

    function getBytecode(bytes memory _creationCode, address _addressesRegistry, uint256 _branchId) public pure returns (bytes memory) {
        return abi.encodePacked(_creationCode, abi.encode(_addressesRegistry, _branchId));
    }

    function getBytecode(bytes memory _creationCode, address _addressesRegistry, address _governor) public pure returns (bytes memory) {
        return abi.encodePacked(_creationCode, abi.encode(_addressesRegistry, _governor));
    }
    
    function _deployAndConnectContracts(
        TroveManagerParams[] memory troveManagerParamsArray,
        string[] memory _collNames,
        string[] memory _collSymbols,
        // DeployGovernanceParams memory _deployGovernanceParams
        address _boldToken,
        address _governanceAddress
    ) internal returns (DeploymentResult memory r) {
        assert(_collNames.length == troveManagerParamsArray.length - 1);
        assert(_collSymbols.length == troveManagerParamsArray.length - 1);

        DeploymentVars memory vars;
        vars.numCollaterals = troveManagerParamsArray.length;
        r.boldToken = BoldToken(_boldToken);

        // USDC and USDC-BOLD pool
        // r.usdcCurvePool = _deployCurvePool(r.boldToken, USDC);

        r.contractsArray = new LiquityContracts[](vars.numCollaterals);
        vars.collaterals = new IERC20Metadata[](vars.numCollaterals);
        vars.addressesRegistries = new IAddressesRegistry[](vars.numCollaterals);
        vars.troveManagers = new ITroveManager[](vars.numCollaterals);

        // Collaterals
        if (block.chainid == CHAIN_ID && !useTestnetPriceFeeds) {
            // mainnet
            // ETH
            vars.collaterals[0] = IERC20Metadata(WETH);

            // yETH
            vars.collaterals[1] = IERC20Metadata(YETH_ADDRESS);

            // tBTC
            vars.collaterals[2] = IERC20Metadata(TBTC_ADDRESS);
            // SAGA
            WRAPPED_SAGA = new WrappedToken(IERC20Metadata(SAGA_ADDRESS));
            vars.collaterals[3] = WRAPPED_SAGA;

            // stATOM
            WRAPPED_STATOM = new WrappedToken(IERC20Metadata(STATOM_ADDRESS));
            vars.collaterals[4] = WRAPPED_STATOM;

            // KING
            vars.collaterals[5] = IERC20Metadata(KING_ADDRESS);

            // yUSD
            vars.collaterals[6] = IERC20Metadata(YUSD_ADDRESS);

        } else {
            // Sepolia
            // Use WETH as collateral for the first branch
            vars.collaterals[0] = WETH;

            // Deploy plain ERC20Faucets for the rest of the branches
            for (vars.i = 1; vars.i < vars.numCollaterals; vars.i++) {
                vars.collaterals[vars.i] = new ERC20Faucet(
                    _collNames[vars.i - 1], //   _name
                    _collSymbols[vars.i - 1], // _symbol
                    100 ether, //     _tapAmount
                    1 days //         _tapPeriod
                );
            }
        }

        // Deploy AddressesRegistries and get TroveManager addresses
        for (vars.i = 0; vars.i < vars.numCollaterals; vars.i++) {
            (IAddressesRegistry addressesRegistry, address troveManagerAddress) =
                _deployAddressesRegistry(troveManagerParamsArray[vars.i], vars.i);
            vars.addressesRegistries[vars.i] = addressesRegistry;
            vars.troveManagers[vars.i] = ITroveManager(troveManagerAddress);
        }
        //loog collaterals and print the symbol for each
        for(uint i = 0; i < vars.collaterals.length; i++) {
            console2.log("DeployLiquity2Script: vars.collaterals[%s].symbol(): %s", i, vars.collaterals[i].symbol());
        }
        r.collateralRegistry = new CollateralRegistry(r.boldToken, vars.collaterals, vars.troveManagers, GOVERNANCE_ADDRESS); // TODO: Replace null address with governor address
        r.hintHelpers = new HintHelpers(r.collateralRegistry);
        r.multiTroveGetter = new MultiTroveGetter(r.collateralRegistry);

        // Deploy per-branch contracts for each branch
        for (vars.i = 0; vars.i < vars.numCollaterals; vars.i++) {
            vars.contracts = _deployAndConnectCollateralContracts(
                vars.collaterals[vars.i],
                r.boldToken,
                r.collateralRegistry,
                // r.usdcCurvePool,
                ICurveStableswapNGPool(address(0)),
                vars.addressesRegistries[vars.i],
                address(vars.troveManagers[vars.i]),
                r.hintHelpers,
                r.multiTroveGetter,
                _governanceAddress,
                vars.i
            );
            r.contractsArray[vars.i] = vars.contracts;
        }

        //also calls renounceOwnership
        r.boldToken.setCollateralRegistry(address(r.collateralRegistry));

        // exchange helpers
        // r.exchangeHelpers = new HybridCurveUniV3ExchangeHelpers(
        //     USDC,
        //     WETH,
        //     r.usdcCurvePool,
        //     OTHER_TOKEN_INDEX, // USDC Curve pool index
        //     BOLD_TOKEN_INDEX, // BOLD Curve pool index
        //     UNIV3_FEE_USDC_WETH,
        //     UNIV3_FEE_WETH_COLL,
        //     uniV3Quoter
        // );
        r.exchangeHelpers = IExchangeHelpers(address(0));
    }

    function _deployAddressesRegistry(TroveManagerParams memory _troveManagerParams, uint256 _branchId)
        internal
        returns (IAddressesRegistry, address)
    {
        vm.sleep(3000);
        IAddressesRegistry addressesRegistry = new AddressesRegistry(
            deployer,
            _troveManagerParams.CCR,
            _troveManagerParams.MCR,
            _troveManagerParams.BCR,
            _troveManagerParams.SCR,
            _troveManagerParams.DEBT_LIMIT,
            _troveManagerParams.LIQUIDATION_PENALTY_SP,
            _troveManagerParams.LIQUIDATION_PENALTY_REDISTRIBUTION
        );
        address troveManagerAddress = vm.computeCreate2Address(
            SALT, keccak256(getBytecode(type(TroveManager).creationCode, address(addressesRegistry), _branchId))
        );

        return (addressesRegistry, troveManagerAddress);
    }

    function _deployAndConnectCollateralContracts(
        IERC20Metadata _collToken,
        IBoldToken _boldToken,
        ICollateralRegistry _collateralRegistry,
        ICurveStableswapNGPool _usdcCurvePool,
        IAddressesRegistry _addressesRegistry,
        address _troveManagerAddress,
        IHintHelpers _hintHelpers,
        IMultiTroveGetter _multiTroveGetter,
        address _governance,
        uint256 _branchId
    ) internal returns (LiquityContracts memory contracts) {
        LiquityContractAddresses memory addresses;
        contracts.collToken = _collToken;

        // Deploy all contracts, using testers for TM and PriceFeed
        contracts.addressesRegistry = _addressesRegistry;

        // Deploy Metadata
        contracts.metadataNFT = deployMetadata(SALT);
        addresses.metadataNFT = vm.computeCreate2Address(
            SALT, keccak256(getBytecode(type(MetadataNFT).creationCode, address(initializedFixedAssetReader)))
        );
        assert(address(contracts.metadataNFT) == addresses.metadataNFT);

        contracts.interestRouter = IInterestRouter(_governance);
        addresses.borrowerOperations = vm.computeCreate2Address(
            SALT, keccak256(getBytecode(type(BorrowerOperations).creationCode, address(contracts.addressesRegistry)))
        );
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

        contracts.priceFeed = _deployPriceFeed(address(_collToken), addresses.borrowerOperations);

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

        contracts.borrowerOperations = new BorrowerOperations{salt: SALT}(contracts.addressesRegistry);
        contracts.troveManager = new TroveManager{salt: SALT}(contracts.addressesRegistry, _branchId);
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

        // Update gas compensation max reward
        // note:
        // Only the governor can update gas compensation max reward
        // So instead of calling during deployment, we could call it post-deployment as governor.
        // OR, deploy as governor and call it during deployment.

        // _updateGasCompensationMaxReward(contracts.troveManager);

        // deploy zappers
        (contracts.gasCompZapper, contracts.wethZapper, contracts.leverageZapper, contracts.wrappedTokenZapper) =
            _deployZappers(contracts.addressesRegistry, contracts.collToken, _boldToken, _usdcCurvePool);
    }

    function _deployPriceFeed(address _collTokenAddress, address _borroweOperationsAddress)
        internal
        returns (IPriceFeed)
    {
        vm.sleep(3000);
        if (block.chainid == CHAIN_ID && !useTestnetPriceFeeds) { //saga chain
            if (_collTokenAddress == address(WETH)) {
                return new WETHPriceFeed(ETH_ORACLE_ADDRESS, ETH_USD_STALENESS_THRESHOLD, _borroweOperationsAddress);
            } else if (_collTokenAddress == YETH_ADDRESS) {
                // yETH
                yETHPriceFeed feed = new yETHPriceFeed(
                    deployer,
                    YETH_ORACLE_ADDRESS,
                    YETH_USD_STALENESS_THRESHOLD
                );
                feed.setAddresses(_borroweOperationsAddress); //This also renounces the ownership of the feed.
                return feed;
            } else if (_collTokenAddress == TBTC_ADDRESS) {
                // tBTC
                TBTCPriceFeed feed = new TBTCPriceFeed(
                    deployer,
                    TBTC_ORACLE_ADDRESS,
                    TBTC_ETH_STALENESS_THRESHOLD,
                    BTC_ORACLE_ADDRESS,
                    BTC_USD_STALENESS_THRESHOLD
                );
                feed.setAddresses(_borroweOperationsAddress);
                return feed;
            } else if (_collTokenAddress == address(WRAPPED_SAGA)) {
                // SAGA
                SAGAPriceFeed feed = new SAGAPriceFeed(
                    deployer,
                    SAGA_ORACLE_ADDRESS,
                    SAGA_USD_STALENESS_THRESHOLD
                );
                feed.setAddresses(_borroweOperationsAddress);
                return feed;
            } else if (_collTokenAddress == address(WRAPPED_STATOM)) {
                // stATOM
                stATOMPriceFeed feed = new stATOMPriceFeed(
                    deployer,
                    STATOM_ORACLE_ADDRESS,
                    STATOM_USD_STALENESS_THRESHOLD
                );
                feed.setAddresses(_borroweOperationsAddress);
                return feed;
            } else if (_collTokenAddress == KING_ADDRESS) {
                // KING
                KINGPriceFeed feed = new KINGPriceFeed(
                    deployer,
                    KING_ORACLE_ADDRESS,
                    KING_USD_STALENESS_THRESHOLD
                );
                feed.setAddresses(_borroweOperationsAddress);
                return feed;
            } else if (_collTokenAddress == YUSD_ADDRESS) {
                // yUSD
                yUSDPriceFeed feed = new yUSDPriceFeed(
                    deployer,
                    YUSD_ORACLE_ADDRESS,
                    YUSD_USD_STALENESS_THRESHOLD
                );
                feed.setAddresses(_borroweOperationsAddress);
                return feed;
            } else {
                revert("Invalid collateral token");
            }
        }

        // Sepolia
        return new PriceFeedTestnet();
    }

    function _deployZappers(
        IAddressesRegistry _addressesRegistry,
        IERC20 _collToken,
        // IBoldToken _boldToken,
        IBoldToken,
        // ICurveStableswapNGPool _usdcCurvePool
        ICurveStableswapNGPool
    ) internal returns (GasCompZapper gasCompZapper, WETHZapper wethZapper, ILeverageZapper leverageZapper, WrappedTokenZapper wrappedTokenZapper) {
        // IFlashLoanProvider flashLoanProvider = new BalancerFlashLoan();

        // IExchange hybridExchange = new HybridCurveUniV3Exchange(
        //     _collToken,
        //     _boldToken,
        //     USDC,
        //     WETH,
        //     _usdcCurvePool,
        //     OTHER_TOKEN_INDEX, // USDC Curve pool index
        //     BOLD_TOKEN_INDEX, // BOLD Curve pool index
        //     UNIV3_FEE_USDC_WETH,
        //     UNIV3_FEE_WETH_COLL,
        //     uniV3Router
        // );
        IFlashLoanProvider flashLoanProvider = IFlashLoanProvider(address(0));
        IExchange hybridExchange = IExchange(address(0));

        // bool lst = _collToken != WETH;
        if (_collToken == WRAPPED_SAGA) {
            wrappedTokenZapper = new WrappedTokenZapper(IWrappedToken(address(_collToken)), _addressesRegistry, flashLoanProvider, hybridExchange);
        } else if (_collToken == WRAPPED_STATOM) {
            wrappedTokenZapper = new WrappedTokenZapper(IWrappedToken(address(_collToken)), _addressesRegistry, flashLoanProvider, hybridExchange);
        // } else if (_collToken == WETH) { //not using weth zapper because ETH is not the native token.
        //     wethZapper = new WETHZapper(_addressesRegistry, flashLoanProvider, hybridExchange);
        } else {
            gasCompZapper = new GasCompZapper(_addressesRegistry, flashLoanProvider, hybridExchange); //weth gets the normal gas comp zapper
        }
        // if (lst) {
        //     gasCompZapper = new GasCompZapper(_addressesRegistry, flashLoanProvider, hybridExchange);
        // } else {
        //     wethZapper = new WETHZapper(_addressesRegistry, flashLoanProvider, hybridExchange);
        // }
        // leverageZapper = _deployHybridLeverageZapper(_addressesRegistry, flashLoanProvider, hybridExchange, lst);
        leverageZapper = ILeverageZapper(address(0)); // Not using leverage zapper at the moment
    }

    function _deployHybridLeverageZapper(
        IAddressesRegistry _addressesRegistry,
        IFlashLoanProvider _flashLoanProvider,
        IExchange _hybridExchange,
        bool _lst
    ) internal returns (ILeverageZapper) {
        ILeverageZapper leverageZapperHybrid;
        if (_lst) {
            //leverageZapperHybrid = new LeverageLSTZapper(_addressesRegistry, _flashLoanProvider, _hybridExchange);
        } else {
            //leverageZapperHybrid = new LeverageWETHZapper(_addressesRegistry, _flashLoanProvider, _hybridExchange);
        }

        return leverageZapperHybrid;
    }

    function _mintBold(uint256 _boldAmount, uint256 _price, LiquityContracts memory _contracts) internal {
        uint256 collAmount = _boldAmount * 2 ether / _price; // CR of ~200%

        ERC20Faucet(address(_contracts.collToken)).mint(deployer, collAmount);
        WETHTester(payable(address(WETH))).mint(deployer, ETH_GAS_COMPENSATION);

        if (_contracts.collToken == WETH) {
            WETH.approve(address(_contracts.borrowerOperations), collAmount + ETH_GAS_COMPENSATION);
        } else {
            _contracts.collToken.approve(address(_contracts.borrowerOperations), collAmount);
            WETH.approve(address(_contracts.borrowerOperations), ETH_GAS_COMPENSATION);
        }

        _contracts.borrowerOperations.openTrove({
            _owner: deployer,
            _ownerIndex: lastTroveIndex++,
            _ETHAmount: collAmount,
            _boldAmount: _boldAmount,
            _upperHint: 0,
            _lowerHint: 0,
            _annualInterestRate: 0.05 ether,
            _maxUpfrontFee: type(uint256).max,
            _addManager: address(0),
            _removeManager: address(0),
            _receiver: address(0)
        });
    }

    function _priceToSqrtPrice(uint256 _price) public pure returns (uint160) {
        return uint160(Math.sqrt((_price << 192) / DECIMAL_PRECISION));
    }

    function formatAmount(uint256 amount, uint256 decimals, uint256 digits) internal pure returns (string memory) {
        if (digits > decimals) {
            digits = decimals;
        }

        uint256 scaled = amount / (10 ** (decimals - digits));
        string memory whole = Strings.toString(scaled / (10 ** digits));

        if (digits == 0) {
            return whole;
        }

        string memory fractional = Strings.toString(scaled % (10 ** digits));
        for (uint256 i = bytes(fractional).length; i < digits; i++) {
            fractional = string.concat("0", fractional);
        }
        return string.concat(whole, ".", fractional);
    }

    function _getBranchContractsJson(LiquityContracts memory c) internal view returns (string memory) {
        return string.concat(
            "{",
            string.concat(
                // Avoid stack too deep by chunking concats
                string.concat(
                    string.concat('"collSymbol":"', c.collToken.symbol(), '",'), // purely for human-readability
                    string.concat('"collToken":"', address(c.collToken).toHexString(), '",'),
                    string.concat('"addressesRegistry":"', address(c.addressesRegistry).toHexString(), '",'),
                    string.concat('"activePool":"', address(c.activePool).toHexString(), '",'),
                    string.concat('"borrowerOperations":"', address(c.borrowerOperations).toHexString(), '",'),
                    string.concat('"collSurplusPool":"', address(c.collSurplusPool).toHexString(), '",'),
                    string.concat('"defaultPool":"', address(c.defaultPool).toHexString(), '",'),
                    string.concat('"sortedTroves":"', address(c.sortedTroves).toHexString(), '",')
                ),
                string.concat(
                    string.concat('"stabilityPool":"', address(c.stabilityPool).toHexString(), '",'),
                    string.concat('"troveManager":"', address(c.troveManager).toHexString(), '",'),
                    string.concat('"troveNFT":"', address(c.troveNFT).toHexString(), '",'),
                    string.concat('"metadataNFT":"', address(c.metadataNFT).toHexString(), '",'),
                    string.concat('"priceFeed":"', address(c.priceFeed).toHexString(), '",'),
                    string.concat('"gasPool":"', address(c.gasPool).toHexString(), '",'),
                    string.concat('"interestRouter":"', address(c.interestRouter).toHexString(), '",'),
                    string.concat('"wethZapper":"', address(c.wethZapper).toHexString(), '",')
                ),
                string.concat(
                    string.concat('"gasCompZapper":"', address(c.gasCompZapper).toHexString(), '",'),
                    string.concat('"leverageZapper":"', address(c.leverageZapper).toHexString(), '"') // no comma
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
        view
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
                string.concat('"governance":', _governanceManifest, "") // no comma
            ),
            "}"
        );
    }

    // function _updateGasCompensationMaxReward(ITroveManager _troveManager) internal {
    //     IERC20Metadata _collToken = _troveManager.addressesRegistry().collToken();
    //     if (address(_collToken) == WETH_ADDRESS) {
    //         _troveManager.updateGasCompensationMaxReward(COLL_GAS_COMPENSATION_CAP_WETH);
    //     // } else if (address(_collToken) == RETH_ADDRESS) {
    //     //     _troveManager.updateGasCompensationMaxReward(COLL_GAS_COMPENSATION_CAP_RETH);
    //     } else if (address(_collToken) == TBTC_ADDRESS) {
    //         _troveManager.updateGasCompensationMaxReward(COLL_GAS_COMPENSATION_CAP_TBTC);
    //     } else if (address(_collToken) == address(WRAPPED_SAGA)) {
    //         _troveManager.updateGasCompensationMaxReward(COLL_GAS_COMPENSATION_CAP_SAGA);
    //     } else if (address(_collToken) == STATOM_ADDRESS) {
    //         _troveManager.updateGasCompensationMaxReward(COLL_GAS_COMPENSATION_CAP_STATOM);
    //     } else {
    //         revert("Invalid collateral token");
    //     }
    // }
}
