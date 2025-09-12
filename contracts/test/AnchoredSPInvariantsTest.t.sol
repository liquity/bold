// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

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
                collSurplusPool: contracts.pools.collSurplusPool
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
        info("stabilityPoolBold:          ", stabilityPoolBold.decimal());
        info("claimableBold:              ", claimableBold.decimal());
        info("yieldGainsOwed:             ", yieldGainsOwed.decimal());
        info("sumYieldGains:              ", sumYieldGains.decimal());
        for (uint256 i = 0; i < actors.length; ++i) {
            info(
                actors[i].label,
                ":                       ",
                stabilityPool.getDepositorYieldGain(actors[i].account).decimal()
            );
        }
        info("");
        assertApproxEqAbsDecimal(stabilityPoolColl, claimableColl, 0.00001 ether, 18, "SP Coll !~ claimable Coll");
        assertApproxEqAbsDecimal(stabilityPoolBold, claimableBold, 0.001 ether, 18, "SP BOLD !~ claimable BOLD");
        assertApproxEqAbsDecimal(yieldGainsOwed, sumYieldGains, 0.001 ether, 18, "SP yieldGainsOwed !~= sum(yieldGain)");

        //assertGe(stabilityPoolBold, claimableBold, "Not enough deposits for all depositors");
        //assertGe(stabilityPoolColl, claimableColl, "Not enough collateral for all depositors");
        //assertGe(yieldGainsOwed, sumYieldGains, "Not enough yield gains for all depositors");
    }

    function testUnclaimableDeposit() external {
        // coll = 581.807407427107718655 ether, debt = 77_574.320990281029153872 ether
        vm.prank(hope);
        handler.openTrove(77_566.883069986646872666 ether);

        // coll = 735.070487541934665757 ether, debt = 98_009.398338924622100814 ether
        vm.prank(barb);
        handler.openTrove(98_000.001078547227161224 ether);

        vm.prank(hope);
        handler.provideToSp(0.000001023636824878 ether, false);

        // totalBoldDeposits = 0.000001023636824878 ether

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(98_009.398338924622100814 ether, false);

        // totalBoldDeposits = 98_009.398339948258925692 ether

        // coll = 735.070479452054794532 ether, debt = 98_009.397260273972604207 ether
        vm.prank(carl);
        handler.openTrove(98_000.000000000000001468 ether);

        // coll = 60.195714636403445628 ether, debt = 8_026.095284853792750331 ether
        vm.prank(fran);
        handler.openTrove(8_025.325733071169487504 ether);

        // coll = 15.001438356164383562 ether, debt = 2_000.191780821917808222 ether
        vm.prank(adam);
        handler.openTrove(2_000.000000000000000003 ether);

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 96_009.20655912634111747 ether
        // P = 0.979591836959510777 ether

        vm.prank(carl);
        handler.provideToSp(0.000000000001265034 ether, false);

        // totalBoldDeposits = 96_009.206559126342382504 ether

        vm.prank(fran);
        handler.liquidateMe();

        // totalBoldDeposits = 87_983.111274272549632173 ether
        // P = 0.89770075895273572 ether

        // pulling `deposited` from fixture
        vm.prank(hope);
        handler.provideToSp(2_000.191780821917810223 ether, false);

        // totalBoldDeposits = 89_983.303055094467442396 ether

        // coll = 568.201183566424575581 ether, debt = 75_760.157808856610077362 ether
        vm.prank(dana);
        handler.openTrove(75_752.893832735662822023 ether);

        vm.prank(dana);
        handler.liquidateMe();

        // totalBoldDeposits = 14_223.145246237857365034 ether
        // P = 0.141894416505527947 ether

        invariant_allFundsClaimable();
    }

    function testUnclaimableDeposit2() external {
        // coll = 735.140965662413210774 ether, debt = 98_018.795421655094769748 ether
        vm.prank(dana);
        handler.openTrove(98_009.397260273972607992 ether);

        // pulling `deposited` from fixture
        vm.prank(adam);
        handler.provideToSp(9.398161381122161756 ether, false);

        // totalBoldDeposits = 9.398161381122161756 ether

        // coll = 735.070479452054794705 ether, debt = 98_009.39726027397262726 ether
        vm.prank(eric);
        handler.openTrove(98_000.000000000000024518 ether);

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(98_009.39726027397262726 ether, false);

        // totalBoldDeposits = 98_018.795421655094789016 ether

        vm.prank(hope);
        handler.provideToSp(89_926.427447073294525543 ether, false);

        // totalBoldDeposits = 187_945.222868728389314559 ether

        // coll = 695.649439428737938566 ether, debt = 92_753.258590498391808747 ether
        vm.prank(gabe);
        handler.openTrove(92_744.365295196112729445 ether);

        vm.prank(dana);
        handler.provideToSp(12_389.101939905632219407 ether, false);

        // totalBoldDeposits = 200_334.324808634021533966 ether

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(9_589.959513437908897281 ether, false);

        // totalBoldDeposits = 209_924.284322071930431247 ether

        // coll = 358.727589004694716678 ether, debt = 47_830.345200625962223645 ether
        vm.prank(hope);
        handler.openTrove(47_825.759168924832445192 ether);

        // coll = 387.627141578823956719 ether, debt = 51_683.618877176527562444 ether
        vm.prank(barb);
        handler.openTrove(51_678.663388906358459579 ether);

        vm.prank(barb);
        handler.liquidateMe();

        // totalBoldDeposits = 158_240.665444895402868803 ether
        // P = 0.753798761091013085 ether

        vm.prank(barb);
        handler.provideToSp(0.000000000000008548 ether, false);

        // totalBoldDeposits = 158_240.665444895402877351 ether

        vm.prank(carl);
        handler.provideToSp(4_591.158415534017479187 ether, false);

        // totalBoldDeposits = 162_831.823860429420356538 ether

        vm.prank(dana);
        handler.provideToSp(86_019.232581553804992428 ether, false);

        // totalBoldDeposits = 248_851.056441983225348966 ether

        vm.prank(gabe);
        handler.provideToSp(83_736.829497136058174833 ether, false);

        // totalBoldDeposits = 332_587.885939119283523799 ether

        // coll = 735.082255482320817013 ether, debt = 98_010.967397642775601628 ether
        vm.prank(carl);
        handler.openTrove(98_001.569986822121425601 ether);

        vm.prank(gabe);
        handler.liquidateMe();

        // totalBoldDeposits = 239_834.627348620891715052 ether
        // P = 0.543576758520929938 ether

        // pulling `deposited` from fixture
        vm.prank(barb);
        handler.provideToSp(47_830.345200625962271476 ether, false);

        // totalBoldDeposits = 287_664.972549246853986528 ether

        // coll = 735.070479452054794659 ether, debt = 98_009.397260273972621122 ether
        vm.prank(fran);
        handler.openTrove(98_000.000000000000018381 ether);

        // coll = 735.070479452054794701 ether, debt = 98_009.397260273972626757 ether
        vm.prank(barb);
        handler.openTrove(98_000.000000000000024015 ether);

        vm.prank(barb);
        handler.liquidateMe();

        // totalBoldDeposits = 189_655.575288972881359771 ether
        // P = 0.358376488932287869 ether

        // coll = 482.348723040733119578 ether, debt = 64_313.163072097749277015 ether
        vm.prank(gabe);
        handler.openTrove(64_306.996647761662542251 ether);

        vm.prank(eric);
        handler.liquidateMe();

        // totalBoldDeposits = 91_646.178028698908732511 ether
        // P = 0.173176219343645801 ether

        vm.prank(hope);
        handler.liquidateMe();

        // totalBoldDeposits = 43_815.832828072946508866 ether
        // P = 0.082795163309295299 ether

        vm.prank(adam);
        handler.provideToSp(156_013.932831544173758454 ether, false);

        // totalBoldDeposits = 199_829.76565961712026732 ether

        vm.prank(barb);
        handler.provideToSp(149_177.525713798558063626 ether, false);

        // totalBoldDeposits = 349_007.291373415678330946 ether

        // coll = 212.375283704302188719 ether, debt = 28_316.704493906958495745 ether
        vm.prank(barb);
        handler.openTrove(28_313.989453822345394132 ether);

        vm.prank(fran);
        handler.liquidateMe();

        // totalBoldDeposits = 250_997.894113141705709824 ether
        // P = 0.059544348061060947 ether

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(22_796.354529886855570135 ether, false);

        // totalBoldDeposits = 273_794.248643028561279959 ether

        // pulling `deposited` from fixture
        vm.prank(fran);
        handler.provideToSp(3_365.431868318464668052 ether, false);

        // totalBoldDeposits = 277_159.680511347025948011 ether

        // pulling `deposited` from fixture
        vm.prank(eric);
        handler.provideToSp(6_369.148148716152063935 ether, false);

        // totalBoldDeposits = 283_528.828660063178011946 ether

        // coll = 56.130386313173824619 ether, debt = 7_484.051508423176615827 ether
        vm.prank(hope);
        handler.openTrove(7_483.333928457434122145 ether);

        // coll = 409.098077325686901872 ether, debt = 54_546.41031009158691615 ether
        vm.prank(fran);
        handler.openTrove(54_541.180333895186007903 ether);

        // coll = 549.477014983678353472 ether, debt = 73_263.601997823780462917 ether
        vm.prank(adam);
        handler.openTrove(73_256.577394511977944484 ether);

        // pulling `deposited` from fixture
        vm.prank(fran);
        handler.provideToSp(98_010.967397642775601628 ether, false);

        // totalBoldDeposits = 381_539.796057705953613574 ether

        vm.prank(dana);
        handler.provideToSp(13_294.811494145641399612 ether, false);

        // totalBoldDeposits = 394_834.607551851595013186 ether

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 321_571.005554027814550269 ether
        // P = 0.048495586543891854 ether

        vm.prank(gabe);
        handler.liquidateMe();

        // totalBoldDeposits = 257_257.842481930065273254 ether
        // P = 0.038796625779998194 ether

        vm.prank(gabe);
        handler.provideToSp(2_881.242711585620903523 ether, false);

        // totalBoldDeposits = 260_139.085193515686176777 ether

        vm.prank(barb);
        handler.liquidateMe();

        // totalBoldDeposits = 231_822.380699608727681032 ether
        // P = 0.034573528790341043 ether

        invariant_allFundsClaimable();
    }

    function testUnderflow() external {
        // coll = 735.070479452054794521 ether, debt = 98_009.39726027397260276 ether
        vm.prank(gabe);
        handler.openTrove(98_000.000000000000000021 ether);

        // pulling `deposited` from fixture
        vm.prank(carl);
        handler.provideToSp(9.397260273972700749 ether, false);

        // totalBoldDeposits = 9.397260273972700749 ether

        vm.prank(carl);
        handler.provideToSp(0.000000000000019902 ether, false);

        // totalBoldDeposits = 9.397260273972720651 ether

        // pulling `deposited` from fixture
        vm.prank(eric);
        handler.provideToSp(12.028493150685049425 ether, false);

        // totalBoldDeposits = 21.425753424657770076 ether

        // pulling `deposited` from fixture
        vm.prank(fran);
        handler.provideToSp(24.05698630137009885 ether, false);

        // totalBoldDeposits = 45.482739726027868926 ether

        // pulling `deposited` from fixture
        vm.prank(eric);
        handler.provideToSp(48.11397260274029571 ether, false);

        // totalBoldDeposits = 93.596712328768164636 ether

        vm.prank(hope);
        handler.provideToSp(22_378.224492402901169486 ether, false);

        // totalBoldDeposits = 22_471.821204731669334122 ether

        // coll = 670.171237313523994506 ether, debt = 89_356.164975136532600748 ether
        vm.prank(adam);
        handler.openTrove(89_347.597397303914417174 ether);

        vm.prank(adam);
        handler.provideToSp(66_119.976516875041256465 ether, false);

        // totalBoldDeposits = 88_591.797721606710590587 ether

        // coll = 735.07047945205479454 ether, debt = 98_009.39726027397260532 ether
        vm.prank(hope);
        handler.openTrove(98_000.000000000000002581 ether);

        vm.prank(carl);
        handler.provideToSp(99_018.369068280498073463 ether, false);

        // totalBoldDeposits = 187_610.16678988720866405 ether

        // coll = 727.153278118134034577 ether, debt = 96_953.770415751204610242 ether
        vm.prank(eric);
        handler.openTrove(96_944.474370263645082632 ether);

        vm.prank(eric);
        handler.liquidateMe();

        // totalBoldDeposits = 90_656.396374136004053808 ether
        // P = 0.483216863591758585 ether

        // coll = 170.932345052439560746 ether, debt = 22_790.979340325274766094 ether
        //vm.prank(barb);
        //handler.openTrove(22_788.794113492474117891 ether);

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 1_300.23139899947145306 ether
        // P = 0.006930495405697588 ether

        console2.log("-9");
        invariant_allFundsClaimable();

        // coll = 735.070479452054794697 ether, debt = 98_009.397260273972626152 ether
        vm.prank(fran);
        handler.openTrove(98_000.000000000000023411 ether);

        console2.log("-8");
        invariant_allFundsClaimable();

        // coll = 735.070479452056938533 ether, debt = 98_009.397260274258470952 ether
        vm.prank(dana);
        handler.openTrove(98_000.000000000285840803 ether);

        console2.log("-7");
        invariant_allFundsClaimable();

        // coll = 735.073432425759024971 ether, debt = 98_009.790990101203329407 ether
        vm.prank(adam);
        handler.openTrove(98_000.393692075935773922 ether);

        console2.log("-6");
        invariant_allFundsClaimable();

        // pulling `deposited` from fixture
        vm.prank(adam);
        handler.provideToSp(98_009.39726027397270077 ether, false);

        // totalBoldDeposits = 99_309.62865927344415383 ether

        console2.log("-5");
        invariant_allFundsClaimable();

        // pulling `deposited` from fixture
        vm.prank(fran);
        handler.provideToSp(98_009.39726027397270077 ether, false);

        // totalBoldDeposits = 197_319.0259195474168546 ether

        console2.log("-4");
        invariant_allFundsClaimable();

        // pulling `deposited` from fixture
        vm.prank(fran);
        handler.provideToSp(98_009.790990101203427417 ether, false);

        // totalBoldDeposits = 295_328.816909648620282017 ether

        console2.log("-3");
        invariant_allFundsClaimable();

        vm.prank(eric);
        handler.provideToSp(89_618.132493028108872257 ether, false);

        // totalBoldDeposits = 384_946.949402676729154274 ether

        console2.log("-2");
        invariant_allFundsClaimable();

        // pulling `deposited` from fixture
        vm.prank(carl);
        handler.provideToSp(22_790.979340325274788885 ether, false);

        // totalBoldDeposits = 407_737.928743002003943159 ether

        console2.log("-1");
        invariant_allFundsClaimable();

        vm.prank(hope);
        handler.liquidateMe();

        // totalBoldDeposits = 309_728.531482728031337839 ether
        // P = 0.005264587896132409 ether

        console2.log("0");
        invariant_allFundsClaimable();

        vm.prank(hope);
        handler.provideToSp(36_648.420465084212639386 ether, false);
        // [FAIL. Reason: panic: arithmetic underflow or overflow (0x11)] test_XXX() (gas: 9712433)
    }

    function testNotEnoughYieldToClaim() external {
        // coll = 531.374961037517928877 ether, debt = 70_849.994805002390516918 ether
        vm.prank(barb);
        handler.openTrove(70_843.201621285280969428 ether);

        // pulling `deposited` from fixture
        vm.prank(carl);
        handler.provideToSp(6.79318371710954749 ether, false);

        // totalBoldDeposits = 6.79318371710954749 ether

        vm.prank(barb);
        handler.provideToSp(54_410.610723992018269811 ether, false);

        // totalBoldDeposits = 54_417.403907709127817301 ether

        vm.prank(hope);
        handler.provideToSp(5_146.80395069777790841 ether, false);

        // totalBoldDeposits = 59_564.207858406905725711 ether

        // coll = 531.425914800905088131 ether, debt = 70_856.788640120678417378 ether
        vm.prank(hope);
        handler.openTrove(70_849.994805002390516918 ether);

        invariant_allFundsClaimable();
    }

    function testNotEnoughYieldToClaim2() external {
        // coll = 735.071211554227610995 ether, debt = 98_009.494873897014799279 ether
        vm.prank(barb);
        handler.openTrove(98_000.097604263729236202 ether);

        // pulling `deposited` from fixture
        vm.prank(barb);
        handler.provideToSp(9.397269633285661087 ether, false);

        // totalBoldDeposits = 9.397269633285661087 ether

        // coll = 296.145816189419348496 ether, debt = 39_486.108825255913132743 ether
        vm.prank(hope);
        handler.openTrove(39_482.322849092301542185 ether);

        // coll = 690.364688805446856156 ether, debt = 92_048.625174059580820766 ether
        vm.prank(eric);
        handler.openTrove(92_039.79943986671688901 ether);

        vm.prank(fran);
        handler.provideToSp(0.000000000000021173 ether, false);

        // totalBoldDeposits = 9.39726963328568226 ether

        // coll = 735.070479452054794549 ether, debt = 98_009.397260273972606523 ether
        vm.prank(carl);
        handler.openTrove(98_000.000000000000003783 ether);

        // coll = 515.861846232288564631 ether, debt = 68_781.579497638475284021 ether
        vm.prank(adam);
        handler.openTrove(68_774.984636098027527957 ether);

        // coll = 735.070528577820199656 ether, debt = 98_009.403810376026620703 ether
        vm.prank(dana);
        handler.openTrove(98_000.006549474022262404 ether);

        // pulling `deposited` from fixture
        vm.prank(eric);
        handler.provideToSp(98_009.397260273972704533 ether, false);

        // totalBoldDeposits = 98_018.794529907258386793 ether

        vm.prank(barb);
        handler.liquidateMe();

        // totalBoldDeposits = 9.299656010243587514 ether
        // P = 0.000094876253629155 ether

        // pulling `deposited` from fixture
        vm.prank(eric);
        handler.provideToSp(98_009.397260273972704533 ether, false);

        // totalBoldDeposits = 98_018.696916284216292047 ether

        vm.prank(carl);
        handler.liquidateMe();

        // totalBoldDeposits = 9.299656010243685524 ether
        // P = 0.000000009001512467 ether

        // coll = 439.615230826832584704 ether, debt = 58_615.364110244344627095 ether
        vm.prank(fran);
        handler.openTrove(58_609.743997806198827208 ether);

        // pulling `deposited` from fixture
        vm.prank(barb);
        handler.provideToSp(68_781.579497638475284021 ether, false);

        // totalBoldDeposits = 68_790.879153648718969545 ether

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(39_486.108825255913132743 ether, false);

        // totalBoldDeposits = 108_276.987978904632102288 ether

        // pulling `deposited` from fixture
        vm.prank(fran);
        handler.provideToSp(98_009.403810376026620703 ether, false);

        // totalBoldDeposits = 206_286.391789280658722991 ether

        vm.prank(fran);
        handler.provideToSp(67_852.887887440994776149 ether, false);

        // totalBoldDeposits = 274_139.27967672165349914 ether

        vm.prank(adam);
        handler.provideToSp(78_134.913037086847714575 ether, false);

        // totalBoldDeposits = 352_274.192713808501213715 ether

        vm.prank(hope);
        handler.liquidateMe();

        // totalBoldDeposits = 312_788.083888552588080972 ether
        // P = 0.000000007992540739 ether

        // pulling `deposited` from fixture
        vm.prank(adam);
        handler.provideToSp(401.55682795488209173 ether, false);

        // totalBoldDeposits = 313_189.640716507470172702 ether

        // coll = 735.070479452054794648 ether, debt = 98_009.397260273972619611 ether
        vm.prank(gabe);
        handler.openTrove(98_000.00000000000001687 ether);

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 244_408.061218868994888681 ether
        // P = 0.000000006237247764 ether

        // coll = 260.952813316840363413 ether, debt = 34_793.708442245381788334 ether
        vm.prank(carl);
        handler.openTrove(34_790.372379140532696158 ether);

        vm.prank(dana);
        handler.provideToSp(126_931.523034110680273609 ether, false);

        info("");
        info("             -------------- here it starts!  ----------------");
        info("");

        // totalBoldDeposits = 371_339.584252979675162290 ether

        vm.prank(fran);
        handler.liquidateMe();

        // totalBoldDeposits = 312_724.220142735330535195 ether
        // P = 0.000000005252708102 ether
        info("");
        info("P ratio:        ", (5252708102 * DECIMAL_PRECISION / 6237247764).decimal());
        info(
            "deposits ratio: ",
            (312_724.220142735330535195 ether * DECIMAL_PRECISION / 371339584252979675162290).decimal()
        );
        info("");

        info("");
        info("             -------------- here it goes!  ----------------");
        info("");

        uint256 prevError = 99469643824625821462110 * DECIMAL_PRECISION / 371339584252979675162290;
        uint256 pWithError = 5252708102 * DECIMAL_PRECISION + prevError;
        uint256 newP = pWithError * 705655592866947642 / DECIMAL_PRECISION / DECIMAL_PRECISION;
        info("prev error:     ", prevError.decimal());
        info("P w prev error: ", pWithError.decimal());
        info("P * F:          ", (pWithError * 705655592866947642 / DECIMAL_PRECISION).decimal());
        info("final P:        ", newP.decimal());

        vm.prank(eric);
        handler.liquidateMe();

        // totalBoldDeposits = 220_675.594968675749714429 ether
        // P = 0.000000003706602850 ether
        info("");
        info("P ratio:        ", (3706602850 * DECIMAL_PRECISION / 6237247764).decimal());
        info(
            "deposits ratio: ",
            (220_675.594968675749714429 ether * DECIMAL_PRECISION / 371339584252979675162290).decimal()
        );
        info("P - 1 ratio:    ", (3706602849 * DECIMAL_PRECISION / 6237247764).decimal());
        info("");

        // coll = 735.070479452054794556 ether, debt = 98_009.397260273972607451 ether
        vm.prank(hope);
        handler.openTrove(98_000.000000000000004711 ether);

        vm.prank(carl);
        handler.liquidateMe();

        // totalBoldDeposits = 185_881.886526430367926095 ether
        // P = 0.000000003122186351 ether

        //uint256 depositsRatio = 185881886526430367926095 * DECIMAL_PRECISION / 371339584252979675162290;
        //uint256 pRatio = 3122186351 * DECIMAL_PRECISION / 6237247764;
        info("");
        info("P ratio:        ", (3122186351 * DECIMAL_PRECISION / 6237247764).decimal());
        info("deposits ratio: ", (185881886526430367926095 * DECIMAL_PRECISION / 371339584252979675162290).decimal());
        info("");

        invariant_allFundsClaimable();

        // coll = 285.918279973646172899 ether, debt = 38_122.437329819489719827 ether
        vm.prank(adam);
        handler.openTrove(38_118.782104138270981514 ether);

        invariant_allFundsClaimable();
    }

    function testNotEnoughYieldToClaim3() external {
        // coll = 500.857826775587502992 ether, debt = 66_781.043570078333732226 ether
        vm.prank(adam);
        handler.openTrove(66_774.640522357011826983 ether);

        // coll = 455.998017386763941998 ether, debt = 60_799.73565156852559962 ether
        vm.prank(fran);
        handler.openTrove(60_793.906098928902280224 ether);

        // coll = 15.001438356164383562 ether, debt = 2_000.191780821917808219 ether
        vm.prank(barb);
        handler.openTrove(2_000 ether);

        vm.prank(fran);
        handler.provideToSp(0.127035053107027317 ether, false);

        // totalBoldDeposits = 0.127035053107027317 ether

        // coll = 390.048079659008251957 ether, debt = 52_006.410621201100260869 ether
        vm.prank(hope);
        handler.openTrove(52_001.424183265718616619 ether);

        // coll = 736.681846984701599582 ether, debt = 98_224.246264626879944156 ether
        vm.prank(dana);
        handler.openTrove(98_214.828404368926759399 ether);

        // pulling `deposited` from fixture
        vm.prank(carl);
        handler.provideToSp(52_006.410621201100260869 ether, false);

        // totalBoldDeposits = 52_006.537656254207288186 ether

        // coll = 735.070479452054794533 ether, debt = 98_009.397260273972604297 ether
        vm.prank(gabe);
        handler.openTrove(98_000.000000000000001558 ether);

        vm.prank(eric);
        handler.provideToSp(98_018.79542165509478359 ether, false);

        // totalBoldDeposits = 150_025.333077909302071776 ether

        vm.prank(gabe);
        handler.liquidateMe();

        // totalBoldDeposits = 52_015.935817635329467479 ether
        // P = 0.346714349839990399 ether

        vm.prank(hope);
        handler.liquidateMe();

        // totalBoldDeposits = 9.52519643422920661 ether
        // P = 0.000063490586814979 ether

        // coll = 297.885541044368726255 ether, debt = 39_718.072139249163500539 ether
        vm.prank(hope);
        handler.openTrove(39_714.263922160737128486 ether);

        vm.prank(carl);
        handler.provideToSp(45_503.134640909581521244 ether, false);

        // totalBoldDeposits = 45_512.659837343810727854 ether

        vm.prank(dana);
        handler.provideToSp(13_158.641347715694197298 ether, false);

        // totalBoldDeposits = 58_671.301185059504925152 ether

        vm.prank(fran);
        handler.provideToSp(88_720.671803804390427542 ether, false);

        // totalBoldDeposits = 147_391.972988863895352694 ether

        // pulling `deposited` from fixture
        vm.prank(barb);
        handler.provideToSp(98_224.246264626880042381 ether, false);

        // totalBoldDeposits = 245_616.219253490775395075 ether

        // pulling `deposited` from fixture
        vm.prank(fran);
        handler.provideToSp(2_000.191780821917808219 ether, false);

        // totalBoldDeposits = 247_616.411034312693203294 ether

        vm.prank(dana);
        handler.liquidateMe();

        // totalBoldDeposits = 149_392.164769685813259138 ether
        // P = 0.000038305200237608 ether

        // coll = 16.056327434142920133 ether, debt = 2_140.84365788572268436 ether
        vm.prank(eric);
        handler.openTrove(2_140.638391190677003004 ether);

        vm.prank(fran);
        handler.liquidateMe();

        // totalBoldDeposits = 88_592.429118117287659518 ether
        // P = 0.000022715721016141 ether

        // pulling `deposited` from fixture
        vm.prank(hope);
        handler.provideToSp(16_730.704105575056759258 ether, false);

        // totalBoldDeposits = 105_323.133223692344418776 ether

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(2_755.636251036681598567 ether, false);

        // totalBoldDeposits = 108_078.769474729026017343 ether

        // pulling `deposited` from fixture
        vm.prank(carl);
        handler.provideToSp(528.278543964116931444 ether, false);

        // totalBoldDeposits = 108_607.048018693142948787 ether

        // pulling `deposited` from fixture
        vm.prank(eric);
        handler.provideToSp(1_508.113441559160422894 ether, false);

        // totalBoldDeposits = 110_115.161460252303371681 ether

        vm.prank(barb);
        handler.provideToSp(0.000000000000017716 ether, false);

        // totalBoldDeposits = 110_115.161460252303389397 ether

        // coll = 391.562210654678915577 ether, debt = 52_208.294753957188743495 ether
        vm.prank(carl);
        handler.openTrove(52_203.28895912549177853 ether);

        // coll = 694.424483959494241787 ether, debt = 92_589.931194599232238236 ether
        vm.prank(fran);
        handler.openTrove(92_581.05355932642011576 ether);

        vm.prank(fran);
        handler.liquidateMe();

        // totalBoldDeposits = 17_525.230265653071151161 ether
        // P = 0.000003615289994393 ether

        info("");
        info("P ratio:        ", (3615289994393 * DECIMAL_PRECISION / 22715721016141).decimal());
        info(
            "deposits ratio: ",
            (17_525.230265653071151161 ether * DECIMAL_PRECISION / 110_115.161460252303389397 ether).decimal()
        );
        info("");

        vm.prank(eric);
        handler.liquidateMe();

        // totalBoldDeposits = 15_384.386607767348466801 ether
        // P = 0.00000317365410496 ether

        info("");
        info("P ratio:        ", (3173654104960 * DECIMAL_PRECISION / 22715721016141).decimal());
        info(
            "deposits ratio: ",
            (15_384.386607767348466801 ether * DECIMAL_PRECISION / 110_115.161460252303389397 ether).decimal()
        );
        info("");

        // coll = 472.174813390591817645 ether, debt = 62_956.641785412242352578 ether
        vm.prank(fran);
        handler.openTrove(62_950.605425987832560415 ether);

        // coll = 735.070479452054794524 ether, debt = 98_009.397260273972603184 ether
        vm.prank(dana);
        handler.openTrove(98_000.000000000000000445 ether);

        invariant_allFundsClaimable();
    }

    function testNotEnoughYieldToClaim4() external {
        // coll = 735.070479452054794523 ether, debt = 98_009.397260273972602968 ether
        vm.prank(dana);
        handler.openTrove(98_000.000000000000000229 ether);

        // pulling `deposited` from fixture
        vm.prank(hope);
        handler.provideToSp(9.397260273972700749 ether, false);

        // totalBoldDeposits = 9.397260273972700749 ether

        // coll = 735.070479452054794596 ether, debt = 98_009.397260273972612766 ether
        vm.prank(hope);
        handler.openTrove(98_000.000000000000010026 ether);

        vm.prank(gabe);
        handler.provideToSp(98_009.397260282669422181 ether, false);

        // totalBoldDeposits = 98_018.79452055664212293 ether

        vm.prank(dana);
        handler.liquidateMe();

        // totalBoldDeposits = 9.397260282669519962 ether
        // P = 0.000095872024631956 ether

        // coll = 15.001438356164383562 ether, debt = 2_000.191780821917808222 ether
        vm.prank(barb);
        handler.openTrove(2_000.000000000000000003 ether);

        // coll = 245.638216964337321336 ether, debt = 32_751.762261911642844722 ether
        vm.prank(dana);
        handler.openTrove(32_748.621983091346414244 ether);

        // coll = 671.510441931192659665 ether, debt = 89_534.72559082568795521 ether
        vm.prank(fran);
        handler.openTrove(89_526.14089238395250771 ether);

        // coll = 735.070479452054794659 ether, debt = 98_009.397260273972621098 ether
        vm.prank(adam);
        handler.openTrove(98_000.000000000000018357 ether);

        vm.prank(adam);
        handler.provideToSp(0.000000000000021956 ether, false);

        // totalBoldDeposits = 9.397260282669541918 ether

        // coll = 376.789379643035011626 ether, debt = 50_238.583952404668216799 ether
        vm.prank(gabe);
        handler.openTrove(50_233.767015841505332726 ether);

        // pulling `deposited` from fixture
        vm.prank(eric);
        handler.provideToSp(50_238.583952404668216799 ether, false);

        // totalBoldDeposits = 50_247.981212687337758717 ether

        vm.prank(gabe);
        handler.liquidateMe();

        // totalBoldDeposits = 9.397260282669541918 ether
        // P = 0.0000000179297625 ether

        // pulling `deposited` from fixture
        vm.prank(eric);
        handler.provideToSp(89_534.72559082568795521 ether, false);

        // totalBoldDeposits = 89_544.122851108357497128 ether

        // coll = 391.027929559007118106 ether, debt = 52_137.057274534282414027 ether
        vm.prank(gabe);
        handler.openTrove(52_132.058310038799241497 ether);

        vm.prank(dana);
        handler.provideToSp(0.000000000000000001 ether, false);

        // totalBoldDeposits = 89_544.122851108357497129 ether

        vm.prank(barb);
        handler.liquidateMe();

        // totalBoldDeposits = 87_543.931070286439688907 ether
        // P = 0.000000017529256443 ether

        // coll = 362.672606823421941244 ether, debt = 48_356.347576456258832456 ether
        vm.prank(eric);
        handler.openTrove(48_351.711111007258136471 ether);

        invariant_allFundsClaimable();
    }

    function testCollGainsUnderflow3CollSkin() external {
        // coll = 289.601984682301661608 ether, debt = 38_613.59795764022154772 ether
        vm.prank(dana);
        handler.openTrove(38_609.895638880328913441 ether);

        // pulling `deposited` from fixture
        vm.prank(carl);
        handler.provideToSp(3.702318759892672893 ether, false);

        // totalBoldDeposits = 3.702318759892672893 ether

        // pulling `deposited` from fixture
        vm.prank(carl);
        handler.provideToSp(7.404637519785345786 ether, false);

        // totalBoldDeposits = 11.106956279678018679 ether

        vm.prank(carl);
        handler.provideToSp(6_872.312325153568231613 ether, false);

        // totalBoldDeposits = 6_883.419281433246250292 ether

        // pulling `deposited` from fixture
        vm.prank(carl);
        handler.provideToSp(6_884.455930686016187896 ether, false);

        // totalBoldDeposits = 13_767.875212119262438188 ether

        // coll = 485.870086975795226011 ether, debt = 64_782.678263439363468128 ether
        vm.prank(adam);
        handler.openTrove(64_776.466821415392129157 ether);

        // coll = 735.070479841999818057 ether, debt = 98_009.39731226664240759 ether
        vm.prank(gabe);
        handler.openTrove(98_000.000051987684684402 ether);

        vm.prank(adam);
        handler.provideToSp(56_502.482327086364961955 ether, false);

        // totalBoldDeposits = 70_270.357539205627400143 ether

        // coll = 735.138660165061182493 ether, debt = 98_018.48802200815766572 ether
        vm.prank(hope);
        handler.openTrove(98_009.089890100887717583 ether);

        // coll = 735.070493012734388559 ether, debt = 98_009.399068364585141076 ether
        vm.prank(barb);
        handler.openTrove(98_000.001807917250610196 ether);

        vm.prank(dana);
        handler.provideToSp(66_572.988267614156561955 ether, false);

        // totalBoldDeposits = 136_843.345806819783962098 ether

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 72_060.66754338042049397 ether
        // P = 0.526592412064432101 ether

        // coll = 735.140965662413210843 ether, debt = 98_018.795421655094779019 ether
        vm.prank(eric);
        handler.openTrove(98_009.397260273972617262 ether);

        // pulling `deposited` from fixture
        vm.prank(carl);
        handler.provideToSp(64_782.678263439363532911 ether, false);

        // totalBoldDeposits = 136_843.345806819784026881 ether

        vm.prank(eric);
        handler.liquidateMe();

        // totalBoldDeposits = 38_824.550385164689247862 ether
        // P = 0.149402322152386736 ether

        vm.prank(dana);
        handler.liquidateMe();

        // totalBoldDeposits = 210.952427524467700142 ether
        // P = 0.000811774565916968 ether

        // coll = 735.237290720905222225 ether, debt = 98_031.638762787362963266 ether
        vm.prank(adam);
        handler.openTrove(98_022.239369971064368053 ether);

        vm.prank(adam);
        handler.provideToSp(370_408.786768579111584211 ether, false);

        // totalBoldDeposits = 370_619.739196103579284353 ether

        vm.prank(barb);
        handler.liquidateMe();

        // totalBoldDeposits = 272_610.340127738994143277 ether
        // P = 0.00059710295248084 ether

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(508.689744747380433717 ether, false);

        // totalBoldDeposits = 273_119.029872486374576994 ether

        vm.prank(eric);
        handler.provideToSp(0.000000000000011519 ether, false);

        // totalBoldDeposits = 273_119.029872486374588513 ether

        vm.prank(dana);
        handler.provideToSp(14_325.409601730288741627 ether, false);

        // totalBoldDeposits = 287_444.43947421666333014 ether

        vm.prank(hope);
        handler.liquidateMe();

        // totalBoldDeposits = 189_425.95145220850566442 ether
        // P = 0.000393490982450372 ether

        vm.prank(carl);
        handler.provideToSp(656.318601037450927984 ether, false);

        // totalBoldDeposits = 190_082.270053245956592404 ether

        // coll = 735.070479452062891793 ether, debt = 98_009.39726027505223895 ether
        vm.prank(carl);
        handler.openTrove(98_000.000000001079532694 ether);

        // pulling `deposited` from fixture
        vm.prank(eric);
        handler.provideToSp(38_613.597957640221586334 ether, false);

        // totalBoldDeposits = 228_695.868010886178178738 ether

        vm.prank(dana);
        handler.provideToSp(53_385.94712175149302094 ether, false);

        // totalBoldDeposits = 282_081.815132637671199678 ether

        vm.prank(carl);
        handler.provideToSp(6_856.901188404296809837 ether, false);

        // totalBoldDeposits = 288_938.716321041968009515 ether

        // coll = 15.001438356164383562 ether, debt = 2_000.191780821917808219 ether
        vm.prank(fran);
        handler.openTrove(2_000 ether);

        vm.prank(dana);
        handler.provideToSp(5_881.506587694815077057 ether, false);

        // totalBoldDeposits = 294_820.222908736783086572 ether

        // coll = 735.072533183874248984 ether, debt = 98_009.671091183233197827 ether
        vm.prank(hope);
        handler.openTrove(98_000.273804654019798669 ether);

        // pulling `deposited` from fixture
        vm.prank(carl);
        handler.provideToSp(98_018.795421655094877038 ether, false);

        // totalBoldDeposits = 392_839.01833039187796361 ether

        vm.prank(eric);
        handler.provideToSp(1_186.940091321995741882 ether, false);

        // totalBoldDeposits = 394_025.958421713873705492 ether

        vm.prank(adam);
        handler.provideToSp(0.001983727284992749 ether, false);

        invariant_allFundsClaimable();
    }

    function testSPYieldBigDispropRedeem() external {
        // coll = 490_098_347_574_376_811.735209341223553774 ether, debt = 65_346_446_343_250_241_564.694578829807169845 ether
        vm.prank(barb);
        handler.openTrove(65_340_180_846_456_745_712.365995789115062922 ether);

        // coll = 750_071_917_808_219_163.080753424657534401 ether, debt = 100_009_589_041_095_888_410.767123287671253375 ether
        vm.prank(gabe);
        handler.openTrove(99_999_999_999_999_998_000.000000000000020497 ether);

        // coll = 502_539_092_456_032_564.492320686560399734 ether, debt = 67_005_212_327_471_008_598.976091541386631089 ether
        vm.prank(hope);
        handler.openTrove(66_998_787_786_176_443_734.508398955185448923 ether);

        // pulling `deposited` from fixture
        vm.prank(carl);
        handler.provideToSp(65_346_446_343_250_241_630.04102517305741141 ether, false);

        // totalBoldDeposits = 65_346_446_343_250_241_630.04102517305741141 ether

        vm.prank(eric);
        handler.provideToSp(0.00000000000000052 ether, false);

        // totalBoldDeposits = 65_346_446_343_250_241_630.04102517305741193 ether

        vm.prank(barb);
        handler.liquidateMe();

        // totalBoldDeposits = 65.346446343250242085 ether
        // P = 1_000_000_000.000000006962260387 ether

        // coll = 53_550_456_698_134_716.302091267691508688 ether, debt = 7_140_060_893_084_628_840.27883569220115827 ether
        vm.prank(eric);
        handler.openTrove(7_139_376_295_357_676_734.290616044087341676 ether);

        // pulling `deposited` from fixture
        vm.prank(carl);
        handler.provideToSp(67_005_212_327_471_008_598.976091541386631089 ether, false);

        // totalBoldDeposits = 67_005_212_327_471_008_664.322537884636873174 ether

        vm.prank(hope);
        handler.liquidateMe();

        // totalBoldDeposits = 65.346446343250242085 ether
        // P = 975_244_224_641_600_008.705577453466833391 ether

        // coll = 570_376_835_580_790_313.880152031558999999 ether, debt = 76_050_244_744_105_375_184.020270874533333148 ether
        vm.prank(fran);
        handler.openTrove(76_042_952_954_096_078_299.799742132137100824 ether);

        // Very extreme edge case. It gets fixed with SCALE_SPAN = 3
        // invariant_allFundsClaimable();
    }
}
