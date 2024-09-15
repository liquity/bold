// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "./TestContracts/DevTestSetup.sol";
import {SPInvariantsTestHandler} from "./TestContracts/SPInvariantsTestHandler.t.sol";
import {Logging} from "./Utils/Logging.sol";

contract AnchoredSPInvariantsTest is DevTestSetup {
    using StringFormatting for uint256;

    struct Actor {
        string label;
        address account;
    }

    SPInvariantsTestHandler handler;

    address constant adam = 0x1111111111111111111111111111111111111111;
    address constant barb = 0x2222222222222222222222222222222222222222;
    address constant carl = 0x3333333333333333333333333333333333333333;
    address constant dana = 0x4444444444444444444444444444444444444444;
    address constant eric = 0x5555555555555555555555555555555555555555;
    address constant fran = 0x6666666666666666666666666666666666666666;
    address constant gabe = 0x7777777777777777777777777777777777777777;
    address constant hope = 0x8888888888888888888888888888888888888888;

    Actor[] actors;

    function setUp() public override {
        super.setUp();

        TestDeployer deployer = new TestDeployer();
        (TestDeployer.LiquityContractsDev memory contracts,, IBoldToken boldToken, HintHelpers hintHelpers,,,) =
            deployer.deployAndConnectContracts();
        stabilityPool = contracts.stabilityPool;

        handler = new SPInvariantsTestHandler(
            SPInvariantsTestHandler.Contracts({
                boldToken: boldToken,
                borrowerOperations: contracts.borrowerOperations,
                collateralToken: contracts.collToken,
                priceFeed: contracts.priceFeed,
                stabilityPool: contracts.stabilityPool,
                troveManager: contracts.troveManager,
                collSurplusPool: contracts.collSurplusPool
            }),
            hintHelpers
        );

        actors.push(Actor("adam", adam));
        actors.push(Actor("barb", barb));
        actors.push(Actor("carl", carl));
        actors.push(Actor("dana", dana));
        actors.push(Actor("eric", eric));
        actors.push(Actor("fran", fran));
        actors.push(Actor("gabe", gabe));
        actors.push(Actor("hope", hope));
        for (uint256 i = 0; i < actors.length; ++i) {
            vm.label(actors[i].account, actors[i].label);
        }

        vm.label(address(handler), "handler");
    }

    function invariant_allFundsClaimable() internal view {
        uint256 stabilityPoolColl = stabilityPool.getCollBalance();
        uint256 stabilityPoolBold = stabilityPool.getTotalBoldDeposits();
        uint256 yieldGainsOwed = stabilityPool.getYieldGainsOwed();

        uint256 claimableColl = 0;
        uint256 claimableBold = 0;
        uint256 sumYieldGains = 0;

        for (uint256 i = 0; i < actors.length; ++i) {
            claimableColl += stabilityPool.getDepositorCollGain(actors[i].account);
            claimableBold += stabilityPool.getCompoundedBoldDeposit(actors[i].account);
            sumYieldGains += stabilityPool.getDepositorYieldGain(actors[i].account);
            //info("+sumYieldGains:              ", sumYieldGains.decimal());
        }

        info("stabilityPoolColl:          ", stabilityPoolColl.decimal());
        info("claimableColl:              ", claimableColl.decimal());
        info("claimableColl E:            ", stabilityPool.getDepositorCollGain(eric).decimal());
        info("claimableColl G:            ", stabilityPool.getDepositorCollGain(gabe).decimal());
        info("stabilityPoolBold:          ", stabilityPoolBold.decimal());
        info("claimableBold:              ", claimableBold.decimal());
        info("claimableBold E:            ", stabilityPool.getCompoundedBoldDeposit(eric).decimal());
        info("claimableBold G:            ", stabilityPool.getCompoundedBoldDeposit(gabe).decimal());
        info("yieldGainsOwed:             ", yieldGainsOwed.decimal());
        info("sumYieldGains:              ", sumYieldGains.decimal());
        info("yieldGains E:               ", stabilityPool.getDepositorYieldGain(eric).decimal());
        info("yieldGains G:               ", stabilityPool.getDepositorYieldGain(gabe).decimal());
        info("");
        assertApproxEqAbsDecimal(stabilityPoolColl, claimableColl, 0.00001 ether, 18, "SP Coll !~ claimable Coll");
        assertApproxEqAbsDecimal(stabilityPoolBold, claimableBold, 0.001 ether, 18, "SP BOLD !~ claimable BOLD");
        assertApproxEqAbsDecimal(yieldGainsOwed, sumYieldGains, 0.001 ether, 18, "SP yieldGainsOwed !~= sum(yieldGain)");
    }

    function testYieldGlobalTracker() external {
        vm.prank(adam);
        handler.openTrove(18_250 ether);

        vm.prank(eric);
        handler.openTrove(10_220 ether);

        vm.prank(gabe);
        handler.provideToSp(18_251.7500000000001 ether, false);

        vm.prank(adam);
        handler.liquidateMe();

        vm.prank(adam);
        handler.openTrove(18_250 ether);

        invariant_allFundsClaimable();
    }

    function testYieldGlobalTracker2() external {
        // coll = 750.071917808219178083 ether, debt = 100_009.589041095890410958 ether
        vm.prank(adam);
        handler.openTrove(100_000 ether);

        // coll = 15.001438356164383562 ether, debt = 2_000.191780821917808219 ether
        vm.prank(eric);
        handler.openTrove(2_000 ether);

        vm.prank(eric);
        handler.provideToSp(2_000.19178082191781022 ether, false);

        // totalBoldDeposits = 2_000.19178082191781022 ether

        vm.prank(eric);
        handler.liquidateMe();

        // totalBoldDeposits = 0.000000000000002001 ether
        // P = 1.000404070842521948 ether

        // coll = 15.001438356164383562 ether, debt = 2_000.191780821917808219 ether
        vm.prank(eric);
        handler.openTrove(2_000 ether);

        vm.prank(eric);
        handler.provideToSp(2_000.191780821917808219 ether, false);

        // totalBoldDeposits = 2_000.19178082191781022 ether

        vm.prank(eric);
        handler.liquidateMe();

        invariant_allFundsClaimable();
    }

    function testYieldGlobalTracker3() external {
        // coll = 609.865977378640299561 ether, debt = 81_315.463650485373274767 ether
        vm.prank(barb);
        handler.openTrove(81_307.667024880247771557 ether);

        // coll = 735.070479452054794543 ether, debt = 98_009.397260273972605648 ether
        vm.prank(dana);
        handler.openTrove(98_000.000000000000002908 ether);

        // coll = 373.873319035600269508 ether, debt = 49_849.775871413369267714 ether
        vm.prank(eric);
        handler.openTrove(49_844.996214242140569304 ether);

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(81_315.463650485373356083 ether, false);

        // totalBoldDeposits = 81_315.463650485373356083 ether

        // pulling `deposited` from fixture
        vm.prank(eric);
        handler.provideToSp(98_009.397260273972605648 ether, false);

        // totalBoldDeposits = 179_324.860910759345961731 ether

        vm.prank(barb);
        handler.liquidateMe();

        // totalBoldDeposits = 98_009.397260273972686964 ether
        // P = 0.546546623610923366 ether

        vm.prank(dana);
        handler.liquidateMe();
        invariant_allFundsClaimable();

        // totalBoldDeposits = 0.000000000000081316 ether
        // P = 0.000000001294434626 ether

        // coll = 448.153242320289758012 ether, debt = 59_753.765642705301068218 ether
        vm.prank(gabe);
        handler.openTrove(59_748.03637894293667703 ether);

        invariant_allFundsClaimable();

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(98_009.397260273972703658 ether, false);
        // [FAIL. Reason: panic: arithmetic underflow or overflow (0x11)]
    }

    function testYieldGlobalTracker4() external {
        // coll = 735.07047945205479457 ether, debt = 98_009.397260273972609312 ether
        vm.prank(eric);
        handler.openTrove(98_000.000000000000006572 ether);

        // coll = 15.073363060611747045 ether, debt = 2_009.781741414899605927 ether
        vm.prank(adam);
        handler.openTrove(2_009.589041095890410957 ether);

        // coll = 674.842356181481975293 ether, debt = 89_978.98082419759670561 ether
        vm.prank(gabe);
        handler.openTrove(89_970.353530023484864596 ether);

        // coll = 562.802728905215994793 ether, debt = 75_040.363854028799305609 ether
        vm.prank(carl);
        handler.openTrove(75_033.168892628136333632 ether);

        // pulling `deposited` from fixture
        vm.prank(eric);
        handler.provideToSp(75_040.36385402879938065 ether, false);

        // totalBoldDeposits = 75_040.36385402879938065 ether

        vm.prank(carl);
        handler.liquidateMe();

        // totalBoldDeposits = 0.000000000000075041 ether
        // P = 0.000000001000008477 ether

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(98_009.397260273972609312 ether, false);

        // totalBoldDeposits = 98_009.397260273972684353 ether

        vm.prank(eric);
        handler.liquidateMe();

        // totalBoldDeposits = 0.000000000000075041 ether
        // P = 0.000000000765657561 ether

        // coll = 456.581526480883492157 ether, debt = 60_877.53686411779895416 ether
        vm.prank(hope);
        handler.openTrove(60_871.699851803242478854 ether);

        invariant_allFundsClaimable();
    }
}
