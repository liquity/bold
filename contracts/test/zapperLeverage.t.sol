// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import "./TestContracts/DevTestSetup.sol";
import "./TestContracts/WETH.sol";
import "src/Zappers/Modules/Exchanges/Curve/ICurvePool.sol";
import "src/Zappers/Modules/Exchanges/CurveExchange.sol";
import "src/Zappers/Modules/Exchanges/UniswapV3/IUniswapV3Pool.sol";
import "src/Zappers/Modules/Exchanges/UniV3Exchange.sol";
import "src/Zappers/Modules/Exchanges/UniswapV3/INonfungiblePositionManager.sol";
import "src/Zappers/Modules/Exchanges/UniswapV3/IUniswapV3Factory.sol";
import "src/Zappers/Modules/Exchanges/UniswapV3/IQuoterV2.sol";
import "src/Zappers/Modules/Exchanges/UniswapV3/ISwapRouter.sol";
import "src/Zappers/Modules/Exchanges/HybridCurveUniV3Exchange.sol";
import "src/Zappers/Modules/Exchanges/HybridCurveUniV3ExchangeHelpers.sol";
import "src/Zappers/Interfaces/IFlashLoanProvider.sol";
import "src/Zappers/Modules/FlashLoans/Balancer/vault/IVault.sol";

import "src/Zappers/Modules/Exchanges/Curve/ICurveStableswapNGFactory.sol";

