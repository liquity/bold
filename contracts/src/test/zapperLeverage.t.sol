// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import "./TestContracts/DevTestSetup.sol";
import "./TestContracts/WETH.sol";
import "../Zappers/LeverageLSTZapper.sol";
import "../Zappers/Modules/Exchanges/Curve/ICurvePool.sol";
import "../Zappers/Modules/Exchanges/CurveExchange.sol";
import "../Zappers/Modules/Exchanges/UniswapV3/IUniswapV3Pool.sol";
import "../Zappers/Modules/Exchanges/UniV3Exchange.sol";
import "../Zappers/Modules/Exchanges/UniswapV3/INonfungiblePositionManager.sol";
import "../Zappers/Modules/Exchanges/UniswapV3/IUniswapV3Factory.sol";
import "./Utils/UniPriceConverter.sol";

contract ZapperLeverageLSTMainnet is DevTestSetup {
    using StringFormatting for uint256;

    INonfungiblePositionManager constant uniV3PositionManager =
        INonfungiblePositionManager(0xC36442b4a4522E871399CD717aBDD847Ab11FE88);
    IUniswapV3Factory constant uniswapV3Factory = IUniswapV3Factory(0x1F98431c8aD98523631AE4a59f267346ea31F984);
    uint24 constant UNIV3_FEE = 3000; // 0.3%

    uint256 constant NUM_COLLATERALS = 5;

    ILeverageZapper[] leverageZapperCurveArray;
    ILeverageZapper[] leverageZapperUniV3Array;

    TestDeployer.LiquityContracts[] contractsArray;

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
        uint256 ethBalanceBefore;
        uint256 collBalanceBefore;
        uint256 flashLoanAmount;
        uint256 price;
    }

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

        TestDeployer.TroveManagerParams[] memory troveManagerParamsArray =
            new TestDeployer.TroveManagerParams[](NUM_COLLATERALS);
        troveManagerParamsArray[0] = TestDeployer.TroveManagerParams(150e16, 110e16, 110e16, 5e16, 10e16);
        for (uint256 c = 0; c < NUM_COLLATERALS; c++) {
            troveManagerParamsArray[c] = TestDeployer.TroveManagerParams(160e16, 120e16, 120e16, 5e16, 10e16);
        }

        TestDeployer deployer = new TestDeployer();
        TestDeployer.DeploymentResultMainnet memory result =
            deployer.deployAndConnectContractsMainnet(troveManagerParamsArray);
        //collateralRegistry = result.collateralRegistry;
        boldToken = result.boldToken;
        // Record contracts
        for (uint256 c = 0; c < NUM_COLLATERALS; c++) {
            contractsArray.push(result.contractsArray[c]);
            leverageZapperCurveArray.push(result.zappersArray[c].leverageZapperCurve);
            leverageZapperUniV3Array.push(result.zappersArray[c].leverageZapperUniV3);
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
                contractsArray[c].collToken.approve(address(leverageZapperCurveArray[c]), initialCollateralAmount);
                contractsArray[c].collToken.approve(address(leverageZapperUniV3Array[c]), initialCollateralAmount);
                vm.stopPrank();
            }
        }
    }

    function fundCurveV2Pools(
        TestDeployer.LiquityContracts[] memory _contractsArray,
        TestDeployer.Zappers[] memory _zappersArray
    ) internal {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            (uint256 price, ) = _contractsArray[i].priceFeed.fetchPrice();
            ICurvePool curvePool = CurveExchange(address(_zappersArray[i].leverageZapperCurve.exchange())).curvePool();

            // Add liquidity
            uint256 collAmount = 1000 ether;
            uint256 boldAmount = collAmount * price / DECIMAL_PRECISION;
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
    }

    function fundUniV3Pools(TestDeployer.LiquityContracts[] memory _contractsArray) internal {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            (uint256 price, ) = _contractsArray[i].priceFeed.fetchPrice();
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

    function openLeveragedTrove(
        ILeverageZapper _leverageZapper,
        uint256 _collAmount,
        uint256 _leverageRatio,
        IPriceFeed _priceFeed,
        bool _lst
    ) internal returns (uint256) {
        (uint256 price, ) = _priceFeed.fetchPrice();
        IExchange exchange = _leverageZapper.exchange();

        // This should be done in the frontend
        uint256 flashLoanAmount = _collAmount * (_leverageRatio - DECIMAL_PRECISION) / DECIMAL_PRECISION;
        uint256 expectedBoldAmount = flashLoanAmount * price / DECIMAL_PRECISION;
        uint256 maxNetDebt = expectedBoldAmount * 105 / 100; // slippage
        uint256 effectiveBoldAmount = exchange.getBoldAmountToSwap(expectedBoldAmount, maxNetDebt, flashLoanAmount);

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
        uint256 value = _lst ? ETH_GAS_COMPENSATION : _collAmount + ETH_GAS_COMPENSATION;
        _leverageZapper.openLeveragedTroveWithRawETH{value: value}(params);
        uint256 troveId = addressToTroveId(A);
        vm.stopPrank();

        return troveId;
    }

    function testCanOpenTroveWithCurve() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testCanOpenTrove(leverageZapperCurveArray[i], i);
        }
    }

    function testCanOpenTroveWithUniV3() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            if (i == 2) continue; // TODO!!
            _testCanOpenTrove(leverageZapperUniV3Array[i], i);
        }
    }

    function _testCanOpenTrove(ILeverageZapper _leverageZapper, uint256 _branch) internal {
        uint256 collAmount = 10 ether;
        uint256 leverageRatio = 2e18;
        uint256 resultingCollateralRatio = _leverageZapper.leverageRatioToCollateralRatio(leverageRatio);

        uint256 ethBalanceBefore = A.balance;
        uint256 collBalanceBefore = contractsArray[_branch].collToken.balanceOf(A);

        bool lst = _branch > 0;
        uint256 troveId =
            openLeveragedTrove(_leverageZapper, collAmount, leverageRatio, contractsArray[_branch].priceFeed, lst);

        // Checks
        (uint256 price, ) = contractsArray[_branch].priceFeed.fetchPrice();
        // owner
        assertEq(contractsArray[_branch].troveNFT.ownerOf(troveId), A, "Wrong owner");
        // troveId
        assertGt(troveId, 0, "Trove id should be set");
        // coll
        assertEq(
            getTroveEntireColl(contractsArray[_branch].troveManager, troveId),
            collAmount * leverageRatio / DECIMAL_PRECISION,
            "Coll mismatch"
        );
        // debt
        uint256 expectedMinNetDebt = collAmount * (leverageRatio - DECIMAL_PRECISION) / DECIMAL_PRECISION // * leverage ratio
            * price / DECIMAL_PRECISION; // price
        uint256 expectedMaxNetDebt = expectedMinNetDebt * 105 / 100;
        uint256 troveEntireDebt = getTroveEntireDebt(contractsArray[_branch].troveManager, troveId);
        assertGe(troveEntireDebt, expectedMinNetDebt, "Debt too low");
        assertLe(troveEntireDebt, expectedMaxNetDebt, "Debt too high");
        // CR
        assertApproxEqAbs(
            contractsArray[_branch].troveManager.getCurrentICR(troveId, price),
            resultingCollateralRatio,
            3e16,
            "Wrong CR"
        );
        // token balances
        assertApproxEqAbs(boldToken.balanceOf(A), 0, 15, "BOLD bal mismatch");
        if (lst) {
            assertEq(A.balance, ethBalanceBefore - ETH_GAS_COMPENSATION, "ETH bal mismatch");
            assertEq(
                contractsArray[_branch].collToken.balanceOf(A), collBalanceBefore - collAmount, "Coll bal mismatch"
            );
        } else {
            assertEq(A.balance, ethBalanceBefore - ETH_GAS_COMPENSATION - collAmount, "ETH bal mismatch");
            assertEq(contractsArray[_branch].collToken.balanceOf(A), collBalanceBefore, "Coll bal mismatch");
        }
    }

    function testOnlyFlashLoanProviderCanCallOpenTroveCallbackWithCurve() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testOnlyFlashLoanProviderCanCallOpenTroveCallback(leverageZapperCurveArray[i]);
        }
    }

    function testOnlyFlashLoanProviderCanCallOpenTroveCallbackWithUni() external {
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
        return leverUpTrove(leverageZapperCurve, _troveId, _leverageRatio);
    }

    function leverUpTroveWithUniV3(uint256 _troveId, uint256 _leverageRatio) internal returns (uint256) {
        return leverUpTrove(leverageZapperUniV3, _troveId, _leverageRatio);
    }
    */

    function leverUpTrove(
        ILeverageZapper _leverageZapper,
        uint256 _troveId,
        uint256 _leverageRatio,
        ITroveManager _troveManager,
        IPriceFeed _priceFeed
    ) internal returns (uint256) {
        LeverVars memory vars;
        (vars.price, ) = _priceFeed.fetchPrice();
        IExchange exchange = _leverageZapper.exchange();

        // This should be done in the frontend
        vars.currentCR = _troveManager.getCurrentICR(_troveId, vars.price);
        vars.currentLR = _leverageZapper.leverageRatioToCollateralRatio(vars.currentCR);
        assertGt(_leverageRatio, vars.currentLR, "Leverage ratio should increase");
        vars.currentCollAmount = getTroveEntireColl(_troveManager, _troveId);
        vars.flashLoanAmount = vars.currentCollAmount * _leverageRatio / vars.currentLR - vars.currentCollAmount;
        vars.expectedBoldAmount = vars.flashLoanAmount * vars.price / DECIMAL_PRECISION;
        vars.maxNetDebtIncrease = vars.expectedBoldAmount * 105 / 100; // slippage
        // The actual bold we need, capped by the slippage above, to get flash loan amount
        vars.effectiveBoldAmount =
            exchange.getBoldAmountToSwap(vars.expectedBoldAmount, vars.maxNetDebtIncrease, vars.flashLoanAmount);

        ILeverageZapper.LeverUpTroveParams memory params = ILeverageZapper.LeverUpTroveParams({
            troveId: _troveId,
            flashLoanAmount: vars.flashLoanAmount,
            boldAmount: vars.effectiveBoldAmount,
            maxUpfrontFee: 1000e18
        });
        vm.startPrank(A);
        _leverageZapper.leverUpTrove(params);
        vm.stopPrank();

        return vars.flashLoanAmount;
    }

    function testCanLeverUpTroveWithCurve() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testCanLeverUpTrove(leverageZapperCurveArray[i], i);
        }
    }

    function testCanLeverUpTroveWithUniV3() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            if (i == 2) continue; // TODO!!
            _testCanLeverUpTrove(leverageZapperUniV3Array[i], i);
        }
    }

    function _testCanLeverUpTrove(ILeverageZapper _leverageZapper, uint256 _branch) internal {
        TestVars memory vars;
        vars.collAmount = 10 ether;
        vars.initialLeverageRatio = 2e18;

        vars.troveId = openLeveragedTrove(
            _leverageZapper, vars.collAmount, vars.initialLeverageRatio, contractsArray[_branch].priceFeed, _branch > 0
        );
        vars.initialDebt = getTroveEntireDebt(contractsArray[_branch].troveManager, vars.troveId);

        vars.newLeverageRatio = 2.5e18;
        vars.resultingCollateralRatio = _leverageZapper.leverageRatioToCollateralRatio(vars.newLeverageRatio);

        vars.ethBalanceBefore = A.balance;
        vars.collBalanceBefore = contractsArray[_branch].collToken.balanceOf(A);

        vars.flashLoanAmount = leverUpTrove(
            _leverageZapper,
            vars.troveId,
            vars.newLeverageRatio,
            contractsArray[_branch].troveManager,
            contractsArray[_branch].priceFeed
        );

        // Checks
        (vars.price, ) = contractsArray[_branch].priceFeed.fetchPrice();
        // coll
        assertApproxEqAbs(
            getTroveEntireColl(contractsArray[_branch].troveManager, vars.troveId),
            vars.collAmount * vars.newLeverageRatio / DECIMAL_PRECISION,
            3e17,
            "Coll mismatch"
        );
        // debt
        uint256 expectedMinNetDebt = vars.initialDebt + vars.flashLoanAmount * vars.price / DECIMAL_PRECISION;
        uint256 expectedMaxNetDebt = expectedMinNetDebt * 105 / 100;
        uint256 troveEntireDebt = getTroveEntireDebt(contractsArray[_branch].troveManager, vars.troveId);
        assertGe(troveEntireDebt, expectedMinNetDebt, "Debt too low");
        assertLe(troveEntireDebt, expectedMaxNetDebt, "Debt too high");
        // CR
        assertApproxEqAbs(
            contractsArray[_branch].troveManager.getCurrentICR(vars.troveId, vars.price),
            vars.resultingCollateralRatio,
            2e16,
            "Wrong CR"
        );
        // token balances
        assertApproxEqAbs(boldToken.balanceOf(A), 0, 10, "BOLD bal mismatch");
        assertEq(A.balance, vars.ethBalanceBefore, "ETH bal mismatch");
        assertEq(contractsArray[_branch].collToken.balanceOf(A), vars.collBalanceBefore, "Coll bal mismatch");
    }

    function testOnlyFlashLoanProviderCanCallLeverUpCallbackWithCurve() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testOnlyFlashLoanProviderCanCallLeverUpCallback(leverageZapperCurveArray[i]);
        }
    }

    function testOnlyFlashLoanProviderCanCallLeverUpCallbackWithUni() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testOnlyFlashLoanProviderCanCallLeverUpCallback(leverageZapperUniV3Array[i]);
        }
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

    function leverDownTrove(
        ILeverageZapper _leverageZapper,
        uint256 _troveId,
        uint256 _leverageRatio,
        ITroveManager _troveManager,
        IPriceFeed _priceFeed
    ) internal returns (uint256) {
        (uint256 price, ) = _priceFeed.fetchPrice();

        // This should be done in the frontend
        uint256 currentCR = _troveManager.getCurrentICR(_troveId, price);
        uint256 currentLR = _leverageZapper.leverageRatioToCollateralRatio(currentCR);
        assertLt(_leverageRatio, currentLR, "Leverage ratio should decrease");
        uint256 currentCollAmount = getTroveEntireColl(_troveManager, _troveId);
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
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testCanLeverDownTrove(leverageZapperCurveArray[i], i);
        }
    }

    function testCanLeverDownTroveWithUniV3() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            if (i == 2) continue; // TODO!!
            _testCanLeverDownTrove(leverageZapperUniV3Array[i], i);
        }
    }

    function _testCanLeverDownTrove(ILeverageZapper _leverageZapper, uint256 _branch) internal {
        uint256 collAmount = 10 ether;
        uint256 initialLeverageRatio = 2e18;

        uint256 troveId = openLeveragedTrove(
            _leverageZapper, collAmount, initialLeverageRatio, contractsArray[_branch].priceFeed, _branch > 0
        );
        uint256 initialDebt = getTroveEntireDebt(contractsArray[_branch].troveManager, troveId);

        uint256 newLeverageRatio = 1.5e18;
        uint256 resultingCollateralRatio = _leverageZapper.leverageRatioToCollateralRatio(newLeverageRatio);

        uint256 ethBalanceBefore = A.balance;
        uint256 collBalanceBefore = contractsArray[_branch].collToken.balanceOf(A);

        uint256 flashLoanAmount = leverDownTrove(
            _leverageZapper,
            troveId,
            newLeverageRatio,
            contractsArray[_branch].troveManager,
            contractsArray[_branch].priceFeed
        );

        // Checks
        (uint256 price, ) = contractsArray[_branch].priceFeed.fetchPrice();
        // coll
        assertApproxEqAbs(
            getTroveEntireColl(contractsArray[_branch].troveManager, troveId),
            collAmount * newLeverageRatio / DECIMAL_PRECISION,
            22e16,
            "Coll mismatch"
        );
        // debt
        uint256 expectedMinNetDebt = initialDebt - flashLoanAmount * price / DECIMAL_PRECISION * 101 / 100;
        uint256 expectedMaxNetDebt = expectedMinNetDebt * 105 / 100;
        uint256 troveEntireDebt = getTroveEntireDebt(contractsArray[_branch].troveManager, troveId);
        assertGe(troveEntireDebt, expectedMinNetDebt, "Debt too low");
        assertLe(troveEntireDebt, expectedMaxNetDebt, "Debt too high");
        // CR
        assertApproxEqAbs(
            contractsArray[_branch].troveManager.getCurrentICR(troveId, price),
            resultingCollateralRatio,
            3e15,
            "Wrong CR"
        );
        // token balances
        assertApproxEqAbs(boldToken.balanceOf(A), 0, 15, "BOLD bal mismatch");
        assertEq(A.balance, ethBalanceBefore, "ETH bal mismatch");
        assertEq(contractsArray[_branch].collToken.balanceOf(A), collBalanceBefore, "Coll bal mismatch");
    }

    function testOnlyFlashLoanProviderCanCallLeverDownCallbackWithCurve() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testOnlyFlashLoanProviderCanCallLeverDownCallback(leverageZapperCurveArray[i]);
        }
    }

    function testOnlyFlashLoanProviderCanCallLeverDownCallbackWithUni() external {
        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            _testOnlyFlashLoanProviderCanCallLeverDownCallback(leverageZapperUniV3Array[i]);
        }
    }

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
