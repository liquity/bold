pragma solidity ^0.8.18;

import "./TestContracts/DevTestSetup.sol";
import "./TestContracts/WETH.sol";
import "../Zappers/LeverageLSTZapper.sol";
import "../Zappers/Modules/FlashLoans/BalancerFlashLoan.sol";
import "../Zappers/Modules/Exchanges/Curve/ICurveFactory.sol";
import "../Zappers/Modules/Exchanges/Curve/ICurvePool.sol";
import "../Zappers/Modules/Exchanges/CurveExchange.sol";
import "../Zappers/Modules/Exchanges/UniswapV3/ISwapRouter.sol";
import "../Zappers/Modules/Exchanges/UniswapV3/IQuoterV2.sol";
import "../Zappers/Modules/Exchanges/UniswapV3/IUniswapV3Pool.sol";
import "./TestContracts/Interfaces/INonfungiblePositionManager.sol";
import "../Zappers/Modules/Exchanges/UniV3Exchange.sol";

contract ZapperLeverageLSTMainnet is DevTestSetup {
    ICurveFactory constant curveFactory = ICurveFactory(0x98EE851a00abeE0d95D08cF4CA2BdCE32aeaAF7F);
    ISwapRouter constant uniV3Router = ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);
    IQuoterV2 constant uniV3Quoter = IQuoterV2(0x61fFE014bA17989E743c5F6cB21bF9697530B21e);
    INonfungiblePositionManager constant uniV3PositionManager = INonfungiblePositionManager(0xC36442b4a4522E871399CD717aBDD847Ab11FE88);
    uint24 constant UNIV3_FEE = 3000; // 0.3%

    LeverageLSTZapper leverageZapperCurve;
    LeverageLSTZapper leverageZapperUniV3;
    IExchange curveExchange;
    IExchange uniV3Exchange;

    uint256 constant NUM_COLLATERALS = 5;
    TestDeployer.LiquityContracts[] contractsArray;

    function setUp() public override {
        vm.createSelectFork(vm.rpcUrl("mainnet"));

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

        WETH = new WETH9();

        TestDeployer.TroveManagerParams[] memory troveManagerParamsArray = new TestDeployer.TroveManagerParams[](NUM_COLLATERALS);
        troveManagerParamsArray[0] = TestDeployer.TroveManagerParams(150e16, 110e16, 110e16, 5e16, 10e16);
        troveManagerParamsArray[1] = TestDeployer.TroveManagerParams(160e16, 120e16, 120e16, 5e16, 10e16);
        troveManagerParamsArray[2] = TestDeployer.TroveManagerParams(160e16, 120e16, 120e16, 5e16, 10e16);
        troveManagerParamsArray[3] = TestDeployer.TroveManagerParams(160e16, 120e16, 120e16, 5e16, 10e16);
        troveManagerParamsArray[4] = TestDeployer.TroveManagerParams(160e16, 120e16, 120e16, 5e16, 10e16);

        TestDeployer deployer = new TestDeployer();
        TestDeployer.DeploymentResultMainnet memory result = deployer.deployAndConnectContractsMainnet(troveManagerParamsArray);
        //collateralRegistry = result.collateralRegistry;
        boldToken = result.boldToken;
        // Record contracts
        for (uint256 c = 0; c < NUM_COLLATERALS; c++) {
            contractsArray.push(result.contractsArray[c]);
        }

        // Set first branch as default
        addressesRegistry = contractsArray[1].addressesRegistry;
        borrowerOperations = IBorrowerOperationsTester(address(contractsArray[1].borrowerOperations));
        troveManager = ITroveManagerTester(address(contractsArray[1].troveManager));
        troveNFT = contractsArray[1].troveNFT;
        collToken = contractsArray[1].collToken;
        priceFeed = IPriceFeedTestnet(address(contractsArray[1].priceFeed));

        // Deploy zapper (TODO: should we move it to deployment.sol?)
        BalancerFlashLoan flashLoanProvider = new BalancerFlashLoan();

        // Curve version
        // Bootstrap Curve pools
        ICurvePool[] memory curvePools;
        curvePools = deployCurveV2Pools(result.contractsArray);
        curveExchange = new CurveExchange(collToken, boldToken, curvePools[1], 1, 0);
        leverageZapperCurve = new LeverageLSTZapper(addressesRegistry, flashLoanProvider, curveExchange);
        // Uni V3 version
        uniV3Exchange = new UniV3Exchange(collToken, boldToken, UNIV3_FEE, uniV3Router, uniV3Quoter);
        leverageZapperUniV3 = new LeverageLSTZapper(addressesRegistry, flashLoanProvider, uniV3Exchange);
        // Bootstrap UniV3 pools
        deployUniV3Pools(result.contractsArray);

        // Give some Collateral to test accounts
        uint256 initialCollateralAmount = 10_000e18;

        // A to F
        for (uint256 i = 0; i < 6; i++) {
            // Give some raw ETH to test accounts
            deal(accountsList[i], initialCollateralAmount);
            // Give and approve some coll token to test accounts
            deal(address(collToken), accountsList[i], initialCollateralAmount);
            vm.startPrank(accountsList[i]);
            collToken.approve(address(leverageZapperCurve), initialCollateralAmount);
            collToken.approve(address(leverageZapperUniV3), initialCollateralAmount);
            vm.stopPrank();
        }
    }

    function deployCurveV2Pools(TestDeployer.LiquityContracts[] memory _contractsArray) internal returns (ICurvePool[] memory curvePools) {
        curvePools = new ICurvePool[](NUM_COLLATERALS);

        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            uint256 price = _contractsArray[i].priceFeed.fetchPrice();

            // deploy Curve Twocrypto NG pool
            address[2] memory coins;
            coins[0] = address(boldToken);
            coins[1] = address(_contractsArray[i].collToken);
            curvePools[i] = curveFactory.deploy_pool(
                "LST-Bold pool",
                "LBLD",
                coins,
                0, // implementation id
                400000, // A
                145000000000000, // gamma
                26000000, // mid_fee
                45000000, // out_fee
                230000000000000, // fee_gamma
                2000000000000, // allowed_extra_profit
                146000000000000, // adjustment_step
                600, // ma_exp_time
                price // initial_price
            );

            // Add liquidity
            uint256 collAmount = 1000 ether;
            uint256 boldAmount = collAmount * price / DECIMAL_PRECISION;
            deal(address(_contractsArray[i].collToken), A, collAmount);
            deal(address(boldToken), A, boldAmount);
            vm.startPrank(A);
            // approve
            _contractsArray[i].collToken.approve(address(curvePools[i]), collAmount);
            boldToken.approve(address(curvePools[i]), boldAmount);
            uint256[2] memory amounts;
            amounts[0] = boldAmount;
            amounts[1] = collAmount;
            curvePools[i].add_liquidity(amounts, 0);
            vm.stopPrank();
        }
    }

    function deployUniV3Pools(TestDeployer.LiquityContracts[] memory _contractsArray) internal {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            uint256 price = _contractsArray[i].priceFeed.fetchPrice();
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

            // Create Uni V3 pool
            address uniV3PoolAddress = uniV3PositionManager.createAndInitializePoolIfNecessary(
                tokens[0], // token0,
                tokens[1], // token1,
                UNIV3_FEE, // fee,
                UniV3Exchange(address(uniV3Exchange)).priceToSqrtPrice(boldToken, _contractsArray[i].collToken, price) // sqrtPriceX96
            );
            //console2.log(uniV3PoolAddress, "uniV3PoolAddress");

            // Add liquidity

            vm.startPrank(A);

            // deal and approve
            deal(address(_contractsArray[i].collToken), A, collAmount);
            deal(address(boldToken), A, boldAmount);
            _contractsArray[i].collToken.approve(address(uniV3PositionManager), collAmount);
            boldToken.approve(address(uniV3PositionManager), boldAmount);

            // mint new position
            int24 TICK_SPACING = IUniswapV3Pool(uniV3PoolAddress).tickSpacing();
            (, int24 tick, ,,,,) = IUniswapV3Pool(uniV3PoolAddress).slot0();
            int24 tickLower = (tick - 6000) / TICK_SPACING * TICK_SPACING;
            int24 tickUpper = (tick + 6000) / TICK_SPACING * TICK_SPACING;
            INonfungiblePositionManager.MintParams memory params =
                INonfungiblePositionManager.MintParams({
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
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    /*
    function openLeveragedTroveWithCurve(uint256 _collAmount, uint256 _leverageRatio) internal returns (uint256) {
        return openLeveragedTrove(leverageZapperCurve, curveExchange, _collAmount, _leverageRatio);
    }

    function openLeveragedTroveWithUniV3(uint256 _collAmount, uint256 _leverageRatio) internal returns (uint256) {
        return openLeveragedTrove(leverageZapperUniV3, curveExchange, _collAmount, _leverageRatio);
    }
    */

    function openLeveragedTrove(ILeverageZapper _leverageZapper, IExchange _exchange, uint256 _collAmount, uint256 _leverageRatio) internal returns (uint256) {
        uint256 price = priceFeed.fetchPrice();

        // This should be done in the frontend
        uint256 flashLoanAmount = _collAmount * (_leverageRatio - DECIMAL_PRECISION) / DECIMAL_PRECISION;
        uint256 expectedBoldAmount = flashLoanAmount * price / DECIMAL_PRECISION;
        uint256 maxNetDebt = expectedBoldAmount * 105 / 100; // slippage
        uint256 effectiveBoldAmount = _exchange.getBoldAmountToSwap(expectedBoldAmount, maxNetDebt, flashLoanAmount);

        ILeverageZapper.OpenLeveragedTroveParams memory params = ILeverageZapper.OpenLeveragedTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: _collAmount,
            flashLoanAmount: flashLoanAmount,
            boldAmount: effectiveBoldAmount,
            upperHint: 0,
            lowerHint: 0,
            annualInterestRate: 5e16,
            maxUpfrontFee: 1000e18,
            addManager: address(0),
            removeManager: address(0),
            receiver: address(0)
        });
        vm.startPrank(A);
        _leverageZapper.openLeveragedTroveWithRawETH{value: ETH_GAS_COMPENSATION}(params);
        uint256 troveId = addressToTroveId(A);
        vm.stopPrank();

        return troveId;
    }

    function testCanOpenTroveWithCurve() external {
        _testCanOpenTrove(leverageZapperCurve, curveExchange);
    }

    function testCanOpenTroveWithUniV3() external {
        //deployUniV3Pools(contractsArray);
        _testCanOpenTrove(leverageZapperUniV3, uniV3Exchange);
    }

    function _testCanOpenTrove(ILeverageZapper _leverageZapper, IExchange _exchange) internal {
        uint256 collAmount = 10 ether;
        uint256 leverageRatio = 2e18;
        uint256 resultingCollateralRatio = _leverageZapper.leverageRatioToCollateralRatio(leverageRatio);

        uint256 ethBalanceBefore = A.balance;
        uint256 collBalanceBefore = collToken.balanceOf(A);

        uint256 troveId = openLeveragedTrove(_leverageZapper, _exchange, collAmount, leverageRatio);

        // Checks
        uint256 price = priceFeed.fetchPrice();
        // owner
        assertEq(troveNFT.ownerOf(troveId), A, "Wrong owner");
        // troveId
        assertGt(troveId, 0, "Trove id should be set");
        // coll
        assertEq(getTroveEntireColl(troveId), collAmount * leverageRatio / DECIMAL_PRECISION, "Coll mismatch");
        // debt
        uint256 expectedMinNetDebt = collAmount
            * (leverageRatio - DECIMAL_PRECISION) / DECIMAL_PRECISION // * leverage ratio
            * price / DECIMAL_PRECISION; // price
        uint256 expectedMaxNetDebt = expectedMinNetDebt * 105 / 100;
        assertGe(getTroveEntireDebt(troveId), expectedMinNetDebt, "Debt too low");
        assertLe(getTroveEntireDebt(troveId), expectedMaxNetDebt, "Debt too high");
        // CR
        assertApproxEqAbs(troveManager.getCurrentICR(troveId, price), resultingCollateralRatio, 3e16, "Wrong CR");
        // token balances
        assertApproxEqAbs(boldToken.balanceOf(A), 0, 15, "BOLD bal mismatch");
        assertEq(A.balance, ethBalanceBefore - ETH_GAS_COMPENSATION, "ETH bal mismatch");
        assertEq(collToken.balanceOf(A), collBalanceBefore - collAmount, "Coll bal mismatch");
    }

    function testOnlyFlashLoanProviderCanCallOpenTroveCallbackWithCurve() external {
        _testOnlyFlashLoanProviderCanCallOpenTroveCallback(leverageZapperCurve);
    }

    function testOnlyFlashLoanProviderCanCallOpenTroveCallbackWithUni() external {
        _testOnlyFlashLoanProviderCanCallOpenTroveCallback(leverageZapperUniV3);
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
            maxUpfrontFee: 1000e18,
            addManager: address(0),
            removeManager: address(0),
            receiver: address(0)
            });
        vm.startPrank(A);
        vm.expectRevert("LZ: Caller not FlashLoan provider");
        IFlashLoanReceiver(address(_leverageZapper)).receiveFlashLoanOnOpenLeveragedTrove(params, 10 ether);
        vm.stopPrank();
    }

    // Lever up
    /*
    function leverUpTroveWithCurve(uint256 _troveId, uint256 _leverageRatio) internal returns (uint256) {
        return leverUpTrove(leverageZapperCurve, curveExchange, _troveId, _leverageRatio);
    }

    function leverUpTroveWithUniV3(uint256 _troveId, uint256 _leverageRatio) internal returns (uint256) {
        return leverUpTrove(leverageZapperUniV3, uniV3Exchange, _troveId, _leverageRatio);
    }
    */

    function leverUpTrove(ILeverageZapper _leverageZapper, IExchange _exchange, uint256 _troveId, uint256 _leverageRatio) internal returns (uint256) {
        uint256 price = priceFeed.fetchPrice();

        // This should be done in the frontend
        uint256 currentCR = troveManager.getCurrentICR(_troveId, price);
        uint256 currentLR = _leverageZapper.leverageRatioToCollateralRatio(currentCR);
        assertGt(_leverageRatio, currentLR, "Leverage ratio should increase");
        uint256 currentCollAmount = getTroveEntireColl(_troveId);
        uint256 flashLoanAmount = currentCollAmount * _leverageRatio / currentLR - currentCollAmount;
        uint256 expectedBoldAmount = flashLoanAmount * price / DECIMAL_PRECISION;
        uint256 maxNetDebtIncrease = expectedBoldAmount * 105 / 100; // slippage
        // The actual bold we need, capped by the slippage above, to get flash loan amount
        uint256 effectiveBoldAmount = _exchange.getBoldAmountToSwap(expectedBoldAmount, maxNetDebtIncrease, flashLoanAmount);

        ILeverageZapper.LeverUpTroveParams memory params = ILeverageZapper.LeverUpTroveParams({
            troveId: _troveId,
            flashLoanAmount: flashLoanAmount,
            boldAmount: effectiveBoldAmount,
            maxUpfrontFee: 1000e18
        });
        vm.startPrank(A);
        _leverageZapper.leverUpTrove(params);
        vm.stopPrank();

        return flashLoanAmount;
    }

    function testCanLeverUpTroveWithCurve() external {
        _testCanLeverUpTrove(leverageZapperCurve, curveExchange);
    }

    function testCanLeverUpTroveWithUniV3() external {
        _testCanLeverUpTrove(leverageZapperUniV3, uniV3Exchange);
    }

    function _testCanLeverUpTrove(ILeverageZapper _leverageZapper, IExchange _exchange) internal {
        uint256 collAmount = 10 ether;
        uint256 initialLeverageRatio = 2e18;

        uint256 troveId = openLeveragedTrove(_leverageZapper, _exchange, collAmount, initialLeverageRatio);
        uint256 initialDebt = getTroveEntireDebt(troveId);

        uint256 newLeverageRatio = 2.5e18;
        uint256 resultingCollateralRatio = _leverageZapper.leverageRatioToCollateralRatio(newLeverageRatio);

        uint256 ethBalanceBefore = A.balance;
        uint256 collBalanceBefore = collToken.balanceOf(A);

        uint256 flashLoanAmount = leverUpTrove(_leverageZapper, _exchange, troveId, newLeverageRatio);

        // Checks
        uint256 price = priceFeed.fetchPrice();
        // coll
        assertApproxEqAbs(getTroveEntireColl(troveId), collAmount * newLeverageRatio / DECIMAL_PRECISION, 3e17, "Coll mismatch");
        // debt
        uint256 expectedMinNetDebt = initialDebt + flashLoanAmount * price / DECIMAL_PRECISION;
        uint256 expectedMaxNetDebt = expectedMinNetDebt * 105 / 100;
        assertGe(getTroveEntireDebt(troveId), expectedMinNetDebt, "Debt too low");
        assertLe(getTroveEntireDebt(troveId), expectedMaxNetDebt, "Debt too high");
        // CR
        assertApproxEqAbs(troveManager.getCurrentICR(troveId, price), resultingCollateralRatio, 2e16, "Wrong CR");
        // token balances
        assertApproxEqAbs(boldToken.balanceOf(A), 0, 10, "BOLD bal mismatch");
        assertEq(A.balance, ethBalanceBefore, "ETH bal mismatch");
        assertEq(collToken.balanceOf(A), collBalanceBefore, "Coll bal mismatch");
    }

    function testOnlyFlashLoanProviderCanCallLeverUpCallbackWithCurve() external {
        _testOnlyFlashLoanProviderCanCallLeverUpCallback(leverageZapperCurve);
    }

    function testOnlyFlashLoanProviderCanCallLeverUpCallbackWithUni() external {
        _testOnlyFlashLoanProviderCanCallLeverUpCallback(leverageZapperUniV3);
    }

    function _testOnlyFlashLoanProviderCanCallLeverUpCallback(ILeverageZapper _leverageZapper) internal {
        ILeverageZapper.LeverUpTroveParams memory params = ILeverageZapper.LeverUpTroveParams({
            troveId: addressToTroveId(A),
            flashLoanAmount: 10 ether,
            boldAmount: 10000e18,
            maxUpfrontFee: 1000e18
        });
        vm.startPrank(A);
        vm.expectRevert("LZ: Caller not FlashLoan provider");
        IFlashLoanReceiver(address(_leverageZapper)).receiveFlashLoanOnLeverUpTrove(params, 10 ether);
        vm.stopPrank();
    }

    // Lever down
    /*
    function leverDownTroveWithCurve(uint256 _troveId, uint256 _leverageRatio) internal returns (uint256) {
        return leverDownTrove(leverageZapperCurve, _troveId, _leverageRatio);
    }

    function leverDownTroveWithUniV3(uint256 _troveId, uint256 _leverageRatio) internal returns (uint256) {
        return leverDownTrove(leverageZapperUniV3, _troveId, _leverageRatio);
    }
    */

    function leverDownTrove(ILeverageZapper _leverageZapper, uint256 _troveId, uint256 _leverageRatio) internal returns (uint256) {
        uint256 price = priceFeed.fetchPrice();

        // This should be done in the frontend
        uint256 currentCR = troveManager.getCurrentICR(_troveId, price);
        uint256 currentLR = _leverageZapper.leverageRatioToCollateralRatio(currentCR);
        assertLt(_leverageRatio, currentLR, "Leverage ratio should decrease");
        uint256 currentCollAmount = getTroveEntireColl(_troveId);
        uint256 flashLoanAmount = currentCollAmount - currentCollAmount * _leverageRatio / currentLR;
        uint256 expectedBoldAmount = flashLoanAmount * price / DECIMAL_PRECISION;
        uint256 minBoldDebt = expectedBoldAmount * 95 / 100; // slippage

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
        _testCanLeverDownTrove(leverageZapperCurve, curveExchange);
    }

    function testCanLeverDownTroveWithUniV3() external {
        _testCanLeverDownTrove(leverageZapperUniV3, uniV3Exchange);
    }

    function _testCanLeverDownTrove(ILeverageZapper _leverageZapper, IExchange _exchange) internal {
        uint256 collAmount = 10 ether;
        uint256 initialLeverageRatio = 2e18;

        uint256 troveId = openLeveragedTrove(_leverageZapper, _exchange, collAmount, initialLeverageRatio);
        uint256 initialDebt = getTroveEntireDebt(troveId);

        uint256 newLeverageRatio = 1.5e18;
        uint256 resultingCollateralRatio = _leverageZapper.leverageRatioToCollateralRatio(newLeverageRatio);

        uint256 ethBalanceBefore = A.balance;
        uint256 collBalanceBefore = collToken.balanceOf(A);

        uint256 flashLoanAmount = leverDownTrove(_leverageZapper, troveId, newLeverageRatio);

        // Checks
        uint256 price = priceFeed.fetchPrice();
        // coll
        assertApproxEqAbs(getTroveEntireColl(troveId), collAmount * newLeverageRatio / DECIMAL_PRECISION, 22e16, "Coll mismatch");
        // debt
        uint256 expectedMinNetDebt = initialDebt - flashLoanAmount * price / DECIMAL_PRECISION * 101 / 100;
        uint256 expectedMaxNetDebt = expectedMinNetDebt * 105 / 100;
        assertGe(getTroveEntireDebt(troveId), expectedMinNetDebt, "Debt too low");
        assertLe(getTroveEntireDebt(troveId), expectedMaxNetDebt, "Debt too high");
        // CR
        assertApproxEqAbs(troveManager.getCurrentICR(troveId, price), resultingCollateralRatio, 3e15, "Wrong CR");
        // token balances
        assertApproxEqAbs(boldToken.balanceOf(A), 0, 15, "BOLD bal mismatch");
        assertEq(A.balance, ethBalanceBefore, "ETH bal mismatch");
        assertEq(collToken.balanceOf(A), collBalanceBefore, "Coll bal mismatch");
    }

    function testOnlyFlashLoanProviderCanCallLeverDownCallbackWithCurve() external {
        _testOnlyFlashLoanProviderCanCallLeverDownCallback(leverageZapperCurve);
    }

    /*
      function testOnlyFlashLoanProviderCanCallLeverDownCallbackWithUni() external {
      _testOnlyFlashLoanProviderCanCallLeverDownCallback(leverageZapperUniV3);
      }
    */

    function _testOnlyFlashLoanProviderCanCallLeverDownCallback(ILeverageZapper _leverageZapper) internal {
        ILeverageZapper.LeverDownTroveParams memory params = ILeverageZapper.LeverDownTroveParams({
            troveId: addressToTroveId(A),
            flashLoanAmount: 10 ether,
            minBoldAmount: 10000e18
        });
        vm.startPrank(A);
        vm.expectRevert("LZ: Caller not FlashLoan provider");
        IFlashLoanReceiver(address(_leverageZapper)).receiveFlashLoanOnLeverDownTrove(params, 10 ether);
        vm.stopPrank();
    }
}
