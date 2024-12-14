// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import {StdCheats} from "forge-std/StdCheats.sol";
import {IERC20Metadata} from "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {Strings} from "openzeppelin-contracts/contracts/utils/Strings.sol";
import {IERC20 as IERC20_GOV} from "openzeppelin/contracts/token/ERC20/IERC20.sol";

import {StringFormatting} from "../test/Utils/StringFormatting.sol";
import {Accounts} from "../test/TestContracts/Accounts.sol";
import {ERC20Faucet} from "../test/TestContracts/ERC20Faucet.sol";
import {ETH_GAS_COMPENSATION} from "../Dependencies/Constants.sol";
import {IBorrowerOperations} from "../Interfaces/IBorrowerOperations.sol";
import "../AddressesRegistry.sol";
import "../ActivePool.sol";
import "../BoldToken.sol";
import "../BorrowerOperations.sol";
import "../TroveManager.sol";
import "../TroveNFT.sol";
import "../CollSurplusPool.sol";
import "../DefaultPool.sol";
import "../GasPool.sol";
import "../HintHelpers.sol";
import "../MultiTroveGetter.sol";
import "../SortedTroves.sol";
import "../StabilityPool.sol";
import "../PriceFeeds/WETHPriceFeed.sol";
import "../PriceFeeds/WSTETHPriceFeed.sol";
import "../PriceFeeds/RETHPriceFeed.sol";
import "../CollateralRegistry.sol";
import "../test/TestContracts/PriceFeedTestnet.sol";
import "../test/TestContracts/MetadataDeployment.sol";
import "../Zappers/WETHZapper.sol";
import "../Zappers/GasCompZapper.sol";
import "../Zappers/LeverageLSTZapper.sol";
import "../Zappers/LeverageWETHZapper.sol";
import "../Zappers/Modules/Exchanges/HybridCurveUniV3ExchangeHelpers.sol";
import {BalancerFlashLoan} from "../Zappers/Modules/FlashLoans/BalancerFlashLoan.sol";
import "../Zappers/Modules/Exchanges/Curve/ICurveStableswapNGFactory.sol";
import "../Zappers/Modules/Exchanges/UniswapV3/ISwapRouter.sol";
import "../Zappers/Modules/Exchanges/UniswapV3/IQuoterV2.sol";
import "../Zappers/Modules/Exchanges/UniswapV3/IUniswapV3Pool.sol";
import "../Zappers/Modules/Exchanges/UniswapV3/IUniswapV3Factory.sol";
import "../Zappers/Modules/Exchanges/UniswapV3/INonfungiblePositionManager.sol";
import "../Zappers/Modules/Exchanges/UniswapV3/UniPriceConverter.sol";
import "../Zappers/Modules/Exchanges/HybridCurveUniV3Exchange.sol";
import {WETHTester} from "../test/TestContracts/WETHTester.sol";
import "forge-std/console2.sol";
import {IRateProvider, IWeightedPool, IWeightedPoolFactory} from "./Interfaces/Balancer/IWeightedPool.sol";
import {IVault} from "./Interfaces/Balancer/IVault.sol";
import {MockStakingV1} from "V2-gov/test/mocks/MockStakingV1.sol";

import {DeployGovernance} from "./DeployGovernance.s.sol";