contract ZapperLeverageMainnet is DevTestSetup {
    using StringFormatting for uint256;

    IERC20 constant USDC = IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);

    // Curve
    uint128 constant BOLD_TOKEN_INDEX = 0;
    uint256 constant COLL_TOKEN_INDEX = 1;
    uint128 constant USDC_INDEX = 1;

    // UniV3
    INonfungiblePositionManager constant uniV3PositionManager =
        INonfungiblePositionManager(0xC36442b4a4522E871399CD717aBDD847Ab11FE88);
    IUniswapV3Factory constant uniswapV3Factory = IUniswapV3Factory(0x1F98431c8aD98523631AE4a59f267346ea31F984);
    IQuoterV2 constant uniV3Quoter = IQuoterV2(0x61fFE014bA17989E743c5F6cB21bF9697530B21e);
    ISwapRouter constant uniV3Router = ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);
    uint24 constant UNIV3_FEE = 3000; // 0.3%
    uint24 constant UNIV3_FEE_USDC_WETH = 500; // 0.05%
    uint24 constant UNIV3_FEE_WETH_COLL = 100; // 0.01%

    uint256 constant NUM_COLLATERALS = 3;

    IZapper[] baseZapperArray;
    ILeverageZapper[] leverageZapperCurveArray;
    ILeverageZapper[] leverageZapperUniV3Array;
    ILeverageZapper[] leverageZapperHybridArray;

    HybridCurveUniV3ExchangeHelpers hybridCurveUniV3ExchangeHelpers;

    ICurveStableswapNGPool usdcCurvePool;

    TestDeployer.LiquityContracts[] contractsArray;

    struct OpenTroveVars {
        uint256 price;
        uint256 flashLoanAmount;
        uint256 expectedBoldAmount;
        uint256 maxNetDebt;
        uint256 effectiveBoldAmount;
        uint256 value;
        uint256 troveId;
    }

    struct LeverVars {
        uint256 price;
        uint256 currentCR;
        uint256 currentLR;
        uint256 currentCollAmount;
        uint256 flashLoanAmount;
        uint256 expectedBoldAmount;
        uint256 maxNetDebtIncrease;
        uint256 effectiveBoldAmount;
    }

    struct TestVars {
        uint256 collAmount;
        uint256 initialLeverageRatio;
        uint256 troveId;
        uint256 initialDebt;
        uint256 newLeverageRatio;
        uint256 resultingCollateralRatio;
        uint256 flashLoanAmount;
        uint256 price;
        uint256 boldBalanceBeforeA;
        uint256 ethBalanceBeforeA;
        uint256 collBalanceBeforeA;
        uint256 boldBalanceBeforeZapper;
        uint256 ethBalanceBeforeZapper;
        uint256 collBalanceBeforeZapper;
        uint256 boldBalanceBeforeExchange;
        uint256 ethBalanceBeforeExchange;
        uint256 collBalanceBeforeExchange;
    }

    enum ExchangeType {
        Curve,
        UniV3,
        HybridCurveUniV3
    }

    function setUp() public override {
        uint256 forkBlock = 21328610;

        try vm.envString("MAINNET_RPC_URL") returns (string memory rpcUrl) {
            vm.createSelectFork(rpcUrl, forkBlock);
        } catch {
            vm.skip(true);
        }

        // Start tests at a non-zero timestamp
        vm.warp(block.timestamp + 600);

        accounts = new Accounts();
        createAccounts();

        (A, B, C, D, E, F, G) = (
            accountsList[0],
            accountsList[1],
            accountsList[2],
            accountsList[3],
            accountsList[4],
            accountsList[5],
            accountsList[6]
        );

        WETH = IWETH(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);

        TestDeployer.TroveManagerParams[] memory troveManagerParamsArray =
            new TestDeployer.TroveManagerParams[](NUM_COLLATERALS);
        troveManagerParamsArray[0] = TestDeployer.TroveManagerParams(150e16, 110e16, 10e16, 110e16, 10_000_000e18, 5e16, 10e16, 0);
        for (uint256 c = 0; c < NUM_COLLATERALS; c++) {
            troveManagerParamsArray[c] = TestDeployer.TroveManagerParams(160e16, 120e16, 10e16, 120e16, 10_000_000e18, 5e16, 10e16, c);
        }

        TestDeployer deployer = new TestDeployer();
        TestDeployer.DeploymentResultMainnet memory result =
            deployer.deployAndConnectContractsMainnet(troveManagerParamsArray);
        collateralRegistry = result.collateralRegistry;
        boldToken = result.boldToken;
        // Record contracts
        baseZapperArray.push(result.zappersArray[0].wethZapper);
        for (uint256 c = 1; c < NUM_COLLATERALS; c++) {
            baseZapperArray.push(result.zappersArray[c].gasCompZapper);
        }
        for (uint256 c = 0; c < NUM_COLLATERALS; c++) {
            contractsArray.push(result.contractsArray[c]);
            leverageZapperCurveArray.push(result.zappersArray[c].leverageZapperCurve);
            leverageZapperUniV3Array.push(result.zappersArray[c].leverageZapperUniV3);
            leverageZapperHybridArray.push(result.zappersArray[c].leverageZapperHybrid);
        }

        // Bootstrap Curve pools
        fundCurveV2Pools(result.contractsArray, result.zappersArray);

        // Bootstrap UniV3 pools
        fundUniV3Pools(result.contractsArray);

        // Give some Collateral to test accounts
        uint256 initialCollateralAmount = 10_000e18;

        // A to F
        for (uint256 c = 0; c < NUM_COLLATERALS; c++) {
            for (uint256 i = 0; i < 6; i++) {
                // Give some raw ETH to test accounts
                deal(accountsList[i], initialCollateralAmount);
                // Give and approve some coll token to test accounts
                deal(address(contractsArray[c].collToken), accountsList[i], initialCollateralAmount);
                vm.startPrank(accountsList[i]);
                contractsArray[c].collToken.approve(address(baseZapperArray[c]), initialCollateralAmount);
                contractsArray[c].collToken.approve(address(leverageZapperCurveArray[c]), initialCollateralAmount);
                contractsArray[c].collToken.approve(address(leverageZapperUniV3Array[c]), initialCollateralAmount);
                contractsArray[c].collToken.approve(address(leverageZapperHybridArray[c]), initialCollateralAmount);
                vm.stopPrank();
            }
        }

        // exchange helpers
        hybridCurveUniV3ExchangeHelpers = new HybridCurveUniV3ExchangeHelpers(
            USDC,
            WETH,
            usdcCurvePool,
            USDC_INDEX, // USDC Curve pool index
            BOLD_TOKEN_INDEX, // BOLD Curve pool index
            UNIV3_FEE_USDC_WETH,
            UNIV3_FEE_WETH_COLL,
            uniV3Quoter
        );
    }

    function fundCurveV2Pools(
        TestDeployer.LiquityContracts[] memory _contractsArray,
        TestDeployer.Zappers[] memory _zappersArray
    ) internal {
        uint256 boldAmount;
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            (uint256 price,) = _contractsArray[i].priceFeed.fetchPrice();
            ICurvePool curvePool = CurveExchange(address(_zappersArray[i].leverageZapperCurve.exchange())).curvePool();

            // Add liquidity
            uint256 collAmount = 1000 ether;
            boldAmount = collAmount * price / DECIMAL_PRECISION;
            deal(address(_contractsArray[i].collToken), A, collAmount);
            deal(address(boldToken), A, boldAmount);
            vm.startPrank(A);
            // approve
            _contractsArray[i].collToken.approve(address(curvePool), collAmount);
            boldToken.approve(address(curvePool), boldAmount);
            uint256[2] memory amounts;
            amounts[0] = boldAmount;
            amounts[1] = collAmount;
            curvePool.add_liquidity(amounts, 0);
            vm.stopPrank();
        }

        // Add liquidity to USDC-BOLD
        usdcCurvePool = HybridCurveUniV3Exchange(address(_zappersArray[0].leverageZapperHybrid.exchange())).curvePool();
        uint256 usdcAmount = 1e15; // 1B with 6 decimals
        boldAmount = usdcAmount * 1e12; // from 6 to 18 decimals
        deal(address(USDC), A, usdcAmount);
        deal(address(boldToken), A, boldAmount);
        vm.startPrank(A);
        // approve
        USDC.approve(address(usdcCurvePool), usdcAmount);
        boldToken.approve(address(usdcCurvePool), boldAmount);
        uint256[] memory amountsDynamic = new uint256[](2);
        amountsDynamic[0] = boldAmount;
        amountsDynamic[1] = usdcAmount;
        // add liquidity
        usdcCurvePool.add_liquidity(amountsDynamic, 0);
        vm.stopPrank();
    }

    function fundUniV3Pools(TestDeployer.LiquityContracts[] memory _contractsArray) internal {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            (uint256 price,) = _contractsArray[i].priceFeed.fetchPrice();
            //console2.log(price, "price");

            // tokens and amounts
            uint256 collAmount = 1000 ether;
            uint256 boldAmount = collAmount * price / DECIMAL_PRECISION;
            address[2] memory tokens;
            uint256[2] memory amounts;
            if (address(boldToken) < address(_contractsArray[i].collToken)) {
                //console2.log("b < c");
                tokens[0] = address(boldToken);
                tokens[1] = address(_contractsArray[i].collToken);
                amounts[0] = boldAmount;
                amounts[1] = collAmount;
            } else {
                //console2.log("c < b");
                tokens[0] = address(_contractsArray[i].collToken);
                tokens[1] = address(boldToken);
                amounts[0] = collAmount;
                amounts[1] = boldAmount;
            }

            // Add liquidity

            vm.startPrank(A);

            // deal and approve
            deal(address(_contractsArray[i].collToken), A, collAmount);
            deal(address(boldToken), A, boldAmount);
            _contractsArray[i].collToken.approve(address(uniV3PositionManager), collAmount);
            boldToken.approve(address(uniV3PositionManager), boldAmount);

            // mint new position
            address uniV3PoolAddress =
                uniswapV3Factory.getPool(address(boldToken), address(_contractsArray[i].collToken), UNIV3_FEE);
            //console2.log(uniV3PoolAddress, "uniV3PoolAddress");
            int24 TICK_SPACING = IUniswapV3Pool(uniV3PoolAddress).tickSpacing();
            (, int24 tick,,,,,) = IUniswapV3Pool(uniV3PoolAddress).slot0();
            int24 tickLower = (tick - 6000) / TICK_SPACING * TICK_SPACING;
            int24 tickUpper = (tick + 6000) / TICK_SPACING * TICK_SPACING;
            INonfungiblePositionManager.MintParams memory params = INonfungiblePositionManager.MintParams({
                token0: tokens[0],
                token1: tokens[1],
                fee: UNIV3_FEE,
                tickLower: tickLower,
                tickUpper: tickUpper,
                amount0Desired: amounts[0],
                amount1Desired: amounts[1],
                amount0Min: 0,
                amount1Min: 0,
                recipient: A,
                deadline: block.timestamp
            });

            uniV3PositionManager.mint(params);

            vm.stopPrank();
        }
    }

    // Implementing `onERC721Received` so this contract can receive custody of erc721 tokens
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    struct OpenLeveragedTroveWithIndexParams {
        ILeverageZapper leverageZapper;
        IERC20 collToken;
        uint256 index;
        uint256 collAmount;
        uint256 leverageRatio;
        IPriceFeed priceFeed;
        ExchangeType exchangeType;
        uint256 branch;
        address batchManager;
    }

    function openLeveragedTroveWithIndex(OpenLeveragedTroveWithIndexParams memory _inputParams)
        internal
        returns (uint256, uint256)
    {
        OpenTroveVars memory vars;
        (vars.price,) = _inputParams.priceFeed.fetchPrice();

        // This should be done in the frontend
        vars.flashLoanAmount =
            _inputParams.collAmount * (_inputParams.leverageRatio - DECIMAL_PRECISION) / DECIMAL_PRECISION;
        vars.expectedBoldAmount = vars.flashLoanAmount * vars.price / DECIMAL_PRECISION;
        vars.maxNetDebt = vars.expectedBoldAmount * 105 / 100; // slippage
        vars.effectiveBoldAmount = _getBoldAmountToSwap(
            _inputParams.exchangeType,
            _inputParams.branch,
            vars.expectedBoldAmount,
            vars.maxNetDebt,
            vars.flashLoanAmount,
            _inputParams.collToken
        );

        ILeverageZapper.OpenLeveragedTroveParams memory params = ILeverageZapper.OpenLeveragedTroveParams({
            owner: A,
            ownerIndex: _inputParams.index,
            collAmount: _inputParams.collAmount,
            flashLoanAmount: vars.flashLoanAmount,
            boldAmount: vars.effectiveBoldAmount,
            upperHint: 0,
            lowerHint: 0,
            annualInterestRate: _inputParams.batchManager == address(0) ? 5e16 : 0,
            batchManager: _inputParams.batchManager,
            maxUpfrontFee: 1000e18,
            addManager: address(0),
            removeManager: address(0),
            receiver: address(0)
        });
        vm.startPrank(A);
        vars.value = _inputParams.branch > 0 ? ETH_GAS_COMPENSATION : _inputParams.collAmount + ETH_GAS_COMPENSATION;
        _inputParams.leverageZapper.openLeveragedTroveWithRawETH{value: vars.value}(params);
        vars.troveId = addressToTroveIdThroughZapper(address(_inputParams.leverageZapper), A, _inputParams.index);
        vm.stopPrank();

        return (vars.troveId, vars.effectiveBoldAmount);
    }

    function _setInitialBalances(ILeverageZapper _leverageZapper, uint256 _branch, TestVars memory vars)
        internal
        view
    {
        vars.boldBalanceBeforeA = boldToken.balanceOf(A);
        vars.ethBalanceBeforeA = A.balance;
        vars.collBalanceBeforeA = contractsArray[_branch].collToken.balanceOf(A);
        vars.boldBalanceBeforeZapper = boldToken.balanceOf(address(_leverageZapper));
        vars.ethBalanceBeforeZapper = address(_leverageZapper).balance;
        vars.collBalanceBeforeZapper = contractsArray[_branch].collToken.balanceOf(address(_leverageZapper));
        vars.boldBalanceBeforeExchange = boldToken.balanceOf(address(_leverageZapper.exchange()));
        vars.ethBalanceBeforeExchange = address(_leverageZapper.exchange()).balance;
        vars.collBalanceBeforeExchange =
            contractsArray[_branch].collToken.balanceOf(address(_leverageZapper.exchange()));
    }

    function testCanOpenTroveWithCurve() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testCanOpenTrove(leverageZapperCurveArray[i], ExchangeType.Curve, i, address(0));
        }
    }

    function testCanOpenTroveWithUniV3() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testCanOpenTrove(leverageZapperUniV3Array[i], ExchangeType.UniV3, i, address(0));
        }
    }

    function testCanOpenTroveWithHybrid() external {
        // Not enough liquidity for ETHx
        for (uint256 i = 0; i < 3; i++) {
            _testCanOpenTrove(leverageZapperHybridArray[i], ExchangeType.HybridCurveUniV3, i, address(0));
        }
    }

    function testCanOpenTroveAndJoinBatchWithCurve() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _registerBatchManager(B, i);
            _testCanOpenTrove(leverageZapperCurveArray[i], ExchangeType.Curve, i, B);
        }
    }

    function testCanOpenTroveAndJoinBatchWithUniV3() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            if (i == 2) continue; // TODO!!
            _registerBatchManager(B, i);
            _testCanOpenTrove(leverageZapperUniV3Array[i], ExchangeType.UniV3, i, B);
        }
    }

    function testCanOpenTroveAndJoinBatchWithHybrid() external {
        // Not enough liquidity for ETHx
        for (uint256 i = 0; i < 3; i++) {
            _registerBatchManager(B, i);
            _testCanOpenTrove(leverageZapperHybridArray[i], ExchangeType.HybridCurveUniV3, i, B);
        }
    }

    function _registerBatchManager(address _account, uint256 _branch) internal {
        vm.startPrank(_account);
        contractsArray[_branch].borrowerOperations.registerBatchManager(
            uint128(1e16), uint128(20e16), uint128(5e16), uint128(25e14), MIN_INTEREST_RATE_CHANGE_PERIOD
        );
        vm.stopPrank();
    }

    function _testCanOpenTrove(
        ILeverageZapper _leverageZapper,
        ExchangeType _exchangeType,
        uint256 _branch,
        address _batchManager
    ) internal {
        TestVars memory vars;
        vars.collAmount = 10 ether;
        vars.newLeverageRatio = 2e18;
        vars.resultingCollateralRatio = _leverageZapper.leverageRatioToCollateralRatio(vars.newLeverageRatio);

        _setInitialBalances(_leverageZapper, _branch, vars);

        OpenLeveragedTroveWithIndexParams memory openTroveParams;
        openTroveParams.leverageZapper = _leverageZapper;
        openTroveParams.collToken = contractsArray[_branch].collToken;
        openTroveParams.index = 0;
        openTroveParams.collAmount = vars.collAmount;
        openTroveParams.leverageRatio = vars.newLeverageRatio;
        openTroveParams.priceFeed = contractsArray[_branch].priceFeed;
        openTroveParams.exchangeType = _exchangeType;
        openTroveParams.branch = _branch;
        openTroveParams.batchManager = _batchManager;
        uint256 expectedMinNetDebt;
        (vars.troveId, expectedMinNetDebt) = openLeveragedTroveWithIndex(openTroveParams);

        // Checks
        (vars.price,) = contractsArray[_branch].priceFeed.fetchPrice();
        // owner
        assertEq(contractsArray[_branch].troveNFT.ownerOf(vars.troveId), A, "Wrong owner");
        // troveId
        assertGt(vars.troveId, 0, "Trove id should be set");
        // coll
        assertEq(
            getTroveEntireColl(contractsArray[_branch].troveManager, vars.troveId),
            vars.collAmount * vars.newLeverageRatio / DECIMAL_PRECISION,
            "Coll mismatch"
        );
        // debt
        uint256 expectedMaxNetDebt = expectedMinNetDebt * 105 / 100;
        uint256 troveEntireDebt = getTroveEntireDebt(contractsArray[_branch].troveManager, vars.troveId);
        assertGe(troveEntireDebt, expectedMinNetDebt, "Debt too low");
        assertLe(troveEntireDebt, expectedMaxNetDebt, "Debt too high");
        // CR
        uint256 ICR = contractsArray[_branch].troveManager.getCurrentICR(vars.troveId, vars.price);
        assertTrue(ICR >= vars.resultingCollateralRatio || vars.resultingCollateralRatio - ICR < 3e16, "Wrong CR");
        // token balances
        assertEq(boldToken.balanceOf(A), vars.boldBalanceBeforeA, "BOLD bal mismatch");
        assertEq(
            boldToken.balanceOf(address(_leverageZapper)), vars.boldBalanceBeforeZapper, "Zapper should not keep BOLD"
        );
        assertEq(
            boldToken.balanceOf(address(_leverageZapper.exchange())),
            vars.boldBalanceBeforeExchange,
            "Exchange should not keep BOLD"
        );
        assertEq(
            contractsArray[_branch].collToken.balanceOf(address(_leverageZapper)),
            vars.collBalanceBeforeZapper,
            "Zapper should not keep Coll"
        );
        assertEq(
            contractsArray[_branch].collToken.balanceOf(address(_leverageZapper.exchange())),
            vars.collBalanceBeforeExchange,
            "Exchange should not keep Coll"
        );
        assertEq(address(_leverageZapper).balance, vars.ethBalanceBeforeZapper, "Zapper should not keep ETH");
        assertEq(
            address(_leverageZapper.exchange()).balance, vars.ethBalanceBeforeExchange, "Exchange should not keep ETH"
        );
        if (_branch > 0) {
            // LST
            assertEq(A.balance, vars.ethBalanceBeforeA - ETH_GAS_COMPENSATION, "ETH bal mismatch");
            assertGe(
                contractsArray[_branch].collToken.balanceOf(A),
                vars.collBalanceBeforeA - vars.collAmount,
                "Coll bal mismatch"
            );
        } else {
            assertEq(A.balance, vars.ethBalanceBeforeA - ETH_GAS_COMPENSATION - vars.collAmount, "ETH bal mismatch");
            assertGe(contractsArray[_branch].collToken.balanceOf(A), vars.collBalanceBeforeA, "Coll bal mismatch");
        }
    }

    function testOnlyFlashLoanProviderCanCallOpenTroveCallbackWithCurve() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testOnlyFlashLoanProviderCanCallOpenTroveCallback(leverageZapperCurveArray[i]);
        }
    }

    function testOnlyFlashLoanProviderCanCallOpenTroveCallbackWithUniV3() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testOnlyFlashLoanProviderCanCallOpenTroveCallback(leverageZapperUniV3Array[i]);
        }
    }

    function _testOnlyFlashLoanProviderCanCallOpenTroveCallback(ILeverageZapper _leverageZapper) internal {
        ILeverageZapper.OpenLeveragedTroveParams memory params = ILeverageZapper.OpenLeveragedTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: 10 ether,
            flashLoanAmount: 10 ether,
            boldAmount: 10000e18,
            upperHint: 0,
            lowerHint: 0,
            annualInterestRate: 5e16,
            batchManager: address(0),
            maxUpfrontFee: 1000e18,
            addManager: address(0),
            removeManager: address(0),
            receiver: address(0)
        });
        vm.startPrank(A);
        vm.expectRevert("LZ: Caller not FlashLoan provider");
        IFlashLoanReceiver(address(_leverageZapper)).receiveFlashLoanOnOpenLeveragedTrove(params, 10 ether);
        vm.stopPrank();

        // Check receiver is back to zero
        assertEq(address(_leverageZapper.flashLoanProvider().receiver()), address(0), "Receiver should be zero");
    }

    // Lever up

    struct LeverUpParams {
        ILeverageZapper leverageZapper;
        IERC20 collToken;
        uint256 troveId;
        uint256 leverageRatio;
        ITroveManager troveManager;
        IPriceFeed priceFeed;
        ExchangeType exchangeType;
        uint256 branch;
    }

    function _getLeverUpFlashLoanAndBoldAmount(LeverUpParams memory _params) internal returns (uint256, uint256) {
        LeverVars memory vars;
        (vars.price,) = _params.priceFeed.fetchPrice();
        vars.currentCR = _params.troveManager.getCurrentICR(_params.troveId, vars.price);
        vars.currentLR = _params.leverageZapper.leverageRatioToCollateralRatio(vars.currentCR);
        assertGt(_params.leverageRatio, vars.currentLR, "Leverage ratio should increase");
        vars.currentCollAmount = getTroveEntireColl(_params.troveManager, _params.troveId);
        vars.flashLoanAmount = vars.currentCollAmount * _params.leverageRatio / vars.currentLR - vars.currentCollAmount;
        vars.expectedBoldAmount = vars.flashLoanAmount * vars.price / DECIMAL_PRECISION;
        vars.maxNetDebtIncrease = vars.expectedBoldAmount * 105 / 100; // slippage
        // The actual bold we need, capped by the slippage above, to get flash loan amount
        vars.effectiveBoldAmount = _getBoldAmountToSwap(
            _params.exchangeType,
            _params.branch,
            vars.expectedBoldAmount,
            vars.maxNetDebtIncrease,
            vars.flashLoanAmount,
            _params.collToken
        );

        return (vars.flashLoanAmount, vars.effectiveBoldAmount);
    }

    function leverUpTrove(LeverUpParams memory _params) internal returns (uint256, uint256) {
        // This should be done in the frontend
        (uint256 flashLoanAmount, uint256 effectiveBoldAmount) = _getLeverUpFlashLoanAndBoldAmount(_params);

        ILeverageZapper.LeverUpTroveParams memory params = ILeverageZapper.LeverUpTroveParams({
            troveId: _params.troveId,
            flashLoanAmount: flashLoanAmount,
            boldAmount: effectiveBoldAmount,
            maxUpfrontFee: 1000e18
        });
        vm.startPrank(A);
        _params.leverageZapper.leverUpTrove(params);
        vm.stopPrank();

        return (flashLoanAmount, effectiveBoldAmount);
    }

    function testCanLeverUpTroveWithCurve() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testCanLeverUpTrove(leverageZapperCurveArray[i], ExchangeType.Curve, i);
        }
    }

    function testCanLeverUpTroveWithUniV3() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testCanLeverUpTrove(leverageZapperUniV3Array[i], ExchangeType.UniV3, i);
        }
    }

    function testCanLeverUpTroveWithHybrid() external {
        // Not enough liquidity for ETHx
        for (uint256 i = 0; i < 3; i++) {
            _testCanLeverUpTrove(leverageZapperHybridArray[i], ExchangeType.HybridCurveUniV3, i);
        }
    }

    function _testCanLeverUpTrove(ILeverageZapper _leverageZapper, ExchangeType _exchangeType, uint256 _branch)
        internal
    {
        TestVars memory vars;
        vars.collAmount = 10 ether;
        vars.initialLeverageRatio = 2e18;

        OpenLeveragedTroveWithIndexParams memory openTroveParams;
        openTroveParams.leverageZapper = _leverageZapper;
        openTroveParams.collToken = contractsArray[_branch].collToken;
        openTroveParams.index = 0;
        openTroveParams.collAmount = vars.collAmount;
        openTroveParams.leverageRatio = vars.initialLeverageRatio;
        openTroveParams.priceFeed = contractsArray[_branch].priceFeed;
        openTroveParams.exchangeType = _exchangeType;
        openTroveParams.branch = _branch;
        openTroveParams.batchManager = address(0);
        (vars.troveId,) = openLeveragedTroveWithIndex(openTroveParams);

        vars.initialDebt = getTroveEntireDebt(contractsArray[_branch].troveManager, vars.troveId);

        vars.newLeverageRatio = 2.5e18;
        vars.resultingCollateralRatio = _leverageZapper.leverageRatioToCollateralRatio(vars.newLeverageRatio);

        _setInitialBalances(_leverageZapper, _branch, vars);

        LeverUpParams memory params;
        params.leverageZapper = _leverageZapper;
        params.collToken = contractsArray[_branch].collToken;
        params.troveId = vars.troveId;
        params.leverageRatio = vars.newLeverageRatio;
        params.troveManager = contractsArray[_branch].troveManager;
        params.priceFeed = contractsArray[_branch].priceFeed;
        params.exchangeType = _exchangeType;
        params.branch = _branch;
        uint256 expectedMinLeverUpNetDebt;
        (vars.flashLoanAmount, expectedMinLeverUpNetDebt) = leverUpTrove(params);

        // Checks
        (vars.price,) = contractsArray[_branch].priceFeed.fetchPrice();
        // coll
        uint256 coll = getTroveEntireColl(contractsArray[_branch].troveManager, vars.troveId);
        uint256 collExpected = vars.collAmount * vars.newLeverageRatio / DECIMAL_PRECISION;
        assertTrue(coll >= collExpected || collExpected - coll <= 4e17, "Coll mismatch");
        // debt
        uint256 expectedMinNetDebt = vars.initialDebt + expectedMinLeverUpNetDebt;
        uint256 expectedMaxNetDebt = expectedMinNetDebt * 105 / 100;
        uint256 troveEntireDebt = getTroveEntireDebt(contractsArray[_branch].troveManager, vars.troveId);
        assertGe(troveEntireDebt, expectedMinNetDebt, "Debt too low");
        assertLe(troveEntireDebt, expectedMaxNetDebt, "Debt too high");
        // CR
        uint256 ICR = contractsArray[_branch].troveManager.getCurrentICR(vars.troveId, vars.price);
        assertTrue(ICR >= vars.resultingCollateralRatio || vars.resultingCollateralRatio - ICR < 2e16, "Wrong CR");
        // token balances
        assertEq(boldToken.balanceOf(A), vars.boldBalanceBeforeA, "BOLD bal mismatch");
        assertEq(A.balance, vars.ethBalanceBeforeA, "ETH bal mismatch");
        assertGe(contractsArray[_branch].collToken.balanceOf(A), vars.collBalanceBeforeA, "Coll bal mismatch");
        assertEq(
            boldToken.balanceOf(address(_leverageZapper)), vars.boldBalanceBeforeZapper, "Zapper should not keep BOLD"
        );
        assertEq(
            boldToken.balanceOf(address(_leverageZapper.exchange())),
            vars.boldBalanceBeforeExchange,
            "Exchange should not keep BOLD"
        );
        assertEq(
            contractsArray[_branch].collToken.balanceOf(address(_leverageZapper)),
            vars.collBalanceBeforeZapper,
            "Zapper should not keep Coll"
        );
        assertEq(
            contractsArray[_branch].collToken.balanceOf(address(_leverageZapper.exchange())),
            vars.collBalanceBeforeExchange,
            "Exchange should not keep Coll"
        );
        assertEq(address(_leverageZapper).balance, vars.ethBalanceBeforeZapper, "Zapper should not keep ETH");
        assertEq(
            address(_leverageZapper.exchange()).balance, vars.ethBalanceBeforeExchange, "Exchange should not keep ETH"
        );

        // Check receiver is back to zero
        assertEq(address(_leverageZapper.flashLoanProvider().receiver()), address(0), "Receiver should be zero");
    }

    function testCannotLeverUpTroveWithCurveIfZapperIsNotReceiver() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testCannotLeverUpTroveIfZapperIsNotReceiver(leverageZapperCurveArray[i], ExchangeType.Curve, i);
        }
    }

    function testCannotLeverUpTroveWithUniV3IfZapperIsNotReceiver() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testCannotLeverUpTroveIfZapperIsNotReceiver(leverageZapperUniV3Array[i], ExchangeType.UniV3, i);
        }
    }

    function testCannotLeverUpTroveWithHybridIfZapperIsNotReceiver() external {
        // Not enough liquidity for ETHx
        for (uint256 i = 0; i < 3; i++) {
            _testCannotLeverUpTroveIfZapperIsNotReceiver(leverageZapperHybridArray[i], ExchangeType.HybridCurveUniV3, i);
        }
    }

    function _testCannotLeverUpTroveIfZapperIsNotReceiver(
        ILeverageZapper _leverageZapper,
        ExchangeType _exchangeType,
        uint256 _branch
    ) internal {
        TestVars memory vars;
        vars.collAmount = 10 ether;
        vars.initialLeverageRatio = 2e18;

        OpenLeveragedTroveWithIndexParams memory openTroveParams;
        openTroveParams.leverageZapper = _leverageZapper;
        openTroveParams.collToken = contractsArray[_branch].collToken;
        openTroveParams.index = 0;
        openTroveParams.collAmount = vars.collAmount;
        openTroveParams.leverageRatio = vars.initialLeverageRatio;
        openTroveParams.priceFeed = contractsArray[_branch].priceFeed;
        openTroveParams.exchangeType = _exchangeType;
        openTroveParams.branch = _branch;
        openTroveParams.batchManager = address(0);
        (vars.troveId,) = openLeveragedTroveWithIndex(openTroveParams);

        vars.initialDebt = getTroveEntireDebt(contractsArray[_branch].troveManager, vars.troveId);

        vars.newLeverageRatio = 2.5e18;
        vars.resultingCollateralRatio = _leverageZapper.leverageRatioToCollateralRatio(vars.newLeverageRatio);

        LeverUpParams memory getterParams;
        getterParams.leverageZapper = _leverageZapper;
        getterParams.collToken = contractsArray[_branch].collToken;
        getterParams.troveId = vars.troveId;
        getterParams.leverageRatio = vars.newLeverageRatio;
        getterParams.troveManager = contractsArray[_branch].troveManager;
        getterParams.priceFeed = contractsArray[_branch].priceFeed;
        getterParams.exchangeType = _exchangeType;
        getterParams.branch = _branch;

        // This should be done in the frontend
        (uint256 flashLoanAmount, uint256 effectiveBoldAmount) = _getLeverUpFlashLoanAndBoldAmount(getterParams);

        ILeverageZapper.LeverUpTroveParams memory params = ILeverageZapper.LeverUpTroveParams({
            troveId: vars.troveId,
            flashLoanAmount: flashLoanAmount,
            boldAmount: effectiveBoldAmount,
            maxUpfrontFee: 1000e18
        });
        vm.startPrank(A);
        // Change receiver in BO
        contractsArray[_branch].borrowerOperations.setRemoveManagerWithReceiver(
            vars.troveId, address(_leverageZapper), C
        );
        vm.expectRevert("BZ: Zapper is not receiver for this trove");
        _leverageZapper.leverUpTrove(params);
        vm.stopPrank();
    }

    function testOnlyFlashLoanProviderCanCallLeverUpCallbackWithCurve() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testOnlyFlashLoanProviderCanCallLeverUpCallback(leverageZapperCurveArray[i]);
        }
    }

    function testOnlyFlashLoanProviderCanCallLeverUpCallbackWithUniV3() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testOnlyFlashLoanProviderCanCallLeverUpCallback(leverageZapperUniV3Array[i]);
        }
    }

    function _testOnlyFlashLoanProviderCanCallLeverUpCallback(ILeverageZapper _leverageZapper) internal {
        ILeverageZapper.LeverUpTroveParams memory params = ILeverageZapper.LeverUpTroveParams({
            troveId: addressToTroveIdThroughZapper(address(_leverageZapper), A),
            flashLoanAmount: 10 ether,
            boldAmount: 10000e18,
            maxUpfrontFee: 1000e18
        });
        vm.startPrank(A);
        vm.expectRevert("LZ: Caller not FlashLoan provider");
        IFlashLoanReceiver(address(_leverageZapper)).receiveFlashLoanOnLeverUpTrove(params, 10 ether);
        vm.stopPrank();
    }

    function testOnlyOwnerOrManagerCanLeverUpWithCurveFromZapper() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testOnlyOwnerOrManagerCanLeverUpFromZapper(leverageZapperCurveArray[i], ExchangeType.Curve, i);
        }
    }

    function testOnlyOwnerOrManagerCanLeverUpWithUniV3FromZapper() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testOnlyOwnerOrManagerCanLeverUpFromZapper(leverageZapperUniV3Array[i], ExchangeType.UniV3, i);
        }
    }

    function testOnlyOwnerOrManagerCanLeverUpWithHybridFromZapper() external {
        // Not enough liquidity for ETHx
        for (uint256 i = 0; i < 3; i++) {
            _testOnlyOwnerOrManagerCanLeverUpFromZapper(leverageZapperHybridArray[i], ExchangeType.HybridCurveUniV3, i);
        }
    }

    function _testOnlyOwnerOrManagerCanLeverUpFromZapper(
        ILeverageZapper _leverageZapper,
        ExchangeType _exchangeType,
        uint256 _branch
    ) internal {
        // Open trove
        uint256 collAmount = 10 ether;
        uint256 leverageRatio = 2e18;
        OpenLeveragedTroveWithIndexParams memory openTroveParams;
        openTroveParams.leverageZapper = _leverageZapper;
        openTroveParams.collToken = contractsArray[_branch].collToken;
        openTroveParams.index = 0;
        openTroveParams.collAmount = collAmount;
        openTroveParams.leverageRatio = leverageRatio;
        openTroveParams.priceFeed = contractsArray[_branch].priceFeed;
        openTroveParams.exchangeType = _exchangeType;
        openTroveParams.branch = _branch;
        openTroveParams.batchManager = address(0);
        (uint256 troveId,) = openLeveragedTroveWithIndex(openTroveParams);

        LeverUpParams memory getterParams;
        getterParams.leverageZapper = _leverageZapper;
        getterParams.collToken = contractsArray[_branch].collToken;
        getterParams.troveId = troveId;
        getterParams.leverageRatio = 2.5e18;
        getterParams.troveManager = contractsArray[_branch].troveManager;
        getterParams.priceFeed = contractsArray[_branch].priceFeed;
        getterParams.exchangeType = _exchangeType;
        getterParams.branch = _branch;
        (uint256 flashLoanAmount, uint256 effectiveBoldAmount) = _getLeverUpFlashLoanAndBoldAmount(getterParams);

        ILeverageZapper.LeverUpTroveParams memory params = ILeverageZapper.LeverUpTroveParams({
            troveId: troveId,
            flashLoanAmount: flashLoanAmount,
            boldAmount: effectiveBoldAmount,
            maxUpfrontFee: 1000e18
        });
        // B tries to lever up A’s trove
        vm.startPrank(B);
        vm.expectRevert(AddRemoveManagers.NotOwnerNorRemoveManager.selector);
        _leverageZapper.leverUpTrove(params);
        vm.stopPrank();

        // Check receiver is back to zero
        assertEq(address(_leverageZapper.flashLoanProvider().receiver()), address(0), "Receiver should be zero");
    }

    function testOnlyOwnerOrManagerCanLeverUpWithCurveFromBalancerFLProvider() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testOnlyOwnerOrManagerCanLeverUpFromBalancerFLProvider(leverageZapperCurveArray[i], ExchangeType.Curve, i);
        }
    }

    function testOnlyOwnerOrManagerCanLeverUpWithUniV3FromBalancerFLProvider() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testOnlyOwnerOrManagerCanLeverUpFromBalancerFLProvider(leverageZapperUniV3Array[i], ExchangeType.UniV3, i);
        }
    }

    function testOnlyOwnerOrManagerCanLeverUpWithHybridFromBalancerFLProvider() external {
        // Not enough liquidity for ETHx
        for (uint256 i = 0; i < 3; i++) {
            _testOnlyOwnerOrManagerCanLeverUpFromBalancerFLProvider(
                leverageZapperHybridArray[i], ExchangeType.HybridCurveUniV3, i
            );
        }
    }

    function _testOnlyOwnerOrManagerCanLeverUpFromBalancerFLProvider(
        ILeverageZapper _leverageZapper,
        ExchangeType _exchangeType,
        uint256 _branch
    ) internal {
        // Open trove
        uint256 collAmount = 10 ether;
        uint256 leverageRatio = 2e18;
        OpenLeveragedTroveWithIndexParams memory openTroveParams;
        openTroveParams.leverageZapper = _leverageZapper;
        openTroveParams.collToken = contractsArray[_branch].collToken;
        openTroveParams.index = 1;
        openTroveParams.collAmount = collAmount;
        openTroveParams.leverageRatio = leverageRatio;
        openTroveParams.priceFeed = contractsArray[_branch].priceFeed;
        openTroveParams.exchangeType = _exchangeType;
        openTroveParams.branch = _branch;
        openTroveParams.batchManager = address(0);
        (uint256 troveId,) = openLeveragedTroveWithIndex(openTroveParams);

        LeverUpParams memory getterParams;
        getterParams.leverageZapper = _leverageZapper;
        getterParams.collToken = contractsArray[_branch].collToken;
        getterParams.troveId = troveId;
        getterParams.leverageRatio = 2.5e18;
        getterParams.troveManager = contractsArray[_branch].troveManager;
        getterParams.priceFeed = contractsArray[_branch].priceFeed;
        getterParams.exchangeType = _exchangeType;
        getterParams.branch = _branch;
        (uint256 flashLoanAmount, uint256 effectiveBoldAmount) = _getLeverUpFlashLoanAndBoldAmount(getterParams);

        // B tries to lever up A’s trove calling our flash loan provider module
        ILeverageZapper.LeverUpTroveParams memory params = ILeverageZapper.LeverUpTroveParams({
            troveId: troveId,
            flashLoanAmount: flashLoanAmount,
            boldAmount: effectiveBoldAmount,
            maxUpfrontFee: 1000e18
        });
        IFlashLoanProvider flashLoanProvider = _leverageZapper.flashLoanProvider();
        vm.startPrank(B);
        vm.expectRevert(); // reverts without data because it calls back B
        flashLoanProvider.makeFlashLoan(
            contractsArray[_branch].collToken,
            flashLoanAmount,
            IFlashLoanProvider.Operation.LeverUpTrove,
            abi.encode(params)
        );
        vm.stopPrank();

        // Check receiver is back to zero
        assertEq(address(flashLoanProvider.receiver()), address(0), "Receiver should be zero");
    }

    function testOnlyOwnerOrManagerCanLeverUpWithCurveFromBalancerVault() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testOnlyOwnerOrManagerCanLeverUpFromBalancerVault(leverageZapperCurveArray[i], ExchangeType.Curve, i);
        }
    }

    function testOnlyOwnerOrManagerCanLeverUpWithUniV3FromBalancerVault() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testOnlyOwnerOrManagerCanLeverUpFromBalancerVault(leverageZapperUniV3Array[i], ExchangeType.UniV3, i);
        }
    }

    function testOnlyOwnerOrManagerCanLeverUpWithHybridFromBalancerVault() external {
        // Not enough liquidity for ETHx
        for (uint256 i = 0; i < 3; i++) {
            _testOnlyOwnerOrManagerCanLeverUpFromBalancerVault(
                leverageZapperHybridArray[i], ExchangeType.HybridCurveUniV3, i
            );
        }
    }

    function _testOnlyOwnerOrManagerCanLeverUpFromBalancerVault(
        ILeverageZapper _leverageZapper,
        ExchangeType _exchangeType,
        uint256 _branch
    ) internal {
        // Open trove
        uint256 collAmount = 10 ether;
        uint256 leverageRatio = 2e18;
        OpenLeveragedTroveWithIndexParams memory openTroveParams;
        openTroveParams.leverageZapper = _leverageZapper;
        openTroveParams.collToken = contractsArray[_branch].collToken;
        openTroveParams.index = 2;
        openTroveParams.collAmount = collAmount;
        openTroveParams.leverageRatio = leverageRatio;
        openTroveParams.priceFeed = contractsArray[_branch].priceFeed;
        openTroveParams.exchangeType = _exchangeType;
        openTroveParams.branch = _branch;
        openTroveParams.batchManager = address(0);
        (uint256 troveId,) = openLeveragedTroveWithIndex(openTroveParams);

        // B tries to lever up A’s trove calling Balancer Vault directly
        LeverUpParams memory getterParams;
        getterParams.leverageZapper = _leverageZapper;
        getterParams.collToken = contractsArray[_branch].collToken;
        getterParams.troveId = troveId;
        getterParams.leverageRatio = 2.5e18;
        getterParams.troveManager = contractsArray[_branch].troveManager;
        getterParams.priceFeed = contractsArray[_branch].priceFeed;
        getterParams.exchangeType = _exchangeType;
        getterParams.branch = _branch;
        (uint256 flashLoanAmount, uint256 effectiveBoldAmount) = _getLeverUpFlashLoanAndBoldAmount(getterParams);

        ILeverageZapper.LeverUpTroveParams memory params = ILeverageZapper.LeverUpTroveParams({
            troveId: troveId,
            flashLoanAmount: flashLoanAmount,
            boldAmount: effectiveBoldAmount,
            maxUpfrontFee: 1000e18
        });
        IFlashLoanProvider flashLoanProvider = _leverageZapper.flashLoanProvider();
        IERC20[] memory tokens = new IERC20[](1);
        tokens[0] = contractsArray[_branch].collToken;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = flashLoanAmount;
        bytes memory userData = abi.encode(address(_leverageZapper), IFlashLoanProvider.Operation.LeverUpTrove, params);
        IVault vault = IVault(0xBA12222222228d8Ba445958a75a0704d566BF2C8);
        vm.startPrank(B);
        vm.expectRevert("Flash loan not properly initiated");
        vault.flashLoan(IFlashLoanRecipient(address(flashLoanProvider)), tokens, amounts, userData);
        vm.stopPrank();

        // Check receiver is back to zero
        assertEq(address(flashLoanProvider.receiver()), address(0), "Receiver should be zero");
    }

    // Lever down

    function _getLeverDownFlashLoanAndBoldAmount(
        ILeverageZapper _leverageZapper,
        uint256 _troveId,
        uint256 _leverageRatio,
        ITroveManager _troveManager,
        IPriceFeed _priceFeed
    ) internal returns (uint256, uint256) {
        (uint256 price,) = _priceFeed.fetchPrice();

        uint256 currentCR = _troveManager.getCurrentICR(_troveId, price);
        uint256 currentLR = _leverageZapper.leverageRatioToCollateralRatio(currentCR);
        assertLt(_leverageRatio, currentLR, "Leverage ratio should decrease");
        uint256 currentCollAmount = getTroveEntireColl(_troveManager, _troveId);
        uint256 flashLoanAmount = currentCollAmount - currentCollAmount * _leverageRatio / currentLR;
        uint256 expectedBoldAmount = flashLoanAmount * price / DECIMAL_PRECISION;
        uint256 minBoldDebt = expectedBoldAmount * 95 / 100; // slippage

        return (flashLoanAmount, minBoldDebt);
    }

    function leverDownTrove(
        ILeverageZapper _leverageZapper,
        uint256 _troveId,
        uint256 _leverageRatio,
        ITroveManager _troveManager,
        IPriceFeed _priceFeed
    ) internal returns (uint256) {
        // This should be done in the frontend
        (uint256 flashLoanAmount, uint256 minBoldDebt) =
            _getLeverDownFlashLoanAndBoldAmount(_leverageZapper, _troveId, _leverageRatio, _troveManager, _priceFeed);

        ILeverageZapper.LeverDownTroveParams memory params = ILeverageZapper.LeverDownTroveParams({
            troveId: _troveId,
            flashLoanAmount: flashLoanAmount,
            minBoldAmount: minBoldDebt
        });
        vm.startPrank(A);
        _leverageZapper.leverDownTrove(params);
        vm.stopPrank();

        return flashLoanAmount;
    }

    function testCanLeverDownTroveWithCurve() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testCanLeverDownTrove(leverageZapperCurveArray[i], ExchangeType.Curve, i);
        }
    }

    function testCanLeverDownTroveWithUniV3() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testCanLeverDownTrove(leverageZapperUniV3Array[i], ExchangeType.UniV3, i);
        }
    }

    function testCanLeverDownTroveWithHybrid() external {
        // Not enough liquidity for ETHx
        for (uint256 i = 0; i < 3; i++) {
            _testCanLeverDownTrove(leverageZapperHybridArray[i], ExchangeType.HybridCurveUniV3, i);
        }
    }

    function _testCanLeverDownTrove(ILeverageZapper _leverageZapper, ExchangeType _exchangeType, uint256 _branch)
        internal
    {
        TestVars memory vars;
        vars.collAmount = 10 ether;
        vars.initialLeverageRatio = 2e18;

        OpenLeveragedTroveWithIndexParams memory openTroveParams;
        openTroveParams.leverageZapper = _leverageZapper;
        openTroveParams.collToken = contractsArray[_branch].collToken;
        openTroveParams.index = 0;
        openTroveParams.collAmount = vars.collAmount;
        openTroveParams.leverageRatio = vars.initialLeverageRatio;
        openTroveParams.priceFeed = contractsArray[_branch].priceFeed;
        openTroveParams.exchangeType = _exchangeType;
        openTroveParams.branch = _branch;
        openTroveParams.batchManager = address(0);
        (vars.troveId,) = openLeveragedTroveWithIndex(openTroveParams);

        vars.initialDebt = getTroveEntireDebt(contractsArray[_branch].troveManager, vars.troveId);

        vars.newLeverageRatio = 1.5e18;
        vars.resultingCollateralRatio = _leverageZapper.leverageRatioToCollateralRatio(vars.newLeverageRatio);

        _setInitialBalances(_leverageZapper, _branch, vars);

        vars.flashLoanAmount = leverDownTrove(
            _leverageZapper,
            vars.troveId,
            vars.newLeverageRatio,
            contractsArray[_branch].troveManager,
            contractsArray[_branch].priceFeed
        );

        // Checks
        (vars.price,) = contractsArray[_branch].priceFeed.fetchPrice();
        // coll
        uint256 coll = getTroveEntireColl(contractsArray[_branch].troveManager, vars.troveId);
        uint256 collExpected = vars.collAmount * vars.newLeverageRatio / DECIMAL_PRECISION;
        assertTrue(coll >= collExpected || collExpected - coll <= 22e16, "Coll mismatch");
        // debt
        uint256 expectedMinNetDebt =
            vars.initialDebt - vars.flashLoanAmount * vars.price / DECIMAL_PRECISION * 101 / 100;
        uint256 expectedMaxNetDebt = expectedMinNetDebt * 105 / 100;
        uint256 troveEntireDebt = getTroveEntireDebt(contractsArray[_branch].troveManager, vars.troveId);
        assertGe(troveEntireDebt, expectedMinNetDebt, "Debt too low");
        assertLe(troveEntireDebt, expectedMaxNetDebt, "Debt too high");
        // CR
        // When getting flashloan amount, we allow the min debt to deviate up to 5%
        // That deviation can translate into CR, specially for UniV3 exchange which is the less efficient
        // With UniV3, the quoter gives a price “too good”, meaning we exchange less, so the deleverage is lower
        uint256 CRTolerance = _exchangeType == ExchangeType.UniV3 ? 9e16 : 17e15;
        uint256 ICR = contractsArray[_branch].troveManager.getCurrentICR(vars.troveId, vars.price);
        assertTrue(
            ICR >= vars.resultingCollateralRatio || vars.resultingCollateralRatio - ICR < CRTolerance, "Wrong CR"
        );
        // token balances
        assertEq(boldToken.balanceOf(A), vars.boldBalanceBeforeA, "BOLD bal mismatch");
        assertEq(A.balance, vars.ethBalanceBeforeA, "ETH bal mismatch");
        assertGe(contractsArray[_branch].collToken.balanceOf(A), vars.collBalanceBeforeA, "Coll bal mismatch");
        assertEq(
            boldToken.balanceOf(address(_leverageZapper)), vars.boldBalanceBeforeZapper, "Zapper should not keep BOLD"
        );
        assertEq(
            boldToken.balanceOf(address(_leverageZapper.exchange())),
            vars.boldBalanceBeforeExchange,
            "Exchange should not keep BOLD"
        );
        assertEq(
            contractsArray[_branch].collToken.balanceOf(address(_leverageZapper)),
            vars.collBalanceBeforeZapper,
            "Zapper should not keep Coll"
        );
        assertEq(
            contractsArray[_branch].collToken.balanceOf(address(_leverageZapper.exchange())),
            vars.collBalanceBeforeExchange,
            "Exchange should not keep Coll"
        );
        assertEq(address(_leverageZapper).balance, vars.ethBalanceBeforeZapper, "Zapper should not keep ETH");
        assertEq(
            address(_leverageZapper.exchange()).balance, vars.ethBalanceBeforeExchange, "Exchange should not keep ETH"
        );

        // Check receiver is back to zero
        assertEq(address(_leverageZapper.flashLoanProvider().receiver()), address(0), "Receiver should be zero");
    }

    function testCannotLeverDownWithCurveFromZapperIfZapperIsNotReceiver() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testCannotLeverDownFromZapperIfZapperIsNotReceiver(leverageZapperCurveArray[i], ExchangeType.Curve, i);
        }
    }

    function testCannotLeverDownWithUniV3FromZapperIfZapperIsNotReceiver() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testCannotLeverDownFromZapperIfZapperIsNotReceiver(leverageZapperUniV3Array[i], ExchangeType.UniV3, i);
        }
    }

    function testCannotLeverDownWithHybridFromZapperIfZapperIsNotReceiver() external {
        // Not enough liquidity for ETHx
        for (uint256 i = 0; i < 3; i++) {
            _testCannotLeverDownFromZapperIfZapperIsNotReceiver(
                leverageZapperUniV3Array[i], ExchangeType.HybridCurveUniV3, i
            );
        }
    }

    function _testCannotLeverDownFromZapperIfZapperIsNotReceiver(
        ILeverageZapper _leverageZapper,
        ExchangeType _exchangeType,
        uint256 _branch
    ) internal {
        // Open trove
        uint256 collAmount = 10 ether;
        uint256 leverageRatio = 2e18;
        OpenLeveragedTroveWithIndexParams memory openTroveParams;
        openTroveParams.leverageZapper = _leverageZapper;
        openTroveParams.collToken = contractsArray[_branch].collToken;
        openTroveParams.index = 0;
        openTroveParams.collAmount = collAmount;
        openTroveParams.leverageRatio = leverageRatio;
        openTroveParams.priceFeed = contractsArray[_branch].priceFeed;
        openTroveParams.exchangeType = _exchangeType;
        openTroveParams.branch = _branch;
        openTroveParams.batchManager = address(0);
        (uint256 troveId,) = openLeveragedTroveWithIndex(openTroveParams);

        (uint256 flashLoanAmount, uint256 minBoldDebt) = _getLeverDownFlashLoanAndBoldAmount(
            _leverageZapper,
            troveId,
            1.5e18, // _leverageRatio,
            contractsArray[_branch].troveManager,
            contractsArray[_branch].priceFeed
        );

        ILeverageZapper.LeverDownTroveParams memory params = ILeverageZapper.LeverDownTroveParams({
            troveId: troveId,
            flashLoanAmount: flashLoanAmount,
            minBoldAmount: minBoldDebt
        });
        vm.startPrank(A);
        // Change receiver in BO
        contractsArray[_branch].borrowerOperations.setRemoveManagerWithReceiver(troveId, address(_leverageZapper), C);

        vm.expectRevert("BZ: Zapper is not receiver for this trove");
        _leverageZapper.leverDownTrove(params);
        vm.stopPrank();
    }

    function testOnlyFlashLoanProviderCanCallLeverDownCallbackWithCurve() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testOnlyFlashLoanProviderCanCallLeverDownCallback(leverageZapperCurveArray[i]);
        }
    }

    function testOnlyFlashLoanProviderCanCallLeverDownCallbackWithUniV3() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testOnlyFlashLoanProviderCanCallLeverDownCallback(leverageZapperUniV3Array[i]);
        }
    }

    function _testOnlyFlashLoanProviderCanCallLeverDownCallback(ILeverageZapper _leverageZapper) internal {
        ILeverageZapper.LeverDownTroveParams memory params = ILeverageZapper.LeverDownTroveParams({
            troveId: addressToTroveIdThroughZapper(address(_leverageZapper), A),
            flashLoanAmount: 10 ether,
            minBoldAmount: 10000e18
        });
        vm.startPrank(A);
        vm.expectRevert("LZ: Caller not FlashLoan provider");
        IFlashLoanReceiver(address(_leverageZapper)).receiveFlashLoanOnLeverDownTrove(params, 10 ether);
        vm.stopPrank();
    }

    function testOnlyOwnerOrManagerCanLeverDownWithCurveFromZapper() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testOnlyOwnerOrManagerCanLeverDownFromZapper(leverageZapperCurveArray[i], ExchangeType.Curve, i);
        }
    }

    function testOnlyOwnerOrManagerCanLeverDownWithUniV3FromZapper() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testOnlyOwnerOrManagerCanLeverDownFromZapper(leverageZapperUniV3Array[i], ExchangeType.UniV3, i);
        }
    }

    function testOnlyOwnerOrManagerCanLeverDownWithHybridFromZapper() external {
        // Not enough liquidity for ETHx
        for (uint256 i = 0; i < 3; i++) {
            _testOnlyOwnerOrManagerCanLeverDownFromZapper(leverageZapperUniV3Array[i], ExchangeType.HybridCurveUniV3, i);
        }
    }

    function _testOnlyOwnerOrManagerCanLeverDownFromZapper(
        ILeverageZapper _leverageZapper,
        ExchangeType _exchangeType,
        uint256 _branch
    ) internal {
        // Open trove
        uint256 collAmount = 10 ether;
        uint256 leverageRatio = 2e18;
        OpenLeveragedTroveWithIndexParams memory openTroveParams;
        openTroveParams.leverageZapper = _leverageZapper;
        openTroveParams.collToken = contractsArray[_branch].collToken;
        openTroveParams.index = 0;
        openTroveParams.collAmount = collAmount;
        openTroveParams.leverageRatio = leverageRatio;
        openTroveParams.priceFeed = contractsArray[_branch].priceFeed;
        openTroveParams.exchangeType = _exchangeType;
        openTroveParams.branch = _branch;
        openTroveParams.batchManager = address(0);
        (uint256 troveId,) = openLeveragedTroveWithIndex(openTroveParams);

        // B tries to lever up A’s trove
        (uint256 flashLoanAmount, uint256 minBoldDebt) = _getLeverDownFlashLoanAndBoldAmount(
            _leverageZapper,
            troveId,
            1.5e18, // _leverageRatio,
            contractsArray[_branch].troveManager,
            contractsArray[_branch].priceFeed
        );

        ILeverageZapper.LeverDownTroveParams memory params = ILeverageZapper.LeverDownTroveParams({
            troveId: troveId,
            flashLoanAmount: flashLoanAmount,
            minBoldAmount: minBoldDebt
        });
        vm.startPrank(B);
        vm.expectRevert(AddRemoveManagers.NotOwnerNorRemoveManager.selector);
        _leverageZapper.leverDownTrove(params);
        vm.stopPrank();

        // Check receiver is back to zero
        assertEq(address(_leverageZapper.flashLoanProvider().receiver()), address(0), "Receiver should be zero");
    }

    function testOnlyOwnerOrManagerCanLeverDownWithCurveFromBalancerFLProvider() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testOnlyOwnerOrManagerCanLeverDownFromBalancerFLProvider(
                leverageZapperCurveArray[i], ExchangeType.Curve, i
            );
        }
    }

    function testOnlyOwnerOrManagerCanLeverDownWithUniV3FromBalancerFLProvider() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testOnlyOwnerOrManagerCanLeverDownFromBalancerFLProvider(
                leverageZapperUniV3Array[i], ExchangeType.UniV3, i
            );
        }
    }

    function testOnlyOwnerOrManagerCanLeverDownWithHybridFromBalancerFLProvider() external {
        // Not enough liquidity for ETHx
        for (uint256 i = 0; i < 3; i++) {
            _testOnlyOwnerOrManagerCanLeverDownFromBalancerFLProvider(
                leverageZapperHybridArray[i], ExchangeType.HybridCurveUniV3, i
            );
        }
    }

    function _testOnlyOwnerOrManagerCanLeverDownFromBalancerFLProvider(
        ILeverageZapper _leverageZapper,
        ExchangeType _exchangeType,
        uint256 _branch
    ) internal {
        // Open trove
        uint256 collAmount = 10 ether;
        uint256 leverageRatio = 2e18;
        OpenLeveragedTroveWithIndexParams memory openTroveParams;
        openTroveParams.leverageZapper = _leverageZapper;
        openTroveParams.collToken = contractsArray[_branch].collToken;
        openTroveParams.index = 1;
        openTroveParams.collAmount = collAmount;
        openTroveParams.leverageRatio = leverageRatio;
        openTroveParams.priceFeed = contractsArray[_branch].priceFeed;
        openTroveParams.exchangeType = _exchangeType;
        openTroveParams.branch = _branch;
        openTroveParams.batchManager = address(0);
        (uint256 troveId,) = openLeveragedTroveWithIndex(openTroveParams);

        // B tries to lever down A’s trove calling our flash loan provider module
        (uint256 flashLoanAmount, uint256 minBoldDebt) = _getLeverDownFlashLoanAndBoldAmount(
            _leverageZapper,
            troveId,
            1.5e18, // _leverageRatio,
            contractsArray[_branch].troveManager,
            contractsArray[_branch].priceFeed
        );

        ILeverageZapper.LeverDownTroveParams memory params = ILeverageZapper.LeverDownTroveParams({
            troveId: troveId,
            flashLoanAmount: flashLoanAmount,
            minBoldAmount: minBoldDebt
        });
        IFlashLoanProvider flashLoanProvider = _leverageZapper.flashLoanProvider();
        vm.startPrank(B);
        vm.expectRevert(); // reverts without data because it calls back B
        flashLoanProvider.makeFlashLoan(
            contractsArray[_branch].collToken,
            flashLoanAmount,
            IFlashLoanProvider.Operation.LeverDownTrove,
            abi.encode(params)
        );
        vm.stopPrank();

        // Check receiver is back to zero
        assertEq(address(flashLoanProvider.receiver()), address(0), "Receiver should be zero");
    }

    function testOnlyOwnerOrManagerCanLeverDownWithCurveFromBalancerVault() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testOnlyOwnerOrManagerCanLeverDownFromBalancerVault(leverageZapperCurveArray[i], ExchangeType.Curve, i);
        }
    }

    function testOnlyOwnerOrManagerCanLeverDownWithUniV3FromBalancerVault() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testOnlyOwnerOrManagerCanLeverDownFromBalancerVault(leverageZapperUniV3Array[i], ExchangeType.UniV3, i);
        }
    }

    function testOnlyOwnerOrManagerCanLeverDownWithHybridFromBalancerVault() external {
        // Not enough liquidity for ETHx
        for (uint256 i = 0; i < 3; i++) {
            _testOnlyOwnerOrManagerCanLeverDownFromBalancerVault(
                leverageZapperHybridArray[i], ExchangeType.HybridCurveUniV3, i
            );
        }
    }

    function _testOnlyOwnerOrManagerCanLeverDownFromBalancerVault(
        ILeverageZapper _leverageZapper,
        ExchangeType _exchangeType,
        uint256 _branch
    ) internal {
        // Open trove
        uint256 collAmount = 10 ether;
        uint256 leverageRatio = 2e18;
        OpenLeveragedTroveWithIndexParams memory openTroveParams;
        openTroveParams.leverageZapper = _leverageZapper;
        openTroveParams.collToken = contractsArray[_branch].collToken;
        openTroveParams.index = 2;
        openTroveParams.collAmount = collAmount;
        openTroveParams.leverageRatio = leverageRatio;
        openTroveParams.priceFeed = contractsArray[_branch].priceFeed;
        openTroveParams.exchangeType = _exchangeType;
        openTroveParams.branch = _branch;
        openTroveParams.batchManager = address(0);
        (uint256 troveId,) = openLeveragedTroveWithIndex(openTroveParams);

        // B tries to lever down A’s trove calling Balancer Vault directly
        (uint256 flashLoanAmount, uint256 minBoldDebt) = _getLeverDownFlashLoanAndBoldAmount(
            _leverageZapper,
            troveId,
            1.5e18, // _leverageRatio,
            contractsArray[_branch].troveManager,
            contractsArray[_branch].priceFeed
        );

        ILeverageZapper.LeverDownTroveParams memory params = ILeverageZapper.LeverDownTroveParams({
            troveId: troveId,
            flashLoanAmount: flashLoanAmount,
            minBoldAmount: minBoldDebt
        });
        IFlashLoanProvider flashLoanProvider = _leverageZapper.flashLoanProvider();
        IERC20[] memory tokens = new IERC20[](1);
        tokens[0] = contractsArray[_branch].collToken;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = flashLoanAmount;
        bytes memory userData =
            abi.encode(address(_leverageZapper), IFlashLoanProvider.Operation.LeverDownTrove, params);
        IVault vault = IVault(0xBA12222222228d8Ba445958a75a0704d566BF2C8);
        vm.startPrank(B);
        vm.expectRevert("Flash loan not properly initiated");
        vault.flashLoan(IFlashLoanRecipient(address(flashLoanProvider)), tokens, amounts, userData);
        vm.stopPrank();

        // Check receiver is back to zero
        assertEq(address(flashLoanProvider.receiver()), address(0), "Receiver should be zero");
    }

    // Close trove

    function testCanCloseTroveWithBaseZapper() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testCanCloseTrove(baseZapperArray[i], i);
        }
    }

    function testCanCloseTroveWithLeverageCurve() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testCanCloseTrove(IZapper(leverageZapperCurveArray[i]), i);
        }
    }

    function testCanCloseTroveWithLeverageUniV3() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testCanCloseTrove(IZapper(leverageZapperUniV3Array[i]), i);
        }
    }

    function testCanCloseTroveWithLeverageHybrid() external {
        for (uint256 i = 0; i < 3; i++) {
            _testCanCloseTrove(IZapper(leverageZapperHybridArray[i]), i);
        }
    }

    function _getCloseFlashLoanAmount(uint256 _troveId, ITroveManager _troveManager, IPriceFeed _priceFeed)
        internal
        returns (uint256, uint256)
    {
        (uint256 price,) = _priceFeed.fetchPrice();

        uint256 currentDebt = getTroveEntireDebt(_troveManager, _troveId);
        uint256 currentColl = getTroveEntireColl(_troveManager, _troveId);
        uint256 flashLoanAmount = currentDebt * DECIMAL_PRECISION / price * 105 / 100; // slippage

        return (flashLoanAmount, currentColl - flashLoanAmount);
    }

    function closeTrove(IZapper _zapper, uint256 _troveId, ITroveManager _troveManager, IPriceFeed _priceFeed)
        internal
    {
        // This should be done in the frontend
        (uint256 flashLoanAmount, uint256 minExpectedCollateral) =
            _getCloseFlashLoanAmount(_troveId, _troveManager, _priceFeed);

        vm.startPrank(A);
        _zapper.closeTroveFromCollateral(_troveId, flashLoanAmount, minExpectedCollateral);
        vm.stopPrank();
    }

    function openTrove(
        IZapper _zapper,
        address _account,
        uint256 _index,
        uint256 _collAmount,
        uint256 _boldAmount,
        bool _lst
    ) internal returns (uint256) {
        return openTrove(_zapper, _account, _index, _collAmount, _boldAmount, _lst, MIN_ANNUAL_INTEREST_RATE);
    }

    function openTrove(
        IZapper _zapper,
        address _account,
        uint256 _index,
        uint256 _collAmount,
        uint256 _boldAmount,
        bool _lst,
        uint256 _interestRate
    ) internal returns (uint256) {
        IZapper.OpenTroveParams memory openParams = IZapper.OpenTroveParams({
            owner: _account,
            ownerIndex: _index,
            collAmount: _collAmount,
            boldAmount: _boldAmount,
            upperHint: 0,
            lowerHint: 0,
            annualInterestRate: _interestRate,
            batchManager: address(0),
            maxUpfrontFee: 1000e18,
            addManager: address(0),
            removeManager: address(0),
            receiver: address(0)
        });

        vm.startPrank(_account);
        uint256 value = _lst ? ETH_GAS_COMPENSATION : _collAmount + ETH_GAS_COMPENSATION;
        uint256 troveId = _zapper.openTroveWithRawETH{value: value}(openParams);
        vm.stopPrank();

        return troveId;
    }

    function _testCanCloseTrove(IZapper _zapper, uint256 _branch) internal {
        uint256 collAmount = 10 ether;
        uint256 boldAmount = 10000e18;

        bool lst = _branch > 0;
        uint256 troveId = openTrove(_zapper, A, 0, collAmount, boldAmount, lst);

        // open a 2nd trove so we can close the 1st one
        openTrove(_zapper, B, 0, 100 ether, 10000e18, lst);

        uint256 boldBalanceBefore = boldToken.balanceOf(A);
        uint256 collBalanceBefore = contractsArray[_branch].collToken.balanceOf(A);
        uint256 ethBalanceBefore = A.balance;
        (uint256 price,) = contractsArray[_branch].priceFeed.fetchPrice();
        uint256 debtInColl =
            getTroveEntireDebt(contractsArray[_branch].troveManager, troveId) * DECIMAL_PRECISION / price;

        // Close trove
        closeTrove(_zapper, troveId, contractsArray[_branch].troveManager, contractsArray[_branch].priceFeed);

        assertEq(getTroveEntireColl(contractsArray[_branch].troveManager, troveId), 0, "Coll mismatch");
        assertEq(getTroveEntireDebt(contractsArray[_branch].troveManager, troveId), 0, "Debt mismatch");
        assertGe(boldToken.balanceOf(A), boldBalanceBefore, "BOLD bal should not decrease");
        assertLe(boldToken.balanceOf(A), boldBalanceBefore * 105 / 100, "BOLD bal can only increase by slippage margin");
        if (lst) {
            assertGe(contractsArray[_branch].collToken.balanceOf(A), collBalanceBefore, "Coll bal should not decrease");
            assertApproxEqAbs(
                contractsArray[_branch].collToken.balanceOf(A),
                collBalanceBefore + collAmount - debtInColl,
                3e17,
                "Coll bal mismatch"
            );
            assertEq(A.balance, ethBalanceBefore + ETH_GAS_COMPENSATION, "ETH bal mismatch");
        } else {
            assertEq(contractsArray[_branch].collToken.balanceOf(A), collBalanceBefore, "Coll bal mismatch");
            assertGe(A.balance, ethBalanceBefore, "ETH bal should not decrease");
            assertApproxEqAbs(
                A.balance, ethBalanceBefore + collAmount + ETH_GAS_COMPENSATION - debtInColl, 3e17, "ETH bal mismatch"
            );
        }
    }

    function testCannotCloseTroveWithBaseZapperIfLessCollThanExpected() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testCannotCloseTroveIfLessCollThanExpected(baseZapperArray[i], i);
        }
    }

    function testCannotCloseTroveWithLeverageCurveIfLessCollThanExpected() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testCannotCloseTroveIfLessCollThanExpected(IZapper(leverageZapperCurveArray[i]), i);
        }
    }

    function testCannotCloseTroveWithLeverageUniV3IfLessCollThanExpected() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testCannotCloseTroveIfLessCollThanExpected(IZapper(leverageZapperUniV3Array[i]), i);
        }
    }

    function testCannotCloseTroveWithLeverageHybridIfLessCollThanExpected() external {
        for (uint256 i = 0; i < 3; i++) {
            _testCannotCloseTroveIfLessCollThanExpected(IZapper(leverageZapperHybridArray[i]), i);
        }
    }

    function _testCannotCloseTroveIfLessCollThanExpected(IZapper _zapper, uint256 _branch) internal {
        uint256 collAmount = 10 ether;
        uint256 boldAmount = 10000e18;

        bool lst = _branch > 0;
        uint256 troveId = openTrove(_zapper, A, 0, collAmount, boldAmount, lst);

        // open a 2nd trove so we can close the 1st one
        openTrove(_zapper, B, 0, 100 ether, 10000e18, lst);

        // Try to close trove
        // This should be done in the frontend
        (uint256 flashLoanAmount, uint256 minExpectedCollateral) =
            _getCloseFlashLoanAmount(troveId, contractsArray[_branch].troveManager, contractsArray[_branch].priceFeed);

        string memory revertReason = lst ? "GCZ: Not enough collateral received" : "WZ: Not enough collateral received";
        vm.startPrank(A);
        vm.expectRevert(bytes(revertReason));
        _zapper.closeTroveFromCollateral(troveId, flashLoanAmount, minExpectedCollateral * 2);
        vm.stopPrank();
    }

    function testCannotCloseTroveIfFrontRunByRedemption() external {
        // Make sure redemption rate is not 100%
        vm.warp(block.timestamp + 18 hours);

        IZapper zapper = IZapper(leverageZapperHybridArray[0]);

        uint256 collAmount = 10 ether;
        uint256 boldAmount = 10000e18;

        // open a 2nd trove so we can close the A's one, with higher interest so it doesn't get redeemed
        openTrove(zapper, B, 0, 100 ether, 10000e18, false, 1e17);

        uint256 troveId = openTrove(zapper, A, 0, collAmount, boldAmount, false);

        // Try to close trove
        // This should be done in the frontend
        (uint256 flashLoanAmount, uint256 minExpectedCollateral) =
            _getCloseFlashLoanAmount(troveId, contractsArray[0].troveManager, contractsArray[0].priceFeed);

        // Now attacker redeems from trove and increases Bold price
        vm.startPrank(B);
        // Redemption
        collateralRegistry.redeemCollateral(10000e18, 0, 1e18);
        uint256 troveDebt = getTroveEntireDebt(contractsArray[0].troveManager, troveId);
        uint256 troveColl = getTroveEntireColl(contractsArray[0].troveManager, troveId);
        assertLt(troveDebt, boldAmount, "Trove debt should have decreased");
        assertLt(troveColl, collAmount, "Trove coll should have decreased");

        // Swap WETH to USDC to increase price
        uint256 swapWETHAmount = 10000e18;
        deal(address(WETH), B, swapWETHAmount);
        WETH.approve(address(uniV3Router), swapWETHAmount);
        bytes memory path = abi.encodePacked(WETH, UNIV3_FEE_USDC_WETH, USDC);
        ISwapRouter.ExactInputParams memory params = ISwapRouter.ExactInputParams({
            path: path,
            recipient: B,
            deadline: block.timestamp,
            amountIn: swapWETHAmount,
            amountOutMinimum: 0
        });

        uniV3Router.exactInput(params);
        vm.stopPrank();

        vm.startPrank(A);
        vm.expectRevert("WZ: Not enough collateral received");
        zapper.closeTroveFromCollateral(troveId, flashLoanAmount, minExpectedCollateral);
        vm.stopPrank();
    }

    function testOnlyFlashLoanProviderCanCallCloseTroveCallbackWithBaseZapper() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testOnlyFlashLoanProviderCanCallCloseTroveCallback(baseZapperArray[i], i);
        }
    }

    function testOnlyFlashLoanProviderCanCallCloseTroveCallbackWithCurve() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testOnlyFlashLoanProviderCanCallCloseTroveCallback(leverageZapperCurveArray[i], i);
        }
    }

    function testOnlyFlashLoanProviderCanCallCloseTroveCallbackWithUniV3() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testOnlyFlashLoanProviderCanCallCloseTroveCallback(leverageZapperUniV3Array[i], i);
        }
    }

    function testOnlyFlashLoanProviderCanCallCloseTroveCallbackWithHybrid() external {
        for (uint256 i = 0; i < 3; i++) {
            _testOnlyFlashLoanProviderCanCallCloseTroveCallback(leverageZapperHybridArray[i], i);
        }
    }

    function _testOnlyFlashLoanProviderCanCallCloseTroveCallback(IZapper _zapper, uint256 _branch) internal {
        IZapper.CloseTroveParams memory params = IZapper.CloseTroveParams({
            troveId: addressToTroveIdThroughZapper(address(_zapper), A),
            flashLoanAmount: 10 ether,
            minExpectedCollateral: 0,
            receiver: address(0) // Set later
        });

        bool lst = _branch > 0;
        string memory revertReason = lst ? "GCZ: Caller not FlashLoan provider" : "WZ: Caller not FlashLoan provider";
        vm.startPrank(A);
        vm.expectRevert(bytes(revertReason));
        IFlashLoanReceiver(address(_zapper)).receiveFlashLoanOnCloseTroveFromCollateral(params, 10 ether);
        vm.stopPrank();
    }

    function testOnlyOwnerOrManagerCanCloseTroveWithBaseZapperFromZapper() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testOnlyOwnerOrManagerCanCloseTroveFromZapper(baseZapperArray[i], i);
        }
    }

    function testOnlyOwnerOrManagerCanCloseTroveWithCurveFromZapper() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testOnlyOwnerOrManagerCanCloseTroveFromZapper(leverageZapperCurveArray[i], i);
        }
    }

    function testOnlyOwnerOrManagerCanCloseTroveWithUniV3FromZapper() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testOnlyOwnerOrManagerCanCloseTroveFromZapper(leverageZapperUniV3Array[i], i);
        }
    }

    function testOnlyOwnerOrManagerCanCloseTroveWithHybridFromZapper() external {
        for (uint256 i = 0; i < 3; i++) {
            _testOnlyOwnerOrManagerCanCloseTroveFromZapper(leverageZapperHybridArray[i], i);
        }
    }

    function _testOnlyOwnerOrManagerCanCloseTroveFromZapper(IZapper _zapper, uint256 _branch) internal {
        // Open trove
        uint256 collAmount = 10 ether;
        uint256 boldAmount = 10000e18;

        bool lst = _branch > 0;
        uint256 troveId = openTrove(_zapper, A, 0, collAmount, boldAmount, lst);

        // B tries to close A’s trove
        (uint256 flashLoanAmount, uint256 minExpectedCollateral) =
            _getCloseFlashLoanAmount(troveId, contractsArray[_branch].troveManager, contractsArray[_branch].priceFeed);

        vm.startPrank(B);
        vm.expectRevert(AddRemoveManagers.NotOwnerNorRemoveManager.selector);
        _zapper.closeTroveFromCollateral(troveId, flashLoanAmount, minExpectedCollateral);
        vm.stopPrank();

        // Check receiver is back to zero
        assertEq(address(_zapper.flashLoanProvider().receiver()), address(0), "Receiver should be zero");
    }

    function testOnlyOwnerOrManagerCanCloseTroveWithBaseZapperFromBalancerFLProvider() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testOnlyOwnerOrManagerCanCloseTroveFromBalancerFLProvider(baseZapperArray[i], i);
        }
    }

    function testOnlyOwnerOrManagerCanCloseTroveWithCurveFromBalancerFLProvider() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testOnlyOwnerOrManagerCanCloseTroveFromBalancerFLProvider(leverageZapperCurveArray[i], i);
        }
    }

    function testOnlyOwnerOrManagerCanCloseTroveWithUniV3FromBalancerFLProvider() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testOnlyOwnerOrManagerCanCloseTroveFromBalancerFLProvider(leverageZapperUniV3Array[i], i);
        }
    }

    function testOnlyOwnerOrManagerCanCloseTroveWithHybridFromBalancerFLProvider() external {
        for (uint256 i = 0; i < 3; i++) {
            _testOnlyOwnerOrManagerCanCloseTroveFromBalancerFLProvider(leverageZapperHybridArray[i], i);
        }
    }

    function _testOnlyOwnerOrManagerCanCloseTroveFromBalancerFLProvider(IZapper _zapper, uint256 _branch) internal {
        // Open trove
        uint256 collAmount = 10 ether;
        uint256 boldAmount = 10000e18;

        bool lst = _branch > 0;
        uint256 troveId = openTrove(_zapper, A, 0, collAmount, boldAmount, lst);

        // B tries to close A’s trove calling our flash loan provider module
        (uint256 flashLoanAmount, uint256 minExpectedCollateral) =
            _getCloseFlashLoanAmount(troveId, contractsArray[_branch].troveManager, contractsArray[_branch].priceFeed);

        IZapper.CloseTroveParams memory params = IZapper.CloseTroveParams({
            troveId: troveId,
            flashLoanAmount: flashLoanAmount,
            minExpectedCollateral: minExpectedCollateral,
            receiver: address(0) // Set later
        });
        IFlashLoanProvider flashLoanProvider = _zapper.flashLoanProvider();
        vm.startPrank(B);
        vm.expectRevert(); // reverts without data because it calls back B
        flashLoanProvider.makeFlashLoan(
            contractsArray[_branch].collToken,
            flashLoanAmount,
            IFlashLoanProvider.Operation.CloseTrove,
            abi.encode(params)
        );
        vm.stopPrank();

        // Check receiver is back to zero
        assertEq(address(flashLoanProvider.receiver()), address(0), "Receiver should be zero");
    }

    function testOnlyOwnerOrManagerCanCloseTroveWithBaseZapperFromBalancerVault() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testOnlyOwnerOrManagerCanCloseTroveFromBalancerVault(baseZapperArray[i], i);
        }
    }

    function testOnlyOwnerOrManagerCanCloseTroveWithCurveFromBalancerVault() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testOnlyOwnerOrManagerCanCloseTroveFromBalancerVault(leverageZapperCurveArray[i], i);
        }
    }

    function testOnlyOwnerOrManagerCanCloseTroveWithUniV3FromBalancerVault() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testOnlyOwnerOrManagerCanCloseTroveFromBalancerVault(leverageZapperUniV3Array[i], i);
        }
    }

    function testOnlyOwnerOrManagerCanCloseTroveWithHybridFromBalancerVault() external {
        for (uint256 i = 0; i < 3; i++) {
            _testOnlyOwnerOrManagerCanCloseTroveFromBalancerVault(leverageZapperHybridArray[i], i);
        }
    }

    function _testOnlyOwnerOrManagerCanCloseTroveFromBalancerVault(IZapper _zapper, uint256 _branch) internal {
        // Open trove
        uint256 collAmount = 10 ether;
        uint256 boldAmount = 10000e18;

        bool lst = _branch > 0;
        uint256 troveId = openTrove(_zapper, A, 0, collAmount, boldAmount, lst);

        // B tries to close A’s trove calling Balancer Vault directly
        (uint256 flashLoanAmount, uint256 minExpectedCollateral) =
            _getCloseFlashLoanAmount(troveId, contractsArray[_branch].troveManager, contractsArray[_branch].priceFeed);

        IFlashLoanProvider flashLoanProvider = _zapper.flashLoanProvider();
        IERC20[] memory tokens = new IERC20[](1);
        tokens[0] = contractsArray[_branch].collToken;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = flashLoanAmount;
        bytes memory userData = abi.encode(
            address(_zapper), IFlashLoanProvider.Operation.CloseTrove, troveId, flashLoanAmount, minExpectedCollateral
        );
        IVault vault = IVault(0xBA12222222228d8Ba445958a75a0704d566BF2C8);
        vm.startPrank(B);
        vm.expectRevert("Flash loan not properly initiated");
        vault.flashLoan(IFlashLoanRecipient(address(flashLoanProvider)), tokens, amounts, userData);
        vm.stopPrank();

        // Check receiver is back to zero
        assertEq(address(flashLoanProvider.receiver()), address(0), "Receiver should be zero");
    }

    function testApprovalIsNotReset() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testApprovalIsNotReset(leverageZapperCurveArray[i], ExchangeType.Curve, i);
            _testApprovalIsNotReset(leverageZapperUniV3Array[i], ExchangeType.UniV3, i);
        }
        for (uint256 i = 0; i < 3; i++) {
            _testApprovalIsNotReset(leverageZapperHybridArray[i], ExchangeType.HybridCurveUniV3, i);
        }
    }

    function _testApprovalIsNotReset(ILeverageZapper _leverageZapper, ExchangeType _exchangeType, uint256 _branch)
        internal
    {
        // Open non leveraged trove
        openTrove(_leverageZapper, A, uint256(_exchangeType) * 2, 10 ether, 10000e18, _branch > 0);

        // Now try to open leveraged trove, it should still work
        OpenLeveragedTroveWithIndexParams memory openTroveParams;
        openTroveParams.leverageZapper = _leverageZapper;
        openTroveParams.collToken = contractsArray[_branch].collToken;
        openTroveParams.index = uint256(_exchangeType) * 2 + 1;
        openTroveParams.collAmount = 10 ether;
        openTroveParams.leverageRatio = 1.5 ether;
        openTroveParams.priceFeed = contractsArray[_branch].priceFeed;
        openTroveParams.exchangeType = _exchangeType;
        openTroveParams.branch = _branch;
        openTroveParams.batchManager = address(0);
        (uint256 troveId,) = openLeveragedTroveWithIndex(openTroveParams);

        assertGt(getTroveEntireColl(contractsArray[_branch].troveManager, troveId), 0);
        assertGt(getTroveEntireDebt(contractsArray[_branch].troveManager, troveId), 0);
    }

    // helper price functions

    // Helper to get the actual bold we need, capped by a max value, to get flash loan amount
    function _getBoldAmountToSwap(
        ExchangeType _exchangeType,
        uint256 _branch,
        uint256 _boldAmount,
        uint256 _maxBoldAmount,
        uint256 _minCollAmount,
        IERC20 _collToken
    ) internal returns (uint256) {
        if (_exchangeType == ExchangeType.Curve) {
            return _getBoldAmountToSwapCurve(_branch, _boldAmount, _maxBoldAmount, _minCollAmount);
        }

        if (_exchangeType == ExchangeType.UniV3) {
            return _getBoldAmountToSwapUniV3(_maxBoldAmount, _minCollAmount, _collToken);
        }

        return _getBoldAmountToSwapHybrid(_maxBoldAmount, _minCollAmount, _collToken);
    }

    function _getBoldAmountToSwapCurve(
        uint256 _branch,
        uint256 _boldAmount,
        uint256 _maxBoldAmount,
        uint256 _minCollAmount
    ) internal view returns (uint256) {
        ICurvePool curvePool = CurveExchange(address(leverageZapperCurveArray[_branch].exchange())).curvePool();

        uint256 step = (_maxBoldAmount - _boldAmount) / 5; // In max 5 iterations we should reach the target, unless price is lower
        uint256 dy;
        // TODO: Optimizations: binary search, change the step depending on last dy, ...
        // Or check if there’s any helper implemented anywhere
        uint256 lastBoldAmount = _maxBoldAmount + step;
        do {
            lastBoldAmount -= step;
            dy = curvePool.get_dy(BOLD_TOKEN_INDEX, COLL_TOKEN_INDEX, lastBoldAmount);
        } while (dy > _minCollAmount && lastBoldAmount > step);

        uint256 boldAmountToSwap = dy >= _minCollAmount ? lastBoldAmount : lastBoldAmount + step;
        require(boldAmountToSwap <= _maxBoldAmount, "Bold amount required too high");

        return boldAmountToSwap;
    }

    // See: https://docs.uniswap.org/contracts/v3/reference/periphery/interfaces/IQuoterV2
    // These functions are not marked view because they rely on calling non-view functions and reverting to compute the result.
    // They are also not gas efficient and should not be called on-chain.
    function _getBoldAmountToSwapUniV3(uint256 _maxBoldAmount, uint256 _minCollAmount, IERC20 _collToken)
        internal /* view */
        returns (uint256)
    {
        IQuoterV2.QuoteExactOutputSingleParams memory params = IQuoterV2.QuoteExactOutputSingleParams({
            tokenIn: address(boldToken),
            tokenOut: address(_collToken),
            amount: _minCollAmount,
            fee: UNIV3_FEE,
            sqrtPriceLimitX96: 0
        });
        (uint256 amountIn,,,) = uniV3Quoter.quoteExactOutputSingle(params);
        require(amountIn <= _maxBoldAmount, "Price too high");

        return amountIn;
    }

    function _getBoldAmountToSwapHybrid(uint256 _maxBoldAmount, uint256 _minCollAmount, IERC20 _collToken)
        internal /* view */
        returns (uint256)
    {
        // Uniswap
        uint256 wethAmount;
        IQuoterV2.QuoteExactOutputSingleParams memory quoterParams;
        // Coll <- WETH
        if (address(WETH) != address(_collToken)) {
            quoterParams = IQuoterV2.QuoteExactOutputSingleParams({
                tokenIn: address(WETH),
                tokenOut: address(_collToken),
                amount: _minCollAmount,
                fee: UNIV3_FEE_WETH_COLL,
                sqrtPriceLimitX96: 0
            });
            (wethAmount,,,) = uniV3Quoter.quoteExactOutputSingle(quoterParams);
        } else {
            wethAmount = _minCollAmount;
        }
        // WETH <- USDC
        quoterParams = IQuoterV2.QuoteExactOutputSingleParams({
            tokenIn: address(USDC),
            tokenOut: address(WETH),
            amount: wethAmount,
            fee: UNIV3_FEE_USDC_WETH,
            sqrtPriceLimitX96: 0
        });
        (uint256 usdcAmount,,,) = uniV3Quoter.quoteExactOutputSingle(quoterParams);

        // Curve
        // USDC <- BOLD
        uint256 boldAmountToSwap = usdcCurvePool.get_dx(int128(BOLD_TOKEN_INDEX), int128(USDC_INDEX), usdcAmount);
        require(boldAmountToSwap <= _maxBoldAmount, "Bold amount required too high");

        boldAmountToSwap = Math.min(boldAmountToSwap * 101 / 100, _maxBoldAmount); // TODO

        return boldAmountToSwap;
    }

    // Helpers
    function testHybridExchangeHelpers() public {
        for (uint256 i = 0; i < 3; i++) {
            (uint256 price,) = contractsArray[i].priceFeed.fetchPrice();
            //console2.log(i, "branch");
            //console2.log(price, "price");
            //console2.log(price, "amount");
            _testHybridExchangeHelpers(price, contractsArray[i].collToken, 1 ether, 1e16); // 1% slippage
            //console2.log(price * 1e3, "amount");
            _testHybridExchangeHelpers(price * 1e3, contractsArray[i].collToken, 1 ether, 1e16); // 1% slippage
            //console2.log(price * 1e6, "amount");
            _testHybridExchangeHelpers(price * 1e6, contractsArray[i].collToken, 1 ether, 1e16); // 1% slippage
        }
    }

    function _testHybridExchangeHelpers(
        uint256 _boldAmount,
        IERC20 _collToken,
        uint256 _desiredCollAmount,
        uint256 _acceptedSlippage
    ) internal {
        (uint256 collAmount, uint256 slippage) =
            hybridCurveUniV3ExchangeHelpers.getCollFromBold(_boldAmount, _collToken, _desiredCollAmount);
        //console2.log(collAmount, "collAmount");
        //console2.log(slippage, "slippage");
        assertGe(collAmount, (DECIMAL_PRECISION - slippage) * _desiredCollAmount / DECIMAL_PRECISION);
        assertLe(slippage, _acceptedSlippage);
    }

    function testHybridExchangeHelpersNoDeviation() public {
        (uint256 price,) = contractsArray[0].priceFeed.fetchPrice();
        (uint256 collAmount, uint256 slippage) =
            hybridCurveUniV3ExchangeHelpers.getCollFromBold(price, contractsArray[0].collToken, 0);
        assertGt(collAmount, 0);
        assertEq(slippage, 0);
    }
}