contract DeployLiquity2Script is DeployGovernance, UniPriceConverter, StdCheats, MetadataDeployment {
    using Strings for *;
    using StringFormatting for *;

    address WETH_ADDRESS = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address USDC_ADDRESS = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    // used for gas compensation and as collateral of the first branch
    // tapping disallowed
    IWETH WETH;
    IERC20 USDC;
    address WSTETH_ADDRESS = 0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0;
    address RETH_ADDRESS = 0xae78736Cd615f374D3085123A210448E74Fc6393;
    address ETH_ORACLE_ADDRESS = 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419;
    address RETH_ORACLE_ADDRESS = 0x536218f9E9Eb48863970252233c8F271f554C2d0;
    address STETH_ORACLE_ADDRESS = 0xCfE54B5cD566aB89272946F602D76Ea879CAb4a8;
    uint256 ETH_USD_STALENESS_THRESHOLD = 24 hours;
    uint256 STETH_USD_STALENESS_THRESHOLD = 24 hours;
    uint256 RETH_ETH_STALENESS_THRESHOLD = 48 hours;

    // V1
    address LQTY_ADDRESS = 0x6DEA81C8171D0bA574754EF6F8b412F2Ed88c54D;
    address LQTY_STAKING_ADDRESS = 0x4f9Fbb3f1E99B56e0Fe2892e623Ed36A76Fc605d;

    // Curve
    ICurveStableswapNGFactory curveStableswapFactory;
    // https://docs.curve.fi/deployments/amm/#stableswap-ng
    // Sepolia
    ICurveStableswapNGFactory constant curveStableswapFactorySepolia =
        ICurveStableswapNGFactory(0xfb37b8D939FFa77114005e61CFc2e543d6F49A81);
    // Mainnet
    ICurveStableswapNGFactory constant curveStableswapFactoryMainnet =
        ICurveStableswapNGFactory(0x6A8cbed756804B16E05E741eDaBd5cB544AE21bf);
    uint128 constant BOLD_TOKEN_INDEX = 0;
    uint128 constant USDC_INDEX = 1;

    // Uni V3
    uint24 constant UNIV3_FEE = 0.3e4;
    uint24 constant UNIV3_FEE_USDC_WETH = 500; // 0.05%
    uint24 constant UNIV3_FEE_WETH_COLL = 100; // 0.01%
    ISwapRouter uniV3Router;
    IQuoterV2 uniV3Quoter;
    IUniswapV3Factory uniswapV3Factory;
    INonfungiblePositionManager uniV3PositionManager;
    // https://docs.uniswap.org/contracts/v3/reference/deployments/ethereum-deployments
    // Sepolia
    ISwapRouter constant uniV3RouterSepolia = ISwapRouter(0x65669fE35312947050C450Bd5d36e6361F85eC12);
    IQuoterV2 constant uniV3QuoterSepolia = IQuoterV2(0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3);
    IUniswapV3Factory constant uniswapV3FactorySepolia = IUniswapV3Factory(0x0227628f3F023bb0B980b67D528571c95c6DaC1c);
    INonfungiblePositionManager constant uniV3PositionManagerSepolia =
        INonfungiblePositionManager(0x1238536071E1c677A632429e3655c799b22cDA52);
    // Mainnet
    ISwapRouter constant uniV3RouterMainnet = ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);
    IQuoterV2 constant uniV3QuoterMainnet = IQuoterV2(0x61fFE014bA17989E743c5F6cB21bF9697530B21e);
    IUniswapV3Factory constant uniswapV3FactoryMainnet = IUniswapV3Factory(0x1F98431c8aD98523631AE4a59f267346ea31F984);
    INonfungiblePositionManager constant uniV3PositionManagerMainnet =
        INonfungiblePositionManager(0xC36442b4a4522E871399CD717aBDD847Ab11FE88);

    // Balancer
    IVault constant balancerVault = IVault(0xBA12222222228d8Ba445958a75a0704d566BF2C8);
    IWeightedPoolFactory balancerFactory;
    // Sepolia
    // https://docs.balancer.fi/reference/contracts/deployment-addresses/sepolia.html
    IWeightedPoolFactory constant balancerFactorySepolia =
        IWeightedPoolFactory(0x7920BFa1b2041911b354747CA7A6cDD2dfC50Cfd);
    // Mainnet
    // https://docs.balancer.fi/reference/contracts/deployment-addresses/mainnet.html
    IWeightedPoolFactory constant balancerFactoryMainnet =
        IWeightedPoolFactory(0x897888115Ada5773E02aA29F775430BFB5F34c51);

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
        IERC20 collToken;
        WETHZapper wethZapper;
        GasCompZapper gasCompZapper;
        ILeverageZapper leverageZapper;
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

    struct DeploymentVars {
        uint256 numCollaterals;
        IERC20Metadata[] collaterals;
        IPriceFeed[] priceFeeds;
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
        SALT = keccak256(abi.encodePacked(block.timestamp));

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

        if (vm.envBool("USE_TESTNET_PRICEFEEDS")) {
            useTestnetPriceFeeds = true;
        }

        console2.log(deployer, "deployer");
        console2.log(deployer.balance, "deployer balance");
        console2.log("Use Testnet PriceFeeds: ", useTestnetPriceFeeds);

        if (block.chainid == 1) {
            // mainnet
            WETH = IWETH(WETH_ADDRESS);
            USDC = IERC20(USDC_ADDRESS);
            curveStableswapFactory = curveStableswapFactoryMainnet;
            uniV3Router = uniV3RouterMainnet;
            uniV3Quoter = uniV3QuoterMainnet;
            uniswapV3Factory = uniswapV3FactoryMainnet;
            uniV3PositionManager = uniV3PositionManagerMainnet;
            balancerFactory = balancerFactoryMainnet;
            lqty = LQTY_ADDRESS;
            stakingV1 = LQTY_STAKING_ADDRESS;
        } else {
            // sepolia, local
            if (block.chainid == 31337) {
                // local
                WETH = new WETHTester({_tapAmount: 100 ether, _tapPeriod: 1 days});
            } else {
                // sepolia
                WETH = new WETHTester({_tapAmount: 0, _tapPeriod: type(uint256).max});
            }
            USDC = new ERC20Faucet("USDC", "USDC", 0, type(uint256).max);
            curveStableswapFactory = curveStableswapFactorySepolia;
            uniV3Router = uniV3RouterSepolia;
            uniV3Quoter = uniV3QuoterSepolia;
            uniswapV3Factory = uniswapV3FactorySepolia;
            uniV3PositionManager = uniV3PositionManagerSepolia;
            balancerFactory = balancerFactorySepolia;
            // Needed for Governance (they will be constants for mainnet)
            lqty = address(new ERC20Faucet("Liquity", "LQTY", 100 ether, 1 days));
            ERC20Faucet lusd = new ERC20Faucet("Liquity USD", "LUSD", 100 ether, 1 days);
            stakingV1 = address(new MockStakingV1(IERC20_GOV(lqty), IERC20_GOV(address(lusd))));
        }

        TroveManagerParams[] memory troveManagerParamsArray = new TroveManagerParams[](3);
        // TODO: move params out of here
        troveManagerParamsArray[0] = TroveManagerParams(150e16, 110e16, 110e16, 5e16, 10e16); // WETH
        troveManagerParamsArray[1] = TroveManagerParams(150e16, 120e16, 110e16, 5e16, 10e16); // wstETH
        troveManagerParamsArray[2] = TroveManagerParams(150e16, 120e16, 110e16, 5e16, 10e16); // rETH

        string[] memory collNames = new string[](2);
        string[] memory collSymbols = new string[](2);
        collNames[0] = "Wrapped liquid staked Ether 2.0";
        collSymbols[0] = "wstETH";
        collNames[1] = "Rocket Pool ETH";
        collSymbols[1] = "rETH";

        DeploymentResult memory deployed = _deployAndConnectContracts(troveManagerParamsArray, collNames, collSymbols);

        if (block.chainid == 11155111) {
            // Provide liquidity for zaps if we're on Sepolia
            ERC20Faucet monkeyBalls = new ERC20Faucet("MonkeyBalls", "MB", 0, type(uint256).max);
            for (uint256 i = 0; i < deployed.contractsArray.length; ++i) {
                PriceFeedTestnet(address(deployed.contractsArray[i].priceFeed)).setPrice(2_000 ether);
                _provideFlashloanLiquidity(ERC20Faucet(address(deployed.contractsArray[i].collToken)), monkeyBalls);
                if (i == 0) {
                    // WETH, we do USDC-WETH
                    (uint256 price,) = deployed.contractsArray[0].priceFeed.fetchPrice();
                    uint256 token1Amount = 1_000_000 ether;
                    _provideUniV3Liquidity(
                        ERC20Faucet(address(USDC)), ERC20Faucet(address(WETH)), token1Amount, price, UNIV3_FEE_USDC_WETH
                    );
                } else {
                    // LSTs, we do WETH-LST
                    uint256 token1Amount = 1_000 ether;
                    _provideUniV3Liquidity(
                        ERC20Faucet(address(WETH)),
                        ERC20Faucet(address(deployed.contractsArray[i].collToken)),
                        token1Amount,
                        1 ether,
                        UNIV3_FEE_WETH_COLL
                    );
                }
            }

            _provideCurveLiquidity(deployed.boldToken, deployed.contractsArray[0]);

            // deployed.contractsArray[1].collToken.mint(deployer, 1 ether);
            // deployed.contractsArray[1].collToken.approve(address(deployed.contractsArray[1].leverageZapper), 1 ether);
            // deployed.contractsArray[1].leverageZapper.openLeveragedTroveWithRawETH{value: ETH_GAS_COMPENSATION}(
            //     ILeverageZapper.OpenLeveragedTroveParams({
            //         owner: deployer,
            //         ownerIndex: 1,
            //         collAmount: 1 ether,
            //         flashLoanAmount: 1 ether,
            //         boldAmount: 2_000 ether,
            //         upperHint: 0,
            //         lowerHint: 0,
            //         annualInterestRate: MIN_ANNUAL_INTEREST_RATE,
            //         batchManager: address(0),
            //         maxUpfrontFee: type(uint256).max,
            //         addManager: address(0),
            //         removeManager: address(0),
            //         receiver: address(0)
            //     })
            // );
        }

        // Governance
        (address governanceAddress, string memory governanceManifest) = deployGovernance(
            deployer, SALT, deployed.boldToken, USDC, address(curveStableswapFactory), address(deployed.usdcCurvePool)
        );
        address computedGovernanceAddress =
            computeGovernanceAddress(deployer, SALT, deployed.boldToken, new address[](0));
        //console2.log(computedGovernanceAddress, "computedGovernanceAddress");
        //console2.log(governanceAddress, "governanceAddress");
        assert(governanceAddress == computedGovernanceAddress);

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

            DemoTroveParams[] memory demoTroves = new DemoTroveParams[](16);

            demoTroves[0] = DemoTroveParams(0, demoAccounts[0], 0, 25e18, 2800e18, 5.0e16);
            demoTroves[1] = DemoTroveParams(0, demoAccounts[1], 0, 37e18, 2400e18, 4.7e16);
            demoTroves[2] = DemoTroveParams(0, demoAccounts[2], 0, 30e18, 4000e18, 3.3e16);
            demoTroves[3] = DemoTroveParams(0, demoAccounts[3], 0, 65e18, 6000e18, 4.3e16);

            demoTroves[4] = DemoTroveParams(0, demoAccounts[4], 0, 19e18, 2280e18, 5.0e16);
            demoTroves[5] = DemoTroveParams(0, demoAccounts[5], 0, 48.37e18, 4400e18, 4.7e16);
            demoTroves[6] = DemoTroveParams(0, demoAccounts[6], 0, 33.92e18, 5500e18, 3.8e16);
            demoTroves[7] = DemoTroveParams(0, demoAccounts[7], 0, 47.2e18, 6000e18, 4.3e16);

            demoTroves[8] = DemoTroveParams(1, demoAccounts[0], 1, 21e18, 2000e18, 3.3e16);
            demoTroves[9] = DemoTroveParams(1, demoAccounts[1], 1, 16e18, 2000e18, 4.1e16);
            demoTroves[10] = DemoTroveParams(1, demoAccounts[2], 1, 18e18, 2300e18, 3.8e16);
            demoTroves[11] = DemoTroveParams(1, demoAccounts[3], 1, 22e18, 2200e18, 4.3e16);

            demoTroves[12] = DemoTroveParams(1, demoAccounts[4], 1, 85e18, 12000e18, 7.0e16);
            demoTroves[13] = DemoTroveParams(1, demoAccounts[5], 1, 87e18, 4000e18, 4.4e16);
            demoTroves[14] = DemoTroveParams(1, demoAccounts[6], 1, 71e18, 11000e18, 3.3e16);
            demoTroves[15] = DemoTroveParams(1, demoAccounts[7], 1, 84e18, 12800e18, 4.4e16);

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

    function _deployAndConnectContracts(
        TroveManagerParams[] memory troveManagerParamsArray,
        string[] memory _collNames,
        string[] memory _collSymbols
    ) internal returns (DeploymentResult memory r) {
        assert(_collNames.length == troveManagerParamsArray.length - 1);
        assert(_collSymbols.length == troveManagerParamsArray.length - 1);

        DeploymentVars memory vars;
        vars.numCollaterals = troveManagerParamsArray.length;
        // Deploy Bold
        vars.bytecode = abi.encodePacked(type(BoldToken).creationCode, abi.encode(deployer));
        vars.boldTokenAddress = vm.computeCreate2Address(SALT, keccak256(vars.bytecode));
        r.boldToken = new BoldToken{salt: SALT}(deployer);
        assert(address(r.boldToken) == vars.boldTokenAddress);

        // USDC and USDC-BOLD pool
        r.usdcCurvePool = _deployCurveBoldUsdcPool(r.boldToken);

        r.contractsArray = new LiquityContracts[](vars.numCollaterals);
        vars.collaterals = new IERC20Metadata[](vars.numCollaterals);
        vars.priceFeeds = new IPriceFeed[](vars.numCollaterals);
        vars.addressesRegistries = new IAddressesRegistry[](vars.numCollaterals);
        vars.troveManagers = new ITroveManager[](vars.numCollaterals);

        if (block.chainid == 1 && !useTestnetPriceFeeds) {
            // mainnet
            // ETH
            vars.collaterals[0] = IERC20Metadata(WETH);
            vars.priceFeeds[0] = new WETHPriceFeed(deployer, ETH_ORACLE_ADDRESS, ETH_USD_STALENESS_THRESHOLD);

            // wstETH
            vars.collaterals[1] = IERC20Metadata(WSTETH_ADDRESS);
            vars.priceFeeds[1] = new WSTETHPriceFeed(
                deployer,
                ETH_ORACLE_ADDRESS,
                STETH_ORACLE_ADDRESS,
                WSTETH_ADDRESS,
                ETH_USD_STALENESS_THRESHOLD,
                STETH_USD_STALENESS_THRESHOLD
            );

            // RETH
            vars.collaterals[2] = IERC20Metadata(RETH_ADDRESS);
            vars.priceFeeds[2] = new RETHPriceFeed(
                deployer,
                ETH_ORACLE_ADDRESS,
                RETH_ORACLE_ADDRESS,
                RETH_ADDRESS,
                ETH_USD_STALENESS_THRESHOLD,
                RETH_ETH_STALENESS_THRESHOLD
            );
        } else {
            // Sepolia
            // Use WETH as collateral for the first branch
            vars.collaterals[0] = WETH;
            vars.priceFeeds[0] = new PriceFeedTestnet();

            // Deploy plain ERC20Faucets for the rest of the branches
            for (vars.i = 1; vars.i < vars.numCollaterals; vars.i++) {
                vars.collaterals[vars.i] = new ERC20Faucet(
                    _collNames[vars.i - 1], //   _name
                    _collSymbols[vars.i - 1], // _symbol
                    100 ether, //     _tapAmount
                    1 days //         _tapPeriod
                );
                vars.priceFeeds[vars.i] = new PriceFeedTestnet();
            }
        }

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

        // Deploy per-branch contracts for each branch
        for (vars.i = 0; vars.i < vars.numCollaterals; vars.i++) {
            vars.contracts = _deployAndConnectCollateralContracts(
                vars.collaterals[vars.i],
                vars.priceFeeds[vars.i],
                r.boldToken,
                r.collateralRegistry,
                r.usdcCurvePool,
                vars.addressesRegistries[vars.i],
                address(vars.troveManagers[vars.i]),
                r.hintHelpers,
                r.multiTroveGetter
            );
            r.contractsArray[vars.i] = vars.contracts;
        }

        r.boldToken.setCollateralRegistry(address(r.collateralRegistry));

        // exchange helpers
        r.exchangeHelpers = new HybridCurveUniV3ExchangeHelpers(
            USDC,
            WETH,
            r.usdcCurvePool,
            USDC_INDEX, // USDC Curve pool index
            BOLD_TOKEN_INDEX, // BOLD Curve pool index
            UNIV3_FEE_USDC_WETH,
            UNIV3_FEE_WETH_COLL,
            uniV3QuoterSepolia
        );
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

    function _deployAndConnectCollateralContracts(
        IERC20Metadata _collToken,
        IPriceFeed _priceFeed,
        IBoldToken _boldToken,
        ICollateralRegistry _collateralRegistry,
        ICurveStableswapNGPool _usdcCurvePool,
        IAddressesRegistry _addressesRegistry,
        address _troveManagerAddress,
        IHintHelpers _hintHelpers,
        IMultiTroveGetter _multiTroveGetter
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

        contracts.priceFeed = _priceFeed;
        //console2.log(computeGovernanceAddress(deployer, SALT, _boldToken, new address[](0)), "computeGovernanceAddress");
        contracts.interestRouter =
            IInterestRouter(computeGovernanceAddress(deployer, SALT, _boldToken, new address[](0)));
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

        // deploy zappers
        (contracts.gasCompZapper, contracts.wethZapper, contracts.leverageZapper) =
            _deployZappers(contracts.addressesRegistry, contracts.collToken, _boldToken, _usdcCurvePool);
    }

    function _deployZappers(
        IAddressesRegistry _addressesRegistry,
        IERC20 _collToken,
        IBoldToken _boldToken,
        ICurveStableswapNGPool _usdcCurvePool
    ) internal returns (GasCompZapper gasCompZapper, WETHZapper wethZapper, ILeverageZapper leverageZapper) {
        IFlashLoanProvider flashLoanProvider = new BalancerFlashLoan();

        IExchange hybridExchange = new HybridCurveUniV3Exchange(
            _collToken,
            _boldToken,
            USDC,
            WETH,
            _usdcCurvePool,
            USDC_INDEX, // USDC Curve pool index
            BOLD_TOKEN_INDEX, // BOLD Curve pool index
            UNIV3_FEE_USDC_WETH,
            UNIV3_FEE_WETH_COLL,
            uniV3RouterSepolia
        );

        bool lst = _collToken != WETH;
        if (lst) {
            gasCompZapper = new GasCompZapper(_addressesRegistry, flashLoanProvider, hybridExchange);
        } else {
            wethZapper = new WETHZapper(_addressesRegistry, flashLoanProvider, hybridExchange);
        }
        leverageZapper = _deployHybridLeverageZapper(_addressesRegistry, flashLoanProvider, hybridExchange, lst);
    }

    function _deployHybridLeverageZapper(
        IAddressesRegistry _addressesRegistry,
        IFlashLoanProvider _flashLoanProvider,
        IExchange _hybridExchange,
        bool _lst
    ) internal returns (ILeverageZapper) {
        ILeverageZapper leverageZapperHybrid;
        if (_lst) {
            leverageZapperHybrid = new LeverageLSTZapper(_addressesRegistry, _flashLoanProvider, _hybridExchange);
        } else {
            leverageZapperHybrid = new LeverageWETHZapper(_addressesRegistry, _flashLoanProvider, _hybridExchange);
        }

        return leverageZapperHybrid;
    }

    function _deployCurveBoldUsdcPool(IBoldToken _boldToken) internal returns (ICurveStableswapNGPool) {
        if (block.chainid == 31337) {
            // local
            return ICurveStableswapNGPool(address(0));
        }

        // deploy Curve StableswapNG pool
        address[] memory coins = new address[](2);
        coins[BOLD_TOKEN_INDEX] = address(_boldToken);
        coins[USDC_INDEX] = address(USDC);
        uint8[] memory assetTypes = new uint8[](2); // 0: standard
        bytes4[] memory methodIds = new bytes4[](2);
        address[] memory oracles = new address[](2);
        ICurveStableswapNGPool curvePool = curveStableswapFactory.deploy_plain_pool(
            "USDC-BOLD",
            "USDCBOLD",
            coins,
            200, // A
            1000000, // fee
            20000000000, // _offpeg_fee_multiplier
            865, // _ma_exp_time
            0, // implementation id
            assetTypes,
            methodIds,
            oracles
        );

        return curvePool;
    }

    function _provideFlashloanLiquidity(ERC20Faucet _collToken, ERC20Faucet _monkeyBalls) internal {
        uint256[] memory amountsIn = new uint256[](2);
        amountsIn[0] = 1_000_000 ether;
        amountsIn[1] = 1_000_000 ether;

        _collToken.mint(deployer, amountsIn[0]);
        _monkeyBalls.mint(deployer, amountsIn[1]);

        IERC20[] memory tokens = new IERC20[](2);
        (tokens[0], tokens[1]) =
            address(_collToken) < address(_monkeyBalls) ? (_collToken, _monkeyBalls) : (_monkeyBalls, _collToken);

        uint256[] memory normalizedWeights = new uint256[](2);
        normalizedWeights[0] = 0.5 ether;
        normalizedWeights[1] = 0.5 ether;

        IWeightedPool pool = balancerFactorySepolia.create({
            name: string.concat(_collToken.name(), "-", _monkeyBalls.name()),
            symbol: string.concat("bpt", _collToken.symbol(), _monkeyBalls.symbol()),
            tokens: tokens,
            normalizedWeights: normalizedWeights,
            rateProviders: new IRateProvider[](2), // all zeroes
            swapFeePercentage: 0.000001 ether, // 0.0001%, which is the minimum allowed
            owner: deployer,
            salt: bytes32("NaCl")
        });

        _collToken.approve(address(balancerVault), amountsIn[0]);
        _monkeyBalls.approve(address(balancerVault), amountsIn[1]);

        balancerVault.joinPool(
            pool.getPoolId(),
            deployer,
            deployer,
            IVault.JoinPoolRequest({
                assets: tokens,
                maxAmountsIn: amountsIn,
                userData: abi.encode(IWeightedPool.JoinKind.INIT, amountsIn),
                fromInternalBalance: false
            })
        );
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

    struct ProvideUniV3LiquidityVars {
        uint256 token2Amount;
        address[2] tokens;
        uint256[2] amounts;
        uint256 price;
        int24 tickLower;
        int24 tickUpper;
    }

    // _price should be _token1 / _token2
    function _provideUniV3Liquidity(
        ERC20Faucet _token1,
        ERC20Faucet _token2,
        uint256 _token1Amount,
        uint256 _price,
        uint24 _fee
    ) internal {
        ProvideUniV3LiquidityVars memory vars;
        // tokens and amounts
        vars.token2Amount = _token1Amount * DECIMAL_PRECISION / _price;

        if (address(_token1) < address(_token2)) {
            vars.tokens[0] = address(_token1);
            vars.tokens[1] = address(_token2);
            vars.amounts[0] = _token1Amount;
            vars.amounts[1] = vars.token2Amount;
            // inverse price if token1 goes first
            vars.price = DECIMAL_PRECISION * DECIMAL_PRECISION / _price;
        } else {
            vars.tokens[0] = address(_token2);
            vars.tokens[1] = address(_token1);
            vars.amounts[0] = vars.token2Amount;
            vars.amounts[1] = _token1Amount;
            vars.price = _price;
        }

        //console2.log(priceToSqrtPriceX96(vars.price), "_priceToSqrtPrice(price)");
        uniV3PositionManagerSepolia.createAndInitializePoolIfNecessary(
            vars.tokens[0], vars.tokens[1], _fee, priceToSqrtPriceX96(vars.price)
        );

        // mint and approve
        _token1.mint(deployer, _token1Amount);
        _token2.mint(deployer, vars.token2Amount);
        _token1.approve(address(uniV3PositionManagerSepolia), _token1Amount);
        _token2.approve(address(uniV3PositionManagerSepolia), vars.token2Amount);

        // mint new position
        address uniV3PoolAddress = uniswapV3FactorySepolia.getPool(vars.tokens[0], vars.tokens[1], _fee);
        int24 TICK_SPACING = IUniswapV3Pool(uniV3PoolAddress).tickSpacing();
        ( /* uint256 finalSqrtPriceX96 */ , int24 tick,,,,,) = IUniswapV3Pool(uniV3PoolAddress).slot0();
        //console2.log(finalSqrtPriceX96, "finalSqrtPriceX96");
        vars.tickLower = (tick - 6000) / TICK_SPACING * TICK_SPACING;
        vars.tickUpper = (tick + 6000) / TICK_SPACING * TICK_SPACING;

        INonfungiblePositionManager.MintParams memory params = INonfungiblePositionManager.MintParams({
            token0: vars.tokens[0],
            token1: vars.tokens[1],
            fee: _fee,
            tickLower: vars.tickLower,
            tickUpper: vars.tickUpper,
            amount0Desired: vars.amounts[0],
            amount1Desired: vars.amounts[1],
            amount0Min: 0,
            amount1Min: 0,
            recipient: deployer,
            deadline: block.timestamp + 600 minutes
        });

        uniV3PositionManagerSepolia.mint(params);
        //(finalSqrtPriceX96, tick,,,,,) = IUniswapV3Pool(uniV3PoolAddress).slot0();
        //console2.log(finalSqrtPriceX96, "finalSqrtPriceX96");

        /*
        console2.log("--");
        console2.log(_token1.name());
        console2.log(address(_token1), "address(_token1)");
        console2.log(_token1Amount, "_token1Amount");
        console2.log(_token1.balanceOf(uniV3PoolAddress), "token1.balanceOf(pool)");
        console2.log(_token2.name());
        console2.log(address(_token2), "address(_token2)");
        console2.log(vars.token2Amount, "token2Amount");
        console2.log(_token2.balanceOf(uniV3PoolAddress), "token2.balanceOf(pool)");
        */
    }

    function _priceToSqrtPrice(uint256 _price) public pure returns (uint160) {
        return uint160(Math.sqrt((_price << 192) / DECIMAL_PRECISION));
    }

    function _provideCurveLiquidity(IBoldToken _boldToken, LiquityContracts memory _contracts) internal {
        ICurveStableswapNGPool usdcCurvePool =
            HybridCurveUniV3Exchange(address(_contracts.leverageZapper.exchange())).curvePool();
        // Add liquidity to USDC-BOLD
        //uint256 usdcAmount = 1e15; // 1B with 6 decimals
        //boldAmount = usdcAmount * 1e12; // from 6 to 18 decimals
        uint256 usdcAmount = 1e27;
        uint256 boldAmount = usdcAmount;

        // mint
        ERC20Faucet(address(USDC)).mint(deployer, usdcAmount);
        (uint256 price,) = _contracts.priceFeed.fetchPrice();
        _mintBold(boldAmount, price, _contracts);
        // approve
        USDC.approve(address(usdcCurvePool), usdcAmount);
        _boldToken.approve(address(usdcCurvePool), boldAmount);

        uint256[] memory amountsDynamic = new uint256[](2);
        amountsDynamic[0] = boldAmount;
        amountsDynamic[1] = usdcAmount;
        // add liquidity
        usdcCurvePool.add_liquidity(amountsDynamic, 0);
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

    function _getBranchContractsJson(LiquityContracts memory c) internal pure returns (string memory) {
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
                    string.concat('"wethZapper":"', address(c.wethZapper).toHexString(), '",'),
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
                string.concat('"governance":', _governanceManifest, "") // no comma
            ),
            "}"
        );
    }
}
