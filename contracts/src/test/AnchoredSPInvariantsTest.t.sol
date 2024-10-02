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
        assertGe(yieldGainsOwed, sumYieldGains, "Not enough yield gains for all depositors");
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

    function testCollGainsUnderflow1CollDeep() external {
        // coll = 544.304998028561500062 ether, debt = 72_573.999737141533341526 ether
        vm.prank(dana);
        handler.openTrove(72_567.041253733641074574 ether);

        // pulling `deposited` from fixture
        vm.prank(eric);
        handler.provideToSp(6.958483407892266952 ether, false);

        // totalBoldDeposits = 6.958483407892266952 ether

        vm.prank(barb);
        handler.provideToSp(3_316.787992790864192928 ether, false);

        // totalBoldDeposits = 3_323.74647619875645988 ether

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(3_330.704959606648799406 ether, false);

        // totalBoldDeposits = 6_654.451435805405259286 ether

        // coll = 54.02394539800946315 ether, debt = 7_203.192719734595086581 ether
        vm.prank(eric);
        handler.openTrove(7_202.502068851280580224 ether);

        // coll = 212.073464521434261507 ether, debt = 28_276.461936191234867571 ether
        vm.prank(carl);
        handler.openTrove(28_273.750754612025495264 ether);

        // pulling `deposited` from fixture
        vm.prank(fran);
        handler.provideToSp(7_203.192719734595086581 ether, false);

        // totalBoldDeposits = 13_857.644155540000345867 ether

        // pulling `deposited` from fixture
        vm.prank(eric);
        handler.provideToSp(28_276.461936191234867571 ether, false);

        // totalBoldDeposits = 42_134.106091731235213438 ether

        vm.prank(carl);
        handler.liquidateMe();

        // totalBoldDeposits = 13_857.644155540000345867 ether
        // P = 0.328893750003148765 ether

        // coll = 212.093800333100700409 ether, debt = 28_279.173377746760054476 ether
        vm.prank(barb);
        handler.openTrove(28_276.461936191234867571 ether);

        vm.prank(eric);
        handler.provideToSp(0.000000000000014391 ether, false);

        // totalBoldDeposits = 13_857.644155540000360258 ether

        // coll = 735.070479452054794697 ether, debt = 98_009.397260273972626238 ether
        vm.prank(gabe);
        handler.openTrove(98_000.000000000000023497 ether);

        // pulling `deposited` from fixture
        vm.prank(adam);
        handler.provideToSp(28_279.173377746760054476 ether, false);

        // totalBoldDeposits = 42_136.817533286760414734 ether

        vm.prank(fran);
        handler.provideToSp(28_279.173377746760054476 ether, false);

        // totalBoldDeposits = 70_415.99091103352046921 ether

        vm.prank(barb);
        handler.liquidateMe();

        // totalBoldDeposits = 42_136.817533286760414734 ether
        // P = 0.196809499552886498 ether

        vm.prank(barb);
        handler.provideToSp(70_880.345231597472945064 ether, false);

        // totalBoldDeposits = 113_017.162764884233359798 ether

        vm.prank(dana);
        handler.provideToSp(0.00000011113609781 ether, false);

        // totalBoldDeposits = 113_017.162764995369457608 ether

        vm.prank(dana);
        handler.provideToSp(45_195.914060860661211082 ether, false);

        // totalBoldDeposits = 158_213.07682585603066869 ether

        vm.prank(barb);
        handler.provideToSp(7_983.849831607347650797 ether, false);

        // totalBoldDeposits = 166_196.926657463378319487 ether

        // coll = 735.070479452054794639 ether, debt = 98_009.397260273972618434 ether
        vm.prank(hope);
        handler.openTrove(98_000.000000000000015693 ether);

        vm.prank(carl);
        handler.provideToSp(0.00000000050183005 ether, false);

        // totalBoldDeposits = 166_196.926657463880149537 ether

        vm.prank(gabe);
        handler.liquidateMe();

        // totalBoldDeposits = 68_187.529397189907523299 ether
        // P = 0.080747302650593231 ether

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(7_203.192719734595086581 ether, false);

        // totalBoldDeposits = 75_390.72211692450260988 ether

        // coll = 212.114138094776477189 ether, debt = 28_281.885079303530291741 ether
        vm.prank(gabe);
        handler.openTrove(28_279.173377746760054476 ether);

        // coll = 750.071917808219178083 ether, debt = 100_009.589041095890410956 ether
        vm.prank(fran);
        handler.openTrove(99_999.999999999999999998 ether);

        vm.prank(dana);
        handler.provideToSp(103_026.554316456522732042 ether, false);

        // totalBoldDeposits = 178_417.276433381025341922 ether

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(98_009.397260273972724248 ether, false);

        // totalBoldDeposits = 276_426.67369365499806617 ether

        vm.prank(eric);
        handler.provideToSp(0.000000000000001628 ether, false);

        // totalBoldDeposits = 276_426.673693654998067798 ether

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(9_122.941722749175152479 ether, false);

        // totalBoldDeposits = 285_549.615416404173220277 ether

        // coll = 735.070479452054794618 ether, debt = 98_009.397260273972615637 ether
        vm.prank(adam);
        handler.openTrove(98_000.000000000000012897 ether);

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(7_203.192719734595086581 ether, false);

        // totalBoldDeposits = 292_752.808136138768306858 ether

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(28_276.461936191234895848 ether, false);

        // totalBoldDeposits = 321_029.270072330003202706 ether

        // pulling `deposited` from fixture
        vm.prank(hope);
        handler.provideToSp(14_980.123886945022979017 ether, false);

        // totalBoldDeposits = 336_009.393959275026181723 ether

        vm.prank(dana);
        handler.provideToSp(58_609.429095898825190413 ether, false);

        // totalBoldDeposits = 394_618.823055173851372136 ether

        vm.prank(hope);
        handler.liquidateMe();

        // totalBoldDeposits = 296_609.425794899878753702 ether
        // P = 0.060692520666533981 ether

        // coll = 15.001438356164383562 ether, debt = 2_000.191780821917808221 ether
        vm.prank(hope);
        handler.openTrove(2_000.000000000000000002 ether);

        vm.prank(fran);
        handler.liquidateMe();

        // totalBoldDeposits = 196_599.836753803988342746 ether
        // P = 0.04022845741749393 ether

        vm.prank(carl);
        handler.provideToSp(5_402.444298333327140135 ether, false);

        // totalBoldDeposits = 202_002.281052137315482881 ether

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 103_992.883791863342867244 ether
        // P = 0.020710029983590154 ether

        // pulling `deposited` from fixture
        vm.prank(fran);
        handler.provideToSp(4_127.357567584137008351 ether, false);

        // totalBoldDeposits = 108_120.241359447479875595 ether

        // coll = 212.134477806648579043 ether, debt = 28_284.597040886477205604 ether
        vm.prank(adam);
        handler.openTrove(28_281.885079303530291741 ether);

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(28_279.173377746760054476 ether, false);

        // totalBoldDeposits = 136_399.414737194239930071 ether

        // coll = 735.070479452054794543 ether, debt = 98_009.39726027397260569 ether
        vm.prank(barb);
        handler.openTrove(98_000.00000000000000295 ether);

        // coll = 735.070479452054794531 ether, debt = 98_009.397260273972604071 ether
        vm.prank(fran);
        handler.openTrove(98_000.000000000000001332 ether);

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 108_114.817696307762724467 ether
        // P = 0.016415474512665603 ether

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(28_279.173377746760054476 ether, false);

        // totalBoldDeposits = 136_393.991074054522778943 ether

        vm.prank(hope);
        handler.liquidateMe();

        // totalBoldDeposits = 134_393.799293232604970722 ether
        // P = 0.016174744719952827 ether

        // coll = 197.748067291146799374 ether, debt = 26_366.408972152906583169 ether
        vm.prank(hope);
        handler.openTrove(26_363.88092877617462122 ether);

        vm.prank(fran);
        handler.provideToSp(53_501.727764378375272893 ether, false);

        // totalBoldDeposits = 187_895.527057610980243615 ether

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(100_009.589041095890510966 ether, false);

        // totalBoldDeposits = 287_905.116098706870754581 ether

        vm.prank(barb);
        handler.liquidateMe();

        // totalBoldDeposits = 189_895.718838432898148891 ether
        // P = 0.010668496681283479 ether

        vm.prank(hope);
        handler.liquidateMe();

        // totalBoldDeposits = 163_529.309866279991565722 ether
        // P = 0.009187210276632602 ether

        // pulling `deposited` from fixture
        vm.prank(eric);
        handler.provideToSp(7_203.192719734595086581 ether, false);

        // totalBoldDeposits = 170_732.502586014586652303 ether

        vm.prank(gabe);
        handler.liquidateMe();

        // totalBoldDeposits = 142_450.617506711056360562 ether
        // P = 0.007665346417627682 ether

        // coll = 735.070479452054794678 ether, debt = 98_009.397260273972623677 ether
        vm.prank(gabe);
        handler.openTrove(98_000.000000000000020936 ether);

        vm.prank(gabe);
        handler.liquidateMe();

        // totalBoldDeposits = 44_441.220246437083736885 ether
        // P = 0.002391406610750427 ether

        // pulling `deposited` from fixture
        vm.prank(eric);
        handler.provideToSp(98_009.397260273972702081 ether, false);

        // totalBoldDeposits = 142_450.617506711056438966 ether

        // coll = 387.055734406178125123 ether, debt = 51_607.431254157083349661 ether
        vm.prank(adam);
        handler.openTrove(51_602.483070848919754617 ether);

        // pulling `deposited` from fixture
        vm.prank(carl);
        handler.provideToSp(11_114.168704751488694317 ether, false);

        // totalBoldDeposits = 153_564.786211462545133283 ether

        // coll = 261.726531711891681095 ether, debt = 34_896.870894918890812555 ether
        vm.prank(hope);
        handler.openTrove(34_893.524940472544130242 ether);

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 101_957.354957305461783622 ether
        // P = 0.00158774350992017 ether

        vm.prank(carl);
        handler.provideToSp(0.049730355963373855 ether, false);

        // totalBoldDeposits = 101_957.404687661425157477 ether

        // pulling `deposited` from fixture
        vm.prank(fran);
        handler.provideToSp(28_284.597040886477205604 ether, false);

        // totalBoldDeposits = 130_242.001728547902363081 ether

        vm.prank(fran);
        handler.provideToSp(48_667.900292985662359538 ether, false);

        // totalBoldDeposits = 178_909.902021533564722619 ether

        vm.prank(dana);
        handler.liquidateMe();

        // totalBoldDeposits = 106_335.902284392031381093 ether
        // P = 0.000943682472662849 ether

        vm.prank(fran);
        handler.liquidateMe();

        // totalBoldDeposits = 8_326.505024118058777022 ether
        // P = 0.000073893921817529 ether

        // coll = 151.470551994044601936 ether, debt = 20_196.073599205946924742 ether
        vm.prank(gabe);
        handler.openTrove(20_194.137175093266748479 ether);

        // coll = 212.093800333100700409 ether, debt = 28_279.173377746760054476 ether
        vm.prank(fran);
        handler.openTrove(28_276.461936191234867571 ether);

        vm.prank(eric);
        handler.liquidateMe();

        // totalBoldDeposits = 1_123.312304383463690441 ether
        // P = 0.000009968882665217 ether

        vm.prank(dana);
        handler.provideToSp(2_852.053480319991176208 ether, false);

        // totalBoldDeposits = 3_975.365784703454866649 ether

        // coll = 735.070479452079782458 ether, debt = 98_009.397260277304327642 ether
        vm.prank(adam);
        handler.openTrove(98_000.000000003331405453 ether);

        // pulling `deposited` from fixture
        vm.prank(fran);
        handler.provideToSp(100_009.589041095890510966 ether, false);

        // totalBoldDeposits = 103_984.954825799345377615 ether

        // coll = 735.070479452054794621 ether, debt = 98_009.397260273972616078 ether
        vm.prank(dana);
        handler.openTrove(98_000.000000000000013337 ether);

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 5_975.557565522041049973 ether
        // P = 0.000000572867799286 ether

        vm.prank(eric);
        handler.provideToSp(52_006.981742593048111854 ether, false);

        // totalBoldDeposits = 57_982.539308115089161827 ether

        // pulling `deposited` from fixture
        vm.prank(fran);
        handler.provideToSp(20_196.073599205946944939 ether, false);

        // totalBoldDeposits = 78_178.612907321036106766 ether

        // coll = 15.002876850253330832 ether, debt = 2_000.383580033777444175 ether
        vm.prank(adam);
        handler.openTrove(2_000.191780821917808221 ether);

        vm.prank(adam);
        handler.provideToSp(17_475.158101181705619252 ether, false);

        // totalBoldDeposits = 95_653.771008502741726018 ether

        // pulling `deposited` from fixture
        vm.prank(adam);
        handler.provideToSp(10_332.149862223406230478 ether, false);

        // totalBoldDeposits = 105_985.920870726147956496 ether

        vm.prank(fran);
        handler.provideToSp(0.000000000000020212 ether, false);

        // totalBoldDeposits = 105_985.920870726147976708 ether

        vm.prank(adam);
        handler.provideToSp(77_345.143414797930027166 ether, false);

        // totalBoldDeposits = 183_331.064285524078003874 ether

        vm.prank(barb);
        handler.provideToSp(0.000000000000000001 ether, false);

        // totalBoldDeposits = 183_331.064285524078003875 ether

        // coll = 735.140965662413210834 ether, debt = 98_018.795421655094777835 ether
        vm.prank(carl);
        handler.openTrove(98_009.397260273972616078 ether);

        vm.prank(carl);
        handler.provideToSp(28_281.885079303530291741 ether, false);

        // totalBoldDeposits = 211_612.949364827608295616 ether

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 209_612.565784793830851441 ether
        // P = 0.000000567452462736 ether

        // coll = 735.116261563280042202 ether, debt = 98_015.501541770672293587 ether
        vm.prank(adam);
        handler.openTrove(98_006.103696210761672605 ether);

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 111_597.064243023158557854 ether
        // P = 0.000000302109888793 ether

        vm.prank(dana);
        handler.liquidateMe();

        // totalBoldDeposits = 13_587.666982749185941776 ether
        // P = 0.000000036783840049 ether

        // coll = 735.140965662413210891 ether, debt = 98_018.795421655094785435 ether
        vm.prank(eric);
        handler.openTrove(98_009.397260273972623677 ether);

        // pulling `deposited` from fixture
        vm.prank(carl);
        handler.provideToSp(98_015.501541770672391603 ether, false);

        // totalBoldDeposits = 111_603.168524519858333379 ether

        vm.prank(adam);
        handler.provideToSp(31_612.330986009193455818 ether, false);

        // totalBoldDeposits = 143_215.499510529051789197 ether

        // coll = 497.18795568613956868 ether, debt = 66_291.727424818609157294 ether
        vm.prank(barb);
        handler.openTrove(66_285.371293324728703857 ether);

        vm.prank(gabe);
        handler.liquidateMe();

        // totalBoldDeposits = 123_019.425911323104864455 ether
        // P = 0.000000031596628166 ether

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(2_000.383580033777444175 ether, false);

        // totalBoldDeposits = 125_019.80949135688230863 ether

        // pulling `deposited` from fixture
        vm.prank(barb);
        handler.provideToSp(98_009.397260273972626238 ether, false);

        // totalBoldDeposits = 223_029.206751630854934868 ether

        vm.prank(hope);
        handler.liquidateMe();

        // totalBoldDeposits = 188_132.335856711964122313 ether
        // P = 0.000000026652775879 ether

        // coll = 443.918121581534570342 ether, debt = 59_189.082877537942712236 ether
        vm.prank(hope);
        handler.openTrove(59_183.407756246247866551 ether);

        // pulling `deposited` from fixture
        vm.prank(eric);
        handler.provideToSp(28_281.885079303530291741 ether, false);

        // totalBoldDeposits = 216_414.220936015494414054 ether

        vm.prank(hope);
        handler.provideToSp(7_203.192719734595086581 ether, false);

        // totalBoldDeposits = 223_617.413655750089500635 ether

        vm.prank(eric);
        handler.liquidateMe();

        // totalBoldDeposits = 125_598.6182340949947152 ether
        // P = 0.000000014969996154 ether

        // pulling `deposited` from fixture
        vm.prank(fran);
        handler.provideToSp(28_284.597040886477233889 ether, false);

        // totalBoldDeposits = 153_883.215274981471949089 ether

        vm.prank(fran);
        handler.provideToSp(0.000000232148155373 ether, false);

        // totalBoldDeposits = 153_883.215275213620104462 ether

        vm.prank(barb);
        handler.provideToSp(0.000000000000014235 ether, false);

        // totalBoldDeposits = 153_883.215275213620118697 ether

        // coll = 170.932345052439560746 ether, debt = 22_790.979340325274766096 ether
        vm.prank(adam);
        handler.openTrove(22_788.794113492474117893 ether);

        vm.prank(barb);
        handler.liquidateMe();

        // totalBoldDeposits = 87_591.487850395010961403 ether
        // P = 0.000000008521034824 ether

        // coll = 735.070479452054844487 ether, debt = 98_009.397260273979264887 ether
        vm.prank(eric);
        handler.openTrove(98_000.000000000006661509 ether);

        vm.prank(barb);
        handler.provideToSp(0.000000000000019157 ether, false);

        // totalBoldDeposits = 87_591.48785039501098056 ether

        vm.prank(barb);
        handler.provideToSp(125_482.693298298766496276 ether, false);

        // totalBoldDeposits = 213_074.181148693777476836 ether

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(72_573.999737141533341526 ether, false);

        // totalBoldDeposits = 285_648.180885835310818362 ether

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(7_697.523863364741437469 ether, false);

        // totalBoldDeposits = 293_345.704749200052255831 ether

        vm.prank(barb);
        handler.provideToSp(10_695.146175949584310071 ether, false);

        // totalBoldDeposits = 304_040.850925149636565902 ether

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 281_249.871584824361799806 ether
        // P = 0.000000007882295892 ether

        vm.prank(eric);
        handler.liquidateMe();

        // totalBoldDeposits = 183_240.474324550382534919 ether
        // P = 0.000000005135489057 ether

        // coll = 15.001438356164383562 ether, debt = 2_000.19178082191780822 ether
        vm.prank(barb);
        handler.openTrove(2_000.000000000000000001 ether);

        vm.prank(hope);
        handler.liquidateMe();

        // totalBoldDeposits = 124_051.391447012439822683 ether
        // P = 0.000000003476658558 ether

        // coll = 387.092849339614333984 ether, debt = 51_612.379911948577864502 ether
        vm.prank(eric);
        handler.openTrove(51_607.431254157083349661 ether);

        vm.prank(barb);
        handler.liquidateMe();

        // totalBoldDeposits = 122_051.199666190522014463 ether
        // P = 0.000000003420601276 ether

        // pulling `deposited` from fixture
        vm.prank(fran);
        handler.provideToSp(28_284.597040886477233889 ether, false);

        // totalBoldDeposits = 150_335.796707076999248352 ether

        vm.prank(gabe);
        handler.provideToSp(15_486.177794212508715247 ether, false);

        // totalBoldDeposits = 165_821.974501289507963599 ether

        // coll = 15.001438356164383562 ether, debt = 2_000.191780821917808219 ether
        vm.prank(hope);
        handler.openTrove(2_000 ether);

        vm.prank(gabe);
        handler.provideToSp(2_210.99055961415947915 ether, false);

        // totalBoldDeposits = 168_032.965060903667442749 ether

        // pulling `deposited` from fixture
        vm.prank(adam);
        handler.provideToSp(3_491.628702974305045589 ether, false);

        // totalBoldDeposits = 171_524.593763877972488338 ether

        vm.prank(eric);
        handler.liquidateMe();

        // totalBoldDeposits = 119_912.213851929394623836 ether
        // P = 0.000000002391329796 ether

        // coll = 735.070479452054794524 ether, debt = 98_009.397260273972603177 ether
        vm.prank(adam);
        handler.openTrove(98_000.000000000000000438 ether);

        // coll = 213.264056925706413656 ether, debt = 28_435.207590094188487431 ether
        vm.prank(gabe);
        handler.openTrove(28_432.481187788510137144 ether);

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 21_902.816591655422020659 ether
        // P = 0.436793352815794323 ether

        // pulling `deposited` from fixture
        vm.prank(carl);
        handler.provideToSp(20_196.073599205946924742 ether, false);

        // totalBoldDeposits = 42_098.890190861368945401 ether

        // coll = 197.767029434585676465 ether, debt = 26_368.937257944756861882 ether
        vm.prank(dana);
        handler.openTrove(26_366.408972152906583169 ether);

        vm.prank(hope);
        handler.provideToSp(118_362.452448773787997761 ether, false);

        // totalBoldDeposits = 160_461.342639635156943162 ether

        // pulling `deposited` from fixture
        vm.prank(adam);
        handler.provideToSp(7_718.428390404075875511 ether, false);

        // totalBoldDeposits = 168_179.771030039232818673 ether

        vm.prank(carl);
        handler.liquidateMe();

        // totalBoldDeposits = 70_160.975608384138040838 ether
        // P = 0.182220772362328287 ether

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(6_866.774931095217580838 ether, false);

        // totalBoldDeposits = 77_027.750539479355621676 ether

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(2_134.549253087445261453 ether, false);

        // totalBoldDeposits = 79_162.299792566800883129 ether

        vm.prank(gabe);
        handler.provideToSp(5_371.066727816941678925 ether, false);

        // totalBoldDeposits = 84_533.366520383742562054 ether

        // coll = 735.070479452054794551 ether, debt = 98_009.397260273972606767 ether
        vm.prank(eric);
        handler.openTrove(98_000.000000000000004027 ether);

        // coll = 735.070479452054794529 ether, debt = 98_009.397260273972603757 ether
        vm.prank(carl);
        handler.openTrove(98_000.000000000000001018 ether);

        // coll = 661.284015816160857429 ether, debt = 88_171.202108821447657074 ether
        vm.prank(adam);
        handler.openTrove(88_162.748146670397071054 ether);

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(7_203.192719734595093785 ether, false);

        // totalBoldDeposits = 91_736.559240118337655839 ether

        vm.prank(adam);
        handler.provideToSp(169_355.451545285381203938 ether, false);

        // totalBoldDeposits = 261_092.010785403718859777 ether

        vm.prank(eric);
        handler.provideToSp(0.000000001300773669 ether, false);

        // totalBoldDeposits = 261_092.010785405019633446 ether

        vm.prank(gabe);
        handler.liquidateMe();

        // totalBoldDeposits = 232_656.803195310831146015 ether
        // P = 0.162375333684356504 ether

        // pulling `deposited` from fixture
        vm.prank(adam);
        handler.provideToSp(28_279.173377746760082756 ether, false);

        // totalBoldDeposits = 260_935.976573057591228771 ether

        vm.prank(carl);
        handler.liquidateMe();

        // totalBoldDeposits = 162_926.579312783618625014 ether
        // P = 0.101386010581630156 ether

        vm.prank(eric);
        handler.liquidateMe();

        // totalBoldDeposits = 64_917.182052509646018247 ether
        // P = 0.040396687478903808 ether

        vm.prank(hope);
        handler.liquidateMe();

        // totalBoldDeposits = 62_916.990271687728210028 ether
        // P = 0.039152007415582862 ether

        // pulling `deposited` from fixture
        vm.prank(fran);
        handler.provideToSp(28_276.461936191234867571 ether, false);

        // totalBoldDeposits = 91_193.452207878963077599 ether

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 3_022.250099057515420525 ether
        // P = 0.001297540069218068 ether

        // coll = 735.140654259986691808 ether, debt = 98_018.753901331558907716 ether
        vm.prank(hope);
        handler.openTrove(98_009.355743931455891398 ether);

        vm.prank(dana);
        handler.provideToSp(40_955.227054936825038894 ether, false);

        // totalBoldDeposits = 43_977.477153994340459419 ether

        vm.prank(barb);
        handler.provideToSp(21_183.197275633065138814 ether, false);

        // totalBoldDeposits = 65_160.674429627405598233 ether

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(10_597.35431639066253481 ether, false);

        // totalBoldDeposits = 75_758.028746018068133043 ether

        // coll = 15.001438356164383562 ether, debt = 2_000.19178082191780822 ether
        vm.prank(barb);
        handler.openTrove(2_000.000000000000000001 ether);

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(19_191.171884798977347577 ether, false);

        // totalBoldDeposits = 94_949.20063081704548062 ether

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(38_376.219974865978882777 ether, false);

        // totalBoldDeposits = 133_325.420605683024363397 ether

        // coll = 27.082376666417516489 ether, debt = 3_610.983555522335531794 ether
        vm.prank(adam);
        handler.openTrove(3_610.637330024935880409 ether);

        // coll = 151.485076567523482925 ether, debt = 20_198.010209003131056638 ether
        vm.prank(eric);
        handler.openTrove(20_196.073599205946924742 ether);

        vm.prank(hope);
        handler.provideToSp(45_063.668239772897643351 ether, false);

        // totalBoldDeposits = 178_389.088845455922006748 ether

        // pulling `deposited` from fixture
        vm.prank(hope);
        handler.provideToSp(1.099153507842646919 ether, false);

        // totalBoldDeposits = 178_390.187998963764653667 ether

        vm.prank(hope);
        handler.provideToSp(0.00000000001368704 ether, false);

        // totalBoldDeposits = 178_390.187998963778340707 ether

        // pulling `deposited` from fixture
        vm.prank(hope);
        handler.provideToSp(1.109803997904305171 ether, false);

        // totalBoldDeposits = 178_391.297802961682645878 ether

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 174_780.314247439347114084 ether
        // P = 0.001271275358381372 ether

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(6.738011572562381246 ether, false);

        // totalBoldDeposits = 174_787.05225901190949533 ether

        vm.prank(dana);
        handler.liquidateMe();

        // totalBoldDeposits = 148_418.115001067152633448 ether
        // P = 0.001079486666201507 ether

        // coll = 517.646580268358284784 ether, debt = 69_019.544035781104637756 ether
        vm.prank(adam);
        handler.openTrove(69_012.926357911167950419 ether);

        vm.prank(adam);
        handler.provideToSp(40_474.031081466471471988 ether, false);

        // totalBoldDeposits = 188_892.146082533624105436 ether

        vm.prank(carl);
        handler.provideToSp(0.010654065586010047 ether, false);

        // totalBoldDeposits = 188_892.156736599210115483 ether

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(7_203.192719734595093785 ether, false);

        // totalBoldDeposits = 196_095.349456333805209268 ether

        vm.prank(eric);
        handler.provideToSp(21_348.717284693164989548 ether, false);

        // totalBoldDeposits = 217_444.066741026970198816 ether

        // coll = 15.002876850253330832 ether, debt = 2_000.383580033777444173 ether
        vm.prank(gabe);
        handler.openTrove(2_000.191780821917808219 ether);

        // coll = 735.211147199436279573 ether, debt = 98_028.152959924837276378 ether
        vm.prank(carl);
        handler.openTrove(98_018.753901331558907716 ether);

        vm.prank(eric);
        handler.liquidateMe();

        // totalBoldDeposits = 197_246.056532023839142178 ether
        // P = 0.000979214982401606 ether

        // coll = 735.140965662413210744 ether, debt = 98_018.795421655094765827 ether
        vm.prank(dana);
        handler.openTrove(98_009.397260273972604071 ether);

        vm.prank(fran);
        handler.provideToSp(64_349.693803520460900733 ether, false);

        // totalBoldDeposits = 261_595.750335544300042911 ether

        // pulling `deposited` from fixture
        vm.prank(carl);
        handler.provideToSp(20_198.010209003131056638 ether, false);

        // totalBoldDeposits = 281_793.760544547431099549 ether

        // pulling `deposited` from fixture
        vm.prank(carl);
        handler.provideToSp(2_000.191780821917808219 ether, false);

        // totalBoldDeposits = 283_793.952325369348907768 ether

        // coll = 16.433936029743427258 ether, debt = 2_191.191470632456967713 ether
        vm.prank(eric);
        handler.openTrove(2_190.981376527858405949 ether);

        vm.prank(eric);
        handler.provideToSp(0.000000000000000003 ether, false);

        // totalBoldDeposits = 283_793.952325369348907771 ether

        // pulling `deposited` from fixture
        vm.prank(hope);
        handler.provideToSp(2_000.383580033777446176 ether, false);

        // totalBoldDeposits = 285_794.335905403126353947 ether

        vm.prank(carl);
        handler.liquidateMe();

        // totalBoldDeposits = 187_766.182945478289077569 ether
        // P = 0.00064334185961415 ether

        vm.prank(barb);
        handler.provideToSp(23_862.208877916221456296 ether, false);

        // totalBoldDeposits = 211_628.391823394510533865 ether

        vm.prank(hope);
        handler.provideToSp(26_368.937257944756861882 ether, false);

        // totalBoldDeposits = 237_997.329081339267395747 ether

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 168_977.785045558162757991 ether
        // P = 0.00045677185909736 ether

        vm.prank(eric);
        handler.liquidateMe();

        // totalBoldDeposits = 166_786.593574925705790278 ether
        // P = 0.00045084874558626 ether

        // pulling `deposited` from fixture
        vm.prank(carl);
        handler.provideToSp(28_279.173377746760054476 ether, false);

        // totalBoldDeposits = 195_065.766952672465844754 ether

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(31_669.587953377532084414 ether, false);

        // totalBoldDeposits = 226_735.354906049997929168 ether

        // coll = 735.070479479623171012 ether, debt = 98_009.397263949756134816 ether
        vm.prank(eric);
        handler.openTrove(98_000.000003675431093479 ether);

        // coll = 212.154819468904011098 ether, debt = 28_287.309262520534813007 ether
        vm.prank(adam);
        handler.openTrove(28_284.597040886477205604 ether);

        vm.prank(dana);
        handler.liquidateMe();

        // totalBoldDeposits = 128_716.559484394903163341 ether
        // P = 0.000255944642615461 ether

        vm.prank(eric);
        handler.liquidateMe();

        // totalBoldDeposits = 30_707.162220445147028525 ether
        // P = 0.000061059227279918 ether

        vm.prank(fran);
        handler.provideToSp(0.00000000000001447 ether, false);

        // totalBoldDeposits = 30_707.162220445147042995 ether

        // pulling `deposited` from fixture
        vm.prank(adam);
        handler.provideToSp(98_009.397260273972603757 ether, false);

        // totalBoldDeposits = 128_716.559480719119646752 ether

        // pulling `deposited` from fixture
        vm.prank(adam);
        handler.provideToSp(7_203.192719734595093785 ether, false);

        // totalBoldDeposits = 135_919.752200453714740537 ether

        // pulling `deposited` from fixture
        vm.prank(barb);
        handler.provideToSp(20_430.963516910854734298 ether, false);

        // totalBoldDeposits = 156_350.715717364569474835 ether

        // coll = 735.07060480817355789 ether, debt = 98_009.413974423141051906 ether
        vm.prank(carl);
        handler.openTrove(98_000.016712546595487956 ether);

        vm.prank(gabe);
        handler.liquidateMe();

        // totalBoldDeposits = 154_350.332137330792030662 ether
        // P = 0.000060278022824921 ether

        // coll = 735.070479452054794702 ether, debt = 98_009.397260273972626926 ether
        vm.prank(dana);
        handler.openTrove(98_000.000000000000024184 ether);

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(3_610.983555522335535405 ether, false);

        // totalBoldDeposits = 157_961.315692853127566067 ether

        // pulling `deposited` from fixture
        vm.prank(eric);
        handler.provideToSp(98_009.397260277304327642 ether, false);

        // totalBoldDeposits = 255_970.712953130431893709 ether

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(51_612.379911948577916115 ether, false);

        // totalBoldDeposits = 307_583.092865079009809824 ether

        vm.prank(carl);
        handler.provideToSp(43_392.91760181421015885 ether, false);

        // totalBoldDeposits = 350_976.010466893219968674 ether

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 322_688.701204372685155667 ether
        // P = 0.000055419847272941 ether

        vm.prank(fran);
        handler.provideToSp(0.000000000000005437 ether, false);

        // totalBoldDeposits = 322_688.701204372685161104 ether

        // coll = 735.07047945205479453 ether, debt = 98_009.397260273972603928 ether
        vm.prank(adam);
        handler.openTrove(98_000.000000000000001189 ether);

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 224_679.303944098712557176 ether
        // P = 0.00003858732166171 ether

        vm.prank(dana);
        handler.liquidateMe();

        // totalBoldDeposits = 126_669.90668382473993025 ether
        // P = 0.000021754796050479 ether

        vm.prank(gabe);
        handler.provideToSp(5_966.758068024307190228 ether, false);

        // totalBoldDeposits = 132_636.664751849047120478 ether

        vm.prank(carl);
        handler.provideToSp(0.012820845162158187 ether, false);

        // totalBoldDeposits = 132_636.677572694209278665 ether

        vm.prank(fran);
        handler.provideToSp(58_077.35957209945457682 ether, false);

        // totalBoldDeposits = 190_714.037144793663855485 ether

        // coll = 735.070491735654094392 ether, debt = 98_009.398898087212585509 ether
        vm.prank(gabe);
        handler.openTrove(98_000.001637656204456315 ether);

        // pulling `deposited` from fixture
        vm.prank(hope);
        handler.provideToSp(22_790.979340325274766096 ether, false);

        // totalBoldDeposits = 213_505.016485118938621581 ether

        // coll = 76.407411375152727949 ether, debt = 10_187.654850020363726401 ether
        vm.prank(eric);
        handler.openTrove(10_186.678045276296136361 ether);

        // pulling `deposited` from fixture
        vm.prank(fran);
        handler.provideToSp(98_028.152959924837374407 ether, false);

        // totalBoldDeposits = 311_533.169445043775995988 ether

        vm.prank(barb);
        handler.provideToSp(18_840.018039105368775261 ether, false);

        // totalBoldDeposits = 330_373.187484149144771249 ether

        // coll = 193.633357658356869418 ether, debt = 25_817.781021114249255706 ether
        vm.prank(dana);
        handler.openTrove(25_815.305580853071563913 ether);

        vm.prank(eric);
        handler.provideToSp(0.00000000000000108 ether, false);

        // totalBoldDeposits = 330_373.187484149144772329 ether

        // pulling `deposited` from fixture
        vm.prank(hope);
        handler.provideToSp(28_435.207590094188487431 ether, false);

        // totalBoldDeposits = 358_808.39507424333325976 ether

        vm.prank(hope);
        handler.provideToSp(0.000000000000010222 ether, false);

        // totalBoldDeposits = 358_808.395074243333269982 ether

        vm.prank(dana);
        handler.provideToSp(1_320.983509178266986989 ether, false);

        // totalBoldDeposits = 360_129.378583421600256971 ether

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(0.964444671443677399 ether, false);

        // totalBoldDeposits = 360_130.34302809304393437 ether

        vm.prank(carl);
        handler.liquidateMe();

        // totalBoldDeposits = 262_120.929053669902882464 ether
        // P = 0.000015834231862212 ether

        vm.prank(hope);
        handler.provideToSp(36.04838160213574232 ether, false);

        // totalBoldDeposits = 262_156.977435272038624784 ether

        vm.prank(carl);
        handler.provideToSp(0.00000004745079447 ether, false);

        // totalBoldDeposits = 262_156.977435319489419254 ether

        // coll = 517.696217611671689003 ether, debt = 69_026.162348222891866967 ether
        vm.prank(carl);
        handler.openTrove(69_019.544035781104637756 ether);

        vm.prank(fran);
        handler.liquidateMe();

        // totalBoldDeposits = 233_877.804057572729364778 ether
        // P = 0.000014126175137895 ether

        // pulling `deposited` from fixture
        vm.prank(carl);
        handler.provideToSp(28_940.54751420239501101 ether, false);

        // totalBoldDeposits = 262_818.351571775124375788 ether

        vm.prank(fran);
        handler.provideToSp(0.000000000000000003 ether, false);

        // totalBoldDeposits = 262_818.351571775124375791 ether

        vm.prank(barb);
        handler.liquidateMe();

        // totalBoldDeposits = 260_818.159790953206567571 ether
        // P = 0.000014018667198528 ether

        // coll = 750.071917808219178083 ether, debt = 100_009.589041095890410956 ether
        vm.prank(adam);
        handler.openTrove(99_999.999999999999999998 ether);

        // pulling `deposited` from fixture
        vm.prank(fran);
        handler.provideToSp(3_610.983555522335531794 ether, false);

        // totalBoldDeposits = 264_429.143346475542099365 ether

        vm.prank(dana);
        handler.liquidateMe();

        // totalBoldDeposits = 238_611.362325361292843659 ether
        // P = 0.00001264994181766 ether

        vm.prank(adam);
        handler.provideToSp(1_200.684027535573554832 ether, false);

        // totalBoldDeposits = 239_812.046352896866398491 ether

        vm.prank(hope);
        handler.liquidateMe();

        // totalBoldDeposits = 141_793.292451565307490775 ether
        // P = 0.000007479511254439 ether

        vm.prank(gabe);
        handler.liquidateMe();

        // totalBoldDeposits = 43_783.893553478094905266 ether
        // P = 0.000002309574162037 ether

        vm.prank(carl);
        handler.provideToSp(106_825.887204152091547508 ether, false);

        // totalBoldDeposits = 150_609.780757630186452774 ether

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 50_600.191716534296041818 ether
        // P = 0.000000775944927313 ether

        // coll = 735.070479455018001563 ether, debt = 98_009.397260669066875052 ether
        vm.prank(hope);
        handler.openTrove(98_000.000000395056390193 ether);

        vm.prank(carl);
        handler.provideToSp(5_708.250732151631567845 ether, false);

        // totalBoldDeposits = 56_308.442448685927609663 ether

        vm.prank(carl);
        handler.provideToSp(81_053.660208964921071107 ether, false);

        // totalBoldDeposits = 137_362.10265765084868077 ether

        vm.prank(fran);
        handler.provideToSp(31_329.389054002845513915 ether, false);

        // totalBoldDeposits = 168_691.491711653694194685 ether

        vm.prank(carl);
        handler.liquidateMe();

        // totalBoldDeposits = 99_665.329363430802327718 ether
        // P = 0.000000458439284423 ether

        // coll = 15.001438356164383562 ether, debt = 2_000.19178082191780822 ether
        vm.prank(fran);
        handler.openTrove(2_000.000000000000000001 ether);

        // pulling `deposited` from fixture
        vm.prank(eric);
        handler.provideToSp(4_125.857325965774507712 ether, false);

        // totalBoldDeposits = 103_791.18668939657683543 ether

        vm.prank(gabe);
        handler.provideToSp(6_158.378764443511857106 ether, false);

        // totalBoldDeposits = 109_949.565453840088692536 ether

        // coll = 443.960689072645128452 ether, debt = 59_194.758543019350460167 ether
        vm.prank(dana);
        handler.openTrove(59_189.082877537942712236 ether);

        vm.prank(adam);
        handler.provideToSp(38_669.837411800794048741 ether, false);

        // totalBoldDeposits = 148_619.402865640882741277 ether

        // coll = 608.165542922133951899 ether, debt = 81_088.739056284526919848 ether
        vm.prank(gabe);
        handler.openTrove(81_080.964169309387663497 ether);

        // pulling `deposited` from fixture
        vm.prank(barb);
        handler.provideToSp(98_009.397260273972616078 ether, false);

        // totalBoldDeposits = 246_628.800125914855357355 ether

        vm.prank(hope);
        handler.provideToSp(700.179491275546795139 ether, false);

        // totalBoldDeposits = 247_328.979617190402152494 ether

        // pulling `deposited` from fixture
        vm.prank(barb);
        handler.provideToSp(1_114.342911790312239349 ether, false);

        // totalBoldDeposits = 248_443.322528980714391843 ether

        vm.prank(eric);
        handler.liquidateMe();

        // totalBoldDeposits = 238_255.667678960350665442 ether
        // P = 0.000000439640545331 ether

        // coll = 143.285786476507227958 ether, debt = 19_104.771530200963727709 ether
        vm.prank(eric);
        handler.openTrove(19_102.939741458632078058 ether);

        vm.prank(dana);
        handler.liquidateMe();

        // totalBoldDeposits = 179_060.909135941000205275 ether
        // P = 0.000000330411597368 ether

        // pulling `deposited` from fixture
        vm.prank(hope);
        handler.provideToSp(13_877.310326107221825752 ether, false);

        // totalBoldDeposits = 192_938.219462048222031027 ether

        vm.prank(eric);
        handler.liquidateMe();

        // totalBoldDeposits = 173_833.447931847258303318 ether
        // P = 0.000000297694191266 ether

        vm.prank(fran);
        handler.liquidateMe();

        // totalBoldDeposits = 171_833.256151025340495098 ether
        // P = 0.000000294268812079 ether

        vm.prank(carl);
        handler.provideToSp(991.554779447762634754 ether, false);

        // totalBoldDeposits = 172_824.810930473103129852 ether

        // pulling `deposited` from fixture
        vm.prank(eric);
        handler.provideToSp(3_606.586198797072017743 ether, false);

        // totalBoldDeposits = 176_431.397129270175147595 ether

        vm.prank(eric);
        handler.provideToSp(587.339419783342194551 ether, false);

        // totalBoldDeposits = 177_018.736549053517342146 ether

        // coll = 500.857826775587502992 ether, debt = 66_781.043570078333732179 ether
        vm.prank(fran);
        handler.openTrove(66_774.640522357011826936 ether);

        // coll = 735.369505324153573118 ether, debt = 98_049.267376553809749034 ether
        vm.prank(dana);
        handler.openTrove(98_039.866293484571502452 ether);

        vm.prank(fran);
        handler.liquidateMe();

        // totalBoldDeposits = 110_237.692978975183609967 ether
        // P = 0.000000183254697167 ether

        // coll = 750.071917808219178083 ether, debt = 100_009.589041095890410955 ether
        vm.prank(barb);
        handler.openTrove(99_999.999999999999999997 ether);

        // coll = 278.239501960215884977 ether, debt = 37_098.600261362117996907 ether
        vm.prank(carl);
        handler.openTrove(37_095.04320242489917096 ether);

        // pulling `deposited` from fixture
        vm.prank(hope);
        handler.provideToSp(98_009.397260273979362897 ether, false);

        // totalBoldDeposits = 208_247.090239249162972864 ether

        vm.prank(fran);
        handler.provideToSp(188_066.550586338573484215 ether, false);

        // totalBoldDeposits = 396_313.640825587736457079 ether

        vm.prank(barb);
        handler.liquidateMe();

        // totalBoldDeposits = 296_304.051784491846046124 ether
        // P = 0.000000137010447498 ether

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(10_619.918266821517099228 ether, false);

        // totalBoldDeposits = 306_923.970051313363145352 ether

        vm.prank(barb);
        handler.provideToSp(0.000000000000000001 ether, false);

        // totalBoldDeposits = 306_923.970051313363145353 ether

        vm.prank(carl);
        handler.liquidateMe();

        // totalBoldDeposits = 269_825.369789951245148446 ether
        // P = 0.000000120449682229 ether

        vm.prank(hope);
        handler.provideToSp(5_260.555739098740315187 ether, false);

        // totalBoldDeposits = 275_085.925529049985463633 ether

        vm.prank(dana);
        handler.liquidateMe();

        // totalBoldDeposits = 177_036.658152496175714599 ether
        // P = 0.000000077517630814 ether

        vm.prank(hope);
        handler.liquidateMe();

        // totalBoldDeposits = 79_027.260891827108839547 ether
        // P = 0.000000034603037009 ether

        vm.prank(hope);
        handler.provideToSp(735.070479452054794529 ether, false);

        // totalBoldDeposits = 79_762.331371279163634076 ether

        vm.prank(hope);
        handler.provideToSp(0.000000000000861025 ether, false);

        // totalBoldDeposits = 79_762.331371279164495101 ether

        // coll = 735.070479452069202438 ether, debt = 98_009.397260275893658302 ether
        vm.prank(fran);
        handler.openTrove(98_000.00000000192087137 ether);

        // coll = 508.601353210050790499 ether, debt = 67_813.513761340105399857 ether
        vm.prank(eric);
        handler.openTrove(67_807.011719120463711556 ether);

        // coll = 319.684290785467252668 ether, debt = 42_624.572104728967022286 ether
        vm.prank(carl);
        handler.openTrove(42_620.485208887018951976 ether);

        vm.prank(hope);
        handler.provideToSp(14_056.341287047622549574 ether, false);

        // totalBoldDeposits = 93_818.672658326787044675 ether

        // coll = 735.070479452054794522 ether, debt = 98_009.397260273972602903 ether
        vm.prank(dana);
        handler.openTrove(98_000.000000000000000164 ether);

        // coll = 544.357191658509444315 ether, debt = 72_580.958887801259241983 ether
        vm.prank(barb);
        handler.openTrove(72_573.999737141533341526 ether);

        vm.prank(adam);
        handler.provideToSp(3_610.983555522335531794 ether, false);

        // totalBoldDeposits = 97_429.656213849122576469 ether

        vm.prank(carl);
        handler.liquidateMe();

        // totalBoldDeposits = 54_805.084109120155554183 ether
        // P = 0.000000019464528845 ether

        // coll = 15.001438356164383562 ether, debt = 2_000.191780821917808219 ether
        vm.prank(hope);
        handler.openTrove(2_000 ether);

        vm.prank(carl);
        handler.provideToSp(8_443.061629342576891915 ether, false);

        // totalBoldDeposits = 63_248.145738462732446098 ether

        vm.prank(carl);
        handler.provideToSp(72_580.958887801259241983 ether, false);

        // totalBoldDeposits = 135_829.104626263991688081 ether

        vm.prank(hope);
        handler.provideToSp(93.3700286235112182 ether, false);

        // totalBoldDeposits = 135_922.474654887502906281 ether

        vm.prank(gabe);
        handler.liquidateMe();

        // totalBoldDeposits = 54_833.735598602975986433 ether
        // P = 0.000000007852364599 ether

        // pulling `deposited` from fixture
        vm.prank(eric);
        handler.provideToSp(2_000.19178082191781022 ether, false);

        // totalBoldDeposits = 56_833.927379424893796653 ether

        // pulling `deposited` from fixture
        vm.prank(eric);
        handler.provideToSp(7_203.192719734595093785 ether, false);

        // totalBoldDeposits = 64_037.120099159488890438 ether

        vm.prank(eric);
        handler.provideToSp(274_245.06787137850800868 ether, false);

        // totalBoldDeposits = 338_282.187970537996899118 ether

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(0.000000000000000003 ether, false);

        // totalBoldDeposits = 338_282.187970537996899121 ether

        // coll = 15.001438356164383562 ether, debt = 2_000.19178082191780822 ether
        vm.prank(carl);
        handler.openTrove(2_000.000000000000000001 ether);

        vm.prank(fran);
        handler.provideToSp(0.181573511635796686 ether, false);

        // totalBoldDeposits = 338_282.369544049632695807 ether

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(1_460.576157988085089255 ether, false);

        // totalBoldDeposits = 339_742.945702037717785062 ether

        // coll = 735.070479452054794613 ether, debt = 98_009.397260273972614959 ether
        vm.prank(adam);
        handler.openTrove(98_000.000000000000012219 ether);

        // pulling `deposited` from fixture
        vm.prank(eric);
        handler.provideToSp(98_009.398898087212585509 ether, false);

        // totalBoldDeposits = 437_752.344600124930370571 ether

        vm.prank(hope);
        handler.liquidateMe();

        // totalBoldDeposits = 435_752.152819303012562352 ether
        // P = 0.000000007816485328 ether

        vm.prank(gabe);
        handler.provideToSp(0.000000000000019905 ether, false);

        // totalBoldDeposits = 435_752.152819303012582257 ether

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 337_742.755559029039967298 ether
        // P = 0.000000006058401035 ether

        // coll = 735.13278143530641484 ether, debt = 98_017.704191374188645223 ether
        vm.prank(gabe);
        handler.openTrove(98_008.306134621553701718 ether);

        vm.prank(dana);
        handler.liquidateMe();

        // totalBoldDeposits = 239_733.358298755067364395 ether
        // P = 0.000000004300316741 ether

        // coll = 15.001438356164383562 ether, debt = 2_000.19178082191780822 ether
        vm.prank(hope);
        handler.openTrove(2_000.000000000000000001 ether);

        // coll = 469.810276194584395539 ether, debt = 62_641.370159277919405116 ether
        vm.prank(dana);
        handler.openTrove(62_635.364028480667834228 ether);

        vm.prank(eric);
        handler.provideToSp(21_097.460509412491003887 ether, false);

        // totalBoldDeposits = 260_830.818808167558368282 ether

        vm.prank(eric);
        handler.provideToSp(83_757.266675643468347618 ether, false);

        // totalBoldDeposits = 344_588.0854838110267159 ether

        vm.prank(fran);
        handler.liquidateMe();

        // totalBoldDeposits = 246_578.688223535133057598 ether
        // P = 0.000000003077200012 ether

        vm.prank(dana);
        handler.liquidateMe();

        // totalBoldDeposits = 183_937.318064257213652482 ether
        // P = 0.000000002295461629 ether

        // coll = 668.766201175330133997 ether, debt = 89_168.826823377351199558 ether
        vm.prank(fran);
        handler.openTrove(89_160.277207754689790948 ether);

        vm.prank(hope);
        handler.provideToSp(38_233.653891621233262723 ether, false);

        // totalBoldDeposits = 222_170.971955878446915205 ether

        vm.prank(carl);
        handler.provideToSp(0.000000021524550851 ether, false);

        // totalBoldDeposits = 222_170.971955899971466056 ether

        vm.prank(carl);
        handler.liquidateMe();

        // totalBoldDeposits = 220_170.780175078053657836 ether
        // P = 0.000000002274795728 ether

        vm.prank(hope);
        handler.liquidateMe();

        // totalBoldDeposits = 218_170.588394256135849616 ether
        // P = 0.000000002254129826 ether

        vm.prank(gabe);
        handler.liquidateMe();

        // totalBoldDeposits = 120_152.884202881947204393 ether
        // P = 0.000000001241414812 ether

        // coll = 99.499550069000631429 ether, debt = 13_266.606675866750857192 ether
        vm.prank(dana);
        handler.openTrove(13_265.334657474938191886 ether);

        vm.prank(barb);
        handler.provideToSp(59_096.520374013452717244 ether, false);

        // totalBoldDeposits = 179_249.404576895399921637 ether

        vm.prank(adam);
        handler.provideToSp(23_015.108655260103608912 ether, false);

        // totalBoldDeposits = 202_264.513232155503530549 ether

        vm.prank(adam);
        handler.provideToSp(11_640.920533719287905407 ether, false);

        // totalBoldDeposits = 213_905.433765874791435956 ether

        // coll = 212.093800333100700409 ether, debt = 28_279.173377746760054476 ether
        vm.prank(gabe);
        handler.openTrove(28_276.461936191234867571 ether);

        // pulling `deposited` from fixture
        vm.prank(fran);
        handler.provideToSp(11_951.860820266565233373 ether, false);

        // totalBoldDeposits = 225_857.294586141356669329 ether

        vm.prank(eric);
        handler.liquidateMe();

        // totalBoldDeposits = 158_043.780824801251269472 ether
        // P = 0.868680778364501791 ether

        vm.prank(gabe);
        handler.provideToSp(14_072.771289030588622223 ether, false);

        // totalBoldDeposits = 172_116.552113831839891695 ether

        vm.prank(barb);
        handler.liquidateMe();

        // totalBoldDeposits = 99_535.593226030580649712 ether
        // P = 0.502361077634044115 ether

        vm.prank(gabe);
        handler.liquidateMe();

        // totalBoldDeposits = 71_256.419848283820595236 ether
        // P = 0.359634686478828868 ether

        // pulling `deposited` from fixture
        vm.prank(barb);
        handler.provideToSp(4_878.710419896136587321 ether, false);

        // totalBoldDeposits = 76_135.130268179957182557 ether

        vm.prank(adam);
        handler.provideToSp(14_374.214356116689334934 ether, false);

        // totalBoldDeposits = 90_509.344624296646517491 ether

        // pulling `deposited` from fixture
        vm.prank(barb);
        handler.provideToSp(3_677.370505812043912663 ether, false);

        // totalBoldDeposits = 94_186.715130108690430154 ether

        // pulling `deposited` from fixture
        vm.prank(hope);
        handler.provideToSp(639.80319832560635617 ether, false);

        // totalBoldDeposits = 94_826.518328434296786324 ether

        // coll = 213.284506903767782764 ether, debt = 28_437.934253835704368518 ether
        vm.prank(barb);
        handler.openTrove(28_435.207590094188487431 ether);

        vm.prank(barb);
        handler.liquidateMe();

        // totalBoldDeposits = 66_388.584074598592417806 ether
        // P = 0.251782286646312349 ether

        // coll = 735.07047945560555349 ether, debt = 98_009.397260747407131972 ether
        vm.prank(eric);
        handler.openTrove(98_000.000000473389135754 ether);

        // pulling `deposited` from fixture
        vm.prank(adam);
        handler.provideToSp(72_573.999737141533341526 ether, false);

        // totalBoldDeposits = 138_962.583811740125759332 ether

        vm.prank(fran);
        handler.liquidateMe();

        // totalBoldDeposits = 49_793.756988362774559774 ether
        // P = 0.090219868192905479 ether

        // coll = 735.070479452054794547 ether, debt = 98_009.39726027397260621 ether
        vm.prank(hope);
        handler.openTrove(98_000.00000000000000347 ether);

        // coll = 735.070479461551818819 ether, debt = 98_009.397261540242509165 ether
        vm.prank(adam);
        handler.openTrove(98_000.000001266148494926 ether);

        // pulling `deposited` from fixture
        vm.prank(eric);
        handler.provideToSp(28_437.934253835704396956 ether, false);

        // totalBoldDeposits = 78_231.69124219847895673 ether

        vm.prank(eric);
        handler.provideToSp(76_531.421401180754433115 ether, false);

        // totalBoldDeposits = 154_763.112643379233389845 ether

        // pulling `deposited` from fixture
        vm.prank(hope);
        handler.provideToSp(20_198.010209003131056638 ether, false);

        // totalBoldDeposits = 174_961.122852382364446483 ether

        // pulling `deposited` from fixture
        vm.prank(barb);
        handler.provideToSp(28_279.173377746760054476 ether, false);

        // totalBoldDeposits = 203_240.296230129124500959 ether

        vm.prank(dana);
        handler.liquidateMe();

        // totalBoldDeposits = 189_973.689554262373643767 ether
        // P = 0.08433072353082255 ether

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(2_000.191780821917810221 ether, false);

        // totalBoldDeposits = 191_973.881335084291453988 ether

        // pulling `deposited` from fixture
        vm.prank(carl);
        handler.provideToSp(69_026.162348222891866967 ether, false);

        // totalBoldDeposits = 261_000.043683307183320955 ether

        // coll = 195.211213953575393473 ether, debt = 26_028.161860476719129601 ether
        vm.prank(gabe);
        handler.openTrove(26_025.666248644657313147 ether);

        vm.prank(eric);
        handler.liquidateMe();

        // totalBoldDeposits = 162_990.646422559776188983 ether
        // P = 0.052663282915956226 ether

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(2_000.383580033777444175 ether, false);

        // totalBoldDeposits = 164_991.030002593553633158 ether

        vm.prank(hope);
        handler.liquidateMe();

        // totalBoldDeposits = 66_981.632742319581026948 ether
        // P = 0.021379784556930176 ether

        // coll = 735.078238459032984122 ether, debt = 98_010.431794537731216171 ether
        vm.prank(carl);
        handler.openTrove(98_001.034435071354510944 ether);

        vm.prank(gabe);
        handler.provideToSp(127_043.190467742264219876 ether, false);

        // totalBoldDeposits = 194_024.823210061845246824 ether

        vm.prank(eric);
        handler.provideToSp(10_187.654850020363726401 ether, false);

        // totalBoldDeposits = 204_212.478060082208973225 ether

        vm.prank(dana);
        handler.provideToSp(2_000.19178082191780822 ether, false);

        // totalBoldDeposits = 206_212.669840904126781445 ether

        vm.prank(carl);
        handler.liquidateMe();

        // totalBoldDeposits = 108_202.238046366395565274 ether
        // P = 0.011218226987671323 ether

        vm.prank(carl);
        handler.provideToSp(3_923.019318064356157605 ether, false);

        // totalBoldDeposits = 112_125.257364430751722879 ether

        vm.prank(carl);
        handler.provideToSp(6_975.91127252392829994 ether, false);

        // totalBoldDeposits = 119_101.168636954680022819 ether

        vm.prank(gabe);
        handler.liquidateMe();

        // totalBoldDeposits = 93_073.006776477960893218 ether
        // P = 0.008766615209513851 ether

        vm.prank(adam);
        handler.provideToSp(0.000000000000000084 ether, false);

        // totalBoldDeposits = 93_073.006776477960893302 ether

        vm.prank(fran);
        handler.provideToSp(0.000000004191118464 ether, false);

        // totalBoldDeposits = 93_073.006776482152011766 ether

        // coll = 735.141091030552423847 ether, debt = 98_018.812137406989846253 ether
        vm.prank(eric);
        handler.openTrove(98_009.413974423141051906 ether);

        // coll = 735.070479452054794643 ether, debt = 98_009.397260273972618968 ether
        vm.prank(fran);
        handler.openTrove(98_000.000000000000016227 ether);

        // coll = 351.402972089012993467 ether, debt = 46_853.729611868399128896 ether
        vm.prank(barb);
        handler.openTrove(46_849.237219258333261323 ether);

        // coll = 313.566752994904857452 ether, debt = 41_808.900399320647660165 ether
        vm.prank(gabe);
        handler.openTrove(41_804.89171107438025384 ether);

        // pulling `deposited` from fixture
        vm.prank(eric);
        handler.provideToSp(2_000.191780821917808221 ether, false);

        // totalBoldDeposits = 95_073.198557304069819987 ether

        // pulling `deposited` from fixture
        vm.prank(adam);
        handler.provideToSp(2_000.191780821917810221 ether, false);

        // totalBoldDeposits = 97_073.390338125987630208 ether

        vm.prank(gabe);
        handler.liquidateMe();

        // totalBoldDeposits = 55_264.489938805339970043 ether
        // P = 0.004990889020729643 ether

        vm.prank(carl);
        handler.provideToSp(840.618911668657767952 ether, false);

        // totalBoldDeposits = 56_105.108850473997737995 ether

        // coll = 735.271010848292029883 ether, debt = 98_036.134779772270651031 ether
        vm.prank(dana);
        handler.openTrove(98_026.73495587239247641 ether);

        // coll = 15.004315482280067453 ether, debt = 2_000.575397637342326941 ether
        vm.prank(carl);
        handler.openTrove(2_000.383580033777444173 ether);

        vm.prank(barb);
        handler.liquidateMe();

        // totalBoldDeposits = 9_251.379238605598609099 ether
        // P = 0.00082296617927643 ether

        vm.prank(hope);
        handler.provideToSp(98_009.397260273972626926 ether, false);

        // totalBoldDeposits = 107_260.776498879571236025 ether

        vm.prank(hope);
        handler.provideToSp(0.000000000000000008 ether, false);

        // totalBoldDeposits = 107_260.776498879571236033 ether

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(10_187.654850020363726401 ether, false);

        // totalBoldDeposits = 117_448.431348899934962434 ether

        // coll = 735.211458631723305252 ether, debt = 98_028.194484229774033498 ether
        vm.prank(barb);
        handler.openTrove(98_018.795421655094777835 ether);

        vm.prank(carl);
        handler.liquidateMe();

        // totalBoldDeposits = 115_447.855951262592635493 ether
        // P = 0.000808948061942389 ether

        vm.prank(barb);
        handler.liquidateMe();

        // totalBoldDeposits = 17_419.661467032818601995 ether
        // P = 0.000122060312574342 ether

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(2_000.19178082191780822 ether, false);

        // totalBoldDeposits = 19_419.853247854736410215 ether

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(98_009.397263949756232826 ether, false);

        // totalBoldDeposits = 117_429.250511804492643041 ether

        // pulling `deposited` from fixture
        vm.prank(barb);
        handler.provideToSp(28_435.207590094188515867 ether, false);

        // totalBoldDeposits = 145_864.458101898681158908 ether

        vm.prank(eric);
        handler.liquidateMe();

        // totalBoldDeposits = 47_845.645964491691312655 ether
        // P = 0.00004003754291993 ether

        vm.prank(hope);
        handler.provideToSp(0.000000000000000001 ether, false);

        // totalBoldDeposits = 47_845.645964491691312656 ether

        // pulling `deposited` from fixture
        vm.prank(adam);
        handler.provideToSp(66_291.727424818609157294 ether, false);

        // totalBoldDeposits = 114_137.37338931030046995 ether

        vm.prank(dana);
        handler.provideToSp(34_514.867687279318087443 ether, false);

        // totalBoldDeposits = 148_652.241076589618557393 ether

        vm.prank(fran);
        handler.liquidateMe();

        // totalBoldDeposits = 50_642.843816315645938425 ether
        // P = 0.000013639989671184 ether

        // coll = 352.109720323032555887 ether, debt = 46_947.962709737674118221 ether
        vm.prank(carl);
        handler.openTrove(46_943.461281943515151015 ether);

        vm.prank(eric);
        handler.provideToSp(132_655.49297647131706795 ether, false);

        // totalBoldDeposits = 183_298.336792786963006375 ether

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(20_196.073599205946944939 ether, false);

        // totalBoldDeposits = 203_494.410391992909951314 ether

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 105_485.013130452667442149 ether
        // P = 0.000007070535681016 ether

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(2_433.132675147864181608 ether, false);

        // totalBoldDeposits = 107_918.145805600531623757 ether

        vm.prank(carl);
        handler.liquidateMe();

        // totalBoldDeposits = 60_970.183095862857505536 ether
        // P = 0.000003994618808907 ether

        // coll = 15.002876850253330832 ether, debt = 2_000.383580033777444175 ether
        vm.prank(gabe);
        handler.openTrove(2_000.191780821917808221 ether);

        // coll = 418.713296854525609391 ether, debt = 55_828.439580603414585439 ether
        vm.prank(fran);
        handler.openTrove(55_823.086681880494538018 ether);

        vm.prank(fran);
        handler.provideToSp(2_000.191780821917808221 ether, false);

        // totalBoldDeposits = 62_970.374876684775313757 ether

        // coll = 16.435511886622991697 ether, debt = 2_191.401584883065559477 ether
        vm.prank(carl);
        handler.openTrove(2_191.191470632456967713 ether);

        // coll = 735.070479572086427116 ether, debt = 98_009.397276278190282122 ether
        vm.prank(adam);
        handler.openTrove(98_000.000016002683175517 ether);

        vm.prank(dana);
        handler.provideToSp(144_474.430256544008468299 ether, false);

        // totalBoldDeposits = 207_444.805133228783782056 ether

        vm.prank(barb);
        handler.provideToSp(30_891.30993096708868557 ether, false);

        // totalBoldDeposits = 238_336.115064195872467626 ether

        vm.prank(gabe);
        handler.provideToSp(6_403.809474203878459994 ether, false);

        // totalBoldDeposits = 244_739.92453839975092762 ether

        vm.prank(carl);
        handler.provideToSp(8_750.712699789005768654 ether, false);

        // totalBoldDeposits = 253_490.637238188756696274 ether

        vm.prank(gabe);
        handler.liquidateMe();

        // totalBoldDeposits = 251_490.253658154979252099 ether
        // P = 0.00000396309586999 ether

        // pulling `deposited` from fixture
        vm.prank(fran);
        handler.provideToSp(2_000.19178082191781022 ether, false);

        // totalBoldDeposits = 253_490.445438976897062319 ether

        vm.prank(dana);
        handler.provideToSp(325.521972998768376221 ether, false);

        // totalBoldDeposits = 253_815.96741197566543854 ether

        // pulling `deposited` from fixture
        vm.prank(barb);
        handler.provideToSp(66.458390359133408403 ether, false);

        // totalBoldDeposits = 253_882.425802334798846943 ether

        // pulling `deposited` from fixture
        vm.prank(fran);
        handler.provideToSp(6.220868309032641881 ether, false);

        // totalBoldDeposits = 253_888.646670643831488824 ether

        // pulling `deposited` from fixture
        vm.prank(barb);
        handler.provideToSp(2.896719015833063074 ether, false);

        // totalBoldDeposits = 253_891.543389659664551898 ether

        vm.prank(dana);
        handler.liquidateMe();

        // totalBoldDeposits = 155_855.408609887393900867 ether
        // P = 0.000002432810159531 ether

        // pulling `deposited` from fixture
        vm.prank(hope);
        handler.provideToSp(4.326669099518489625 ether, false);

        // totalBoldDeposits = 155_859.735278986912390492 ether

        vm.prank(carl);
        handler.liquidateMe();

        // totalBoldDeposits = 153_668.333694103846831015 ether
        // P = 0.000002398604634738 ether

        vm.prank(fran);
        handler.liquidateMe();

        // totalBoldDeposits = 97_839.894113500432245576 ether
        // P = 0.00000152718011474 ether

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(1.708704760958511302 ether, false);

        // totalBoldDeposits = 97_841.602818261390756878 ether

        // coll = 450.991202005541885359 ether, debt = 60_132.16026740558471443 ether
        vm.prank(barb);
        handler.openTrove(60_126.394722706147138677 ether);

        // coll = 212.093800333100700409 ether, debt = 28_279.173377746760054476 ether
        vm.prank(eric);
        handler.openTrove(28_276.461936191234867571 ether);

        // coll = 735.070479452054794544 ether, debt = 98_009.397260273972605844 ether
        vm.prank(dana);
        handler.openTrove(98_000.000000000000003104 ether);

        vm.prank(barb);
        handler.liquidateMe();

        // totalBoldDeposits = 37_709.442550855806042448 ether
        // P = 0.000000588595333097 ether

        // coll = 721.927275004936852279 ether, debt = 96_256.970000658246970478 ether
        vm.prank(hope);
        handler.openTrove(96_247.740765242401808661 ether);

        // pulling `deposited` from fixture
        vm.prank(hope);
        handler.provideToSp(2_000.191780821917810221 ether, false);

        // totalBoldDeposits = 39_709.634331677723852669 ether

        vm.prank(carl);
        handler.provideToSp(215_905.794225194415503585 ether, false);

        // totalBoldDeposits = 255_615.428556872139356254 ether

        // pulling `deposited` from fixture
        vm.prank(hope);
        handler.provideToSp(28_279.173377746760082756 ether, false);

        // totalBoldDeposits = 283_894.60193461889943901 ether

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(28_284.597040886477233889 ether, false);

        // totalBoldDeposits = 312_179.198975505376672899 ether

        vm.prank(hope);
        handler.provideToSp(2_534.83011119743893462 ether, false);

        // totalBoldDeposits = 314_714.029086702815607519 ether

        vm.prank(hope);
        handler.liquidateMe();

        // totalBoldDeposits = 218_457.059086044568637041 ether
        // P = 0.000000408570300578 ether

        vm.prank(hope);
        handler.provideToSp(0.000000000000016955 ether, false);

        // totalBoldDeposits = 218_457.059086044568653996 ether

        // coll = 57.953212469014889301 ether, debt = 7_727.094995868651906762 ether
        vm.prank(hope);
        handler.openTrove(7_726.354112597580905854 ether);

        vm.prank(hope);
        handler.liquidateMe();

        // totalBoldDeposits = 210_729.964090175916747234 ether
        // P = 0.000000394118666292 ether

        // pulling `deposited` from fixture
        vm.prank(carl);
        handler.provideToSp(9_416.412249962597121674 ether, false);

        // totalBoldDeposits = 220_146.376340138513868908 ether

        // coll = 632.924278300284559828 ether, debt = 84_389.903773371274643656 ether
        vm.prank(fran);
        handler.openTrove(84_381.8123667059740708 ether);

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(28_276.461936191234867571 ether, false);

        // totalBoldDeposits = 248_422.838276329748736479 ether

        // pulling `deposited` from fixture
        vm.prank(barb);
        handler.provideToSp(2_000.19178082191781022 ether, false);

        // totalBoldDeposits = 250_423.030057151666546699 ether

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 152_413.632780873476264577 ether
        // P = 0.000000239870341248 ether

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(26_028.16186047671915563 ether, false);

        // totalBoldDeposits = 178_441.794641350195420207 ether

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(2_000.383580033777446176 ether, false);

        // totalBoldDeposits = 180_442.178221383972866383 ether

        vm.prank(fran);
        handler.liquidateMe();

        // totalBoldDeposits = 96_052.274448012698222727 ether
        // P = 0.000000127686841716 ether

        vm.prank(carl);
        handler.provideToSp(0.000065629200646993 ether, false);

        // totalBoldDeposits = 96_052.27451364189886972 ether

        vm.prank(gabe);
        handler.provideToSp(26_925.63798950431391582 ether, false);

        // totalBoldDeposits = 122_977.91250314621278554 ether

        // coll = 735.140965662413260705 ether, debt = 98_018.795421655101427282 ether
        vm.prank(carl);
        handler.openTrove(98_009.397260273979264887 ether);

        // pulling `deposited` from fixture
        vm.prank(adam);
        handler.provideToSp(2_000.383580033777444175 ether, false);

        // totalBoldDeposits = 124_978.296083179990229715 ether

        vm.prank(carl);
        handler.liquidateMe();

        // totalBoldDeposits = 26_959.500661524888802433 ether
        // P = 0.000000027543770411 ether

        // pulling `deposited` from fixture
        vm.prank(barb);
        handler.provideToSp(28_276.461936191234867571 ether, false);

        // totalBoldDeposits = 55_235.962597716123670004 ether

        // coll = 489.354614519513293973 ether, debt = 65_247.281935935105863003 ether
        vm.prank(barb);
        handler.openTrove(65_241.025947145653540061 ether);

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(7_727.094995868651906762 ether, false);

        // totalBoldDeposits = 62_963.057593584775576766 ether

        vm.prank(gabe);
        handler.provideToSp(125_493.367851671998899348 ether, false);

        // totalBoldDeposits = 188_456.425445256774476114 ether

        vm.prank(eric);
        handler.liquidateMe();

        // totalBoldDeposits = 160_177.252067510014421638 ether
        // P = 0.000000023410639598 ether

        // coll = 288.779681677176185452 ether, debt = 38_503.957556956824726877 ether
        vm.prank(carl);
        handler.openTrove(38_500.26575065196768888 ether);

        // pulling `deposited` from fixture
        vm.prank(fran);
        handler.provideToSp(15_228.59530001064662931 ether, false);

        // totalBoldDeposits = 175_405.847367520661050948 ether

        // pulling `deposited` from fixture
        vm.prank(carl);
        handler.provideToSp(21_523.188103775604494379 ether, false);

        // totalBoldDeposits = 196_929.035471296265545327 ether

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(521.190673062530333491 ether, false);

        // totalBoldDeposits = 197_450.226144358795878818 ether

        // coll = 304.311340504907979163 ether, debt = 40_574.845400654397221728 ether
        vm.prank(fran);
        handler.openTrove(40_570.95503510308596691 ether);

        // pulling `deposited` from fixture
        vm.prank(barb);
        handler.provideToSp(8_620.497290242565920867 ether, false);

        // totalBoldDeposits = 206_070.723434601361799685 ether

        // coll = 735.101608054811195911 ether, debt = 98_013.54774064149278813 ether
        vm.prank(hope);
        handler.openTrove(98_004.150082414411954108 ether);

        // pulling `deposited` from fixture
        vm.prank(eric);
        handler.provideToSp(98_009.397260273972701187 ether, false);

        // totalBoldDeposits = 304_080.120694875334500872 ether

        // pulling `deposited` from fixture
        vm.prank(adam);
        handler.provideToSp(25_872.571918570624937083 ether, false);

        // totalBoldDeposits = 329_952.692613445959437955 ether

        // pulling `deposited` from fixture
        vm.prank(hope);
        handler.provideToSp(6_135.327451498724588662 ether, false);

        // totalBoldDeposits = 336_088.020064944684026617 ether

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(2_205.113862383885336052 ether, false);

        invariant_allFundsClaimable();
    }

    function testCollGainsUnderflow1CollSkin() external {
        // coll = 750.071917808219178083 ether, debt = 100_009.589041095890410955 ether
        vm.prank(eric);
        handler.openTrove(99_999.999999999999999997 ether);

        // coll = 735.070479452054794555 ether, debt = 98_009.397260273972607213 ether
        vm.prank(gabe);
        handler.openTrove(98_000.000000000000004473 ether);

        // pulling `deposited` from fixture
        vm.prank(carl);
        handler.provideToSp(98_009.397260273972705223 ether, false);

        // totalBoldDeposits = 98_009.397260273972705223 ether

        // coll = 30.426364161890371226 ether, debt = 4_056.848554918716163372 ether
        vm.prank(dana);
        handler.openTrove(4_056.459579342614816746 ether);

        vm.prank(gabe);
        handler.liquidateMe();

        // totalBoldDeposits = 0.00000000000009801 ether
        // P = 0.000000001 ether

        // coll = 194.653638200051297867 ether, debt = 25_953.818426673506382174 ether
        vm.prank(gabe);
        handler.openTrove(25_951.329942980343883446 ether);

        // coll = 735.070479452062778814 ether, debt = 98_009.397260275037175074 ether
        vm.prank(barb);
        handler.openTrove(98_000.000000001064470262 ether);

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(100_009.589041095890510965 ether, false);

        // totalBoldDeposits = 100_009.589041095890608975 ether

        // pulling `deposited` from fixture
        vm.prank(carl);
        handler.provideToSp(98_009.397260275037273084 ether, false);

        // totalBoldDeposits = 198_018.986301370927882059 ether

        vm.prank(dana);
        handler.provideToSp(0.496605989849598341 ether, false);

        // totalBoldDeposits = 198_019.4829073607774804 ether

        vm.prank(gabe);
        handler.liquidateMe();

        // totalBoldDeposits = 172_065.664480687271098226 ether
        // P = 0.868933005754714293 ether

        vm.prank(eric);
        handler.liquidateMe();

        // totalBoldDeposits = 72_056.075439591380687271 ether
        // P = 0.363883767302338072 ether

        // coll = 735.070479577647341362 ether, debt = 98_009.39727701964551487 ether
        vm.prank(eric);
        handler.openTrove(98_000.000016744067316635 ether);

        vm.prank(dana);
        handler.liquidateMe();

        // totalBoldDeposits = 67_999.226884672664523899 ether
        // P = 0.343396649088739732 ether

        vm.prank(gabe);
        handler.provideToSp(98_009.528835931706183022 ether, false);

        // totalBoldDeposits = 166_008.755720604370706921 ether

        // coll = 142.876042418358456894 ether, debt = 19_050.138989114460919144 ether
        vm.prank(adam);
        handler.openTrove(19_048.312438606649322634 ether);

        vm.prank(barb);
        handler.liquidateMe();

        // totalBoldDeposits = 67_999.358460329333531847 ether
        // P = 0.140659760589741782 ether

        // coll = 229.527463135823293547 ether, debt = 30_603.66175144310580624 ether
        vm.prank(barb);
        handler.openTrove(30_600.727435113711340769 ether);

        vm.prank(fran);
        handler.provideToSp(77_953.107488958449123527 ether, false);

        // totalBoldDeposits = 145_952.465949287782655374 ether

        // coll = 56.03935308533754643 ether, debt = 7_471.913744711672857314 ether
        vm.prank(dana);
        handler.openTrove(7_471.197328529485098469 ether);

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 126_902.32696017332173623 ether
        // P = 0.12230044084833236 ether

        // coll = 15.073363060611747045 ether, debt = 2_009.781741414899605926 ether
        vm.prank(gabe);
        handler.openTrove(2_009.589041095890410956 ether);

        vm.prank(barb);
        handler.liquidateMe();

        // totalBoldDeposits = 96_298.66520873021592999 ether
        // P = 0.092806566201341985 ether

        vm.prank(dana);
        handler.liquidateMe();

        // totalBoldDeposits = 88_826.751464018543072676 ether
        // P = 0.085605608056218754 ether

        vm.prank(barb);
        handler.provideToSp(2_000.19178082191780822 ether, false);

        // totalBoldDeposits = 90_826.943244840460880896 ether

        // pulling `deposited` from fixture
        vm.prank(barb);
        handler.provideToSp(8_325.434599937117099155 ether, false);

        // totalBoldDeposits = 99_152.377844777577980051 ether

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(684.925178203675199325 ether, false);

        // totalBoldDeposits = 99_837.303022981253179376 ether

        // coll = 735.070479452054794704 ether, debt = 98_009.397260273972627152 ether
        vm.prank(dana);
        handler.openTrove(98_000.00000000000002441 ether);

        vm.prank(gabe);
        handler.liquidateMe();

        // totalBoldDeposits = 97_827.52128156635357345 ether
        // P = 0.083882318435759902 ether

        // coll = 735.070479452054794605 ether, debt = 98_009.39726027397261396 ether
        vm.prank(adam);
        handler.openTrove(98_000.00000000000001122 ether);

        // pulling `deposited` from fixture
        vm.prank(adam);
        handler.provideToSp(98_009.397260275037273084 ether, false);

        // totalBoldDeposits = 195_836.918541841390846534 ether

        // coll = 515.203656226378253104 ether, debt = 68_693.820830183767080495 ether
        vm.prank(carl);
        handler.openTrove(68_687.234383051145737754 ether);

        // pulling `deposited` from fixture
        vm.prank(eric);
        handler.provideToSp(4_056.848554918716163372 ether, false);

        // totalBoldDeposits = 199_893.767096760107009906 ether

        vm.prank(dana);
        handler.liquidateMe();

        // totalBoldDeposits = 101_884.369836486134382754 ether
        // P = 0.042754195282707141 ether

        // pulling `deposited` from fixture
        vm.prank(carl);
        handler.provideToSp(4_056.848554918716167429 ether, false);

        // totalBoldDeposits = 105_941.218391404850550183 ether

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 7_931.821131130877936223 ether
        // P = 0.003201007452406133 ether

        // coll = 323.941601161667162732 ether, debt = 43_192.213488222288364206 ether
        vm.prank(dana);
        handler.openTrove(43_188.072166233745402319 ether);

        // coll = 735.077560661060987637 ether, debt = 98_010.341421474798351539 ether
        vm.prank(fran);
        handler.openTrove(98_000.94407067350089255 ether);

        // pulling `deposited` from fixture
        vm.prank(eric);
        handler.provideToSp(4_056.848554918716167429 ether, false);

        // totalBoldDeposits = 11_988.669686049594103652 ether

        // coll = 750.071917808219178083 ether, debt = 100_009.589041095890410956 ether
        vm.prank(gabe);
        handler.openTrove(99_999.999999999999999998 ether);

        vm.prank(gabe);
        handler.provideToSp(74_288.109052201663929339 ether, false);

        // totalBoldDeposits = 86_276.778738251258032991 ether

        vm.prank(carl);
        handler.liquidateMe();

        // totalBoldDeposits = 17_582.957908067490952496 ether
        // P = 0.000652356058283315 ether

        // pulling `deposited` from fixture
        vm.prank(fran);
        handler.provideToSp(98_009.39727701964551487 ether, false);

        // totalBoldDeposits = 115_592.355185087136467366 ether

        vm.prank(eric);
        handler.liquidateMe();

        // totalBoldDeposits = 17_582.957908067490952496 ether
        // P = 0.00009923103561219 ether

        // pulling `deposited` from fixture
        vm.prank(barb);
        handler.provideToSp(100_009.589041095890410955 ether, false);

        // totalBoldDeposits = 117_592.546949163381363451 ether

        // coll = 15.073363060611747045 ether, debt = 2_009.781741414899605925 ether
        vm.prank(barb);
        handler.openTrove(2_009.589041095890410955 ether);

        vm.prank(gabe);
        handler.liquidateMe();

        // totalBoldDeposits = 17_582.957908067490952495 ether
        // P = 0.000014837463492455 ether

        vm.prank(adam);
        handler.provideToSp(0.000000000000000002 ether, false);

        // totalBoldDeposits = 17_582.957908067490952497 ether

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(7_471.913744711672857314 ether, false);

        // totalBoldDeposits = 25_054.871652779163809811 ether

        // coll = 580.047769365738917368 ether, debt = 77_339.702582098522315641 ether
        vm.prank(adam);
        handler.openTrove(77_332.287157302616585284 ether);

        // pulling `deposited` from fixture
        vm.prank(fran);
        handler.provideToSp(98_009.397260273972705223 ether, false);

        // totalBoldDeposits = 123_064.268913053136515034 ether

        vm.prank(barb);
        handler.liquidateMe();

        // totalBoldDeposits = 121_054.487171638236909109 ether
        // P = 0.000014595150565402 ether

        // pulling `deposited` from fixture
        vm.prank(barb);
        handler.provideToSp(564.96272307591803637 ether, false);

        // totalBoldDeposits = 121_619.449894714154945479 ether

        // coll = 731.700616671530497942 ether, debt = 97_560.08222287073305882 ether
        vm.prank(gabe);
        handler.openTrove(97_550.728043469304495376 ether);

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 44_279.747312615632629838 ether
        // P = 0.000005313866980857 ether

        // coll = 111.454050057575828713 ether, debt = 14_860.540007676777161603 ether
        vm.prank(hope);
        handler.openTrove(14_859.115161017501510774 ether);

        vm.prank(adam);
        handler.provideToSp(152_509.97357453248223605 ether, false);

        // totalBoldDeposits = 196_789.720887148114865888 ether

        // coll = 15.001438356164383562 ether, debt = 2_000.191780821917808219 ether
        vm.prank(adam);
        handler.openTrove(2_000 ether);

        // pulling `deposited` from fixture
        vm.prank(eric);
        handler.provideToSp(14_860.540007676777161603 ether, false);

        // totalBoldDeposits = 211_650.260894824892027491 ether

        // pulling `deposited` from fixture
        vm.prank(carl);
        handler.provideToSp(14_860.540007676777176464 ether, false);

        // totalBoldDeposits = 226_510.800902501669203955 ether

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(12_814.236706347398980103 ether, false);

        // totalBoldDeposits = 239_325.037608849068184058 ether

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(14_860.540007676777176464 ether, false);

        // totalBoldDeposits = 254_185.577616525845360522 ether

        // pulling `deposited` from fixture
        vm.prank(fran);
        handler.provideToSp(1_259.585871487299059386 ether, false);

        // totalBoldDeposits = 255_445.163488013144419908 ether

        // coll = 738.523203018591611001 ether, debt = 98_469.760402478881466715 ether
        vm.prank(eric);
        handler.openTrove(98_460.319002026632337587 ether);

        vm.prank(barb);
        handler.provideToSp(8_578.289920869031137553 ether, false);

        invariant_allFundsClaimable();
    }

    function testCollGainsUnderflow3CollDeep() external {
        // coll = 544.304998028561500062 ether, debt = 72_573.999737141533341526 ether
        vm.prank(dana);
        handler.openTrove(72_567.041253733641074574 ether);

        // pulling `deposited` from fixture
        vm.prank(eric);
        handler.provideToSp(6.958483407892266952 ether, false);

        // totalBoldDeposits = 6.958483407892266952 ether

        vm.prank(barb);
        handler.provideToSp(3_316.787992790864192928 ether, false);

        // totalBoldDeposits = 3_323.74647619875645988 ether

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(3_330.704959606648799406 ether, false);

        // totalBoldDeposits = 6_654.451435805405259286 ether

        // coll = 54.02394539800946315 ether, debt = 7_203.192719734595086581 ether
        vm.prank(eric);
        handler.openTrove(7_202.502068851280580224 ether);

        // coll = 212.073464521434261507 ether, debt = 28_276.461936191234867571 ether
        vm.prank(carl);
        handler.openTrove(28_273.750754612025495264 ether);

        // pulling `deposited` from fixture
        vm.prank(fran);
        handler.provideToSp(7_203.192719734595086581 ether, false);

        // totalBoldDeposits = 13_857.644155540000345867 ether

        // pulling `deposited` from fixture
        vm.prank(eric);
        handler.provideToSp(28_276.461936191234867571 ether, false);

        // totalBoldDeposits = 42_134.106091731235213438 ether

        vm.prank(carl);
        handler.liquidateMe();

        // totalBoldDeposits = 13_857.644155540000345867 ether
        // P = 0.328893750003148765 ether

        // coll = 212.093800333100700409 ether, debt = 28_279.173377746760054476 ether
        vm.prank(barb);
        handler.openTrove(28_276.461936191234867571 ether);

        vm.prank(eric);
        handler.provideToSp(0.000000000000014391 ether, false);

        // totalBoldDeposits = 13_857.644155540000360258 ether

        // coll = 735.070479452054794697 ether, debt = 98_009.397260273972626238 ether
        vm.prank(gabe);
        handler.openTrove(98_000.000000000000023497 ether);

        // pulling `deposited` from fixture
        vm.prank(adam);
        handler.provideToSp(28_279.173377746760054476 ether, false);

        // totalBoldDeposits = 42_136.817533286760414734 ether

        vm.prank(fran);
        handler.provideToSp(28_279.173377746760054476 ether, false);

        // totalBoldDeposits = 70_415.99091103352046921 ether

        vm.prank(barb);
        handler.liquidateMe();

        // totalBoldDeposits = 42_136.817533286760414734 ether
        // P = 0.196809499552886498 ether

        vm.prank(barb);
        handler.provideToSp(70_880.345231597472945064 ether, false);

        // totalBoldDeposits = 113_017.162764884233359798 ether

        vm.prank(dana);
        handler.provideToSp(0.00000011113609781 ether, false);

        // totalBoldDeposits = 113_017.162764995369457608 ether

        vm.prank(dana);
        handler.provideToSp(45_195.914060860661211082 ether, false);

        // totalBoldDeposits = 158_213.07682585603066869 ether

        vm.prank(barb);
        handler.provideToSp(7_983.849831607347650797 ether, false);

        // totalBoldDeposits = 166_196.926657463378319487 ether

        // coll = 735.070479452054794639 ether, debt = 98_009.397260273972618434 ether
        vm.prank(hope);
        handler.openTrove(98_000.000000000000015693 ether);

        vm.prank(carl);
        handler.provideToSp(0.00000000050183005 ether, false);

        // totalBoldDeposits = 166_196.926657463880149537 ether

        vm.prank(gabe);
        handler.liquidateMe();

        // totalBoldDeposits = 68_187.529397189907523299 ether
        // P = 0.080747302650593231 ether

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(7_203.192719734595086581 ether, false);

        // totalBoldDeposits = 75_390.72211692450260988 ether

        // coll = 212.114138094776477189 ether, debt = 28_281.885079303530291741 ether
        vm.prank(gabe);
        handler.openTrove(28_279.173377746760054476 ether);

        // coll = 750.071917808219178083 ether, debt = 100_009.589041095890410956 ether
        vm.prank(fran);
        handler.openTrove(99_999.999999999999999998 ether);

        vm.prank(dana);
        handler.provideToSp(103_026.554316456522732042 ether, false);

        // totalBoldDeposits = 178_417.276433381025341922 ether

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(98_009.397260273972724248 ether, false);

        // totalBoldDeposits = 276_426.67369365499806617 ether

        vm.prank(eric);
        handler.provideToSp(0.000000000000001628 ether, false);

        // totalBoldDeposits = 276_426.673693654998067798 ether

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(9_122.941722749175152479 ether, false);

        // totalBoldDeposits = 285_549.615416404173220277 ether

        // coll = 735.070479452054794618 ether, debt = 98_009.397260273972615637 ether
        vm.prank(adam);
        handler.openTrove(98_000.000000000000012897 ether);

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(7_203.192719734595086581 ether, false);

        // totalBoldDeposits = 292_752.808136138768306858 ether

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(28_276.461936191234895848 ether, false);

        // totalBoldDeposits = 321_029.270072330003202706 ether

        // pulling `deposited` from fixture
        vm.prank(hope);
        handler.provideToSp(14_980.123886945022979017 ether, false);

        // totalBoldDeposits = 336_009.393959275026181723 ether

        vm.prank(dana);
        handler.provideToSp(58_609.429095898825190413 ether, false);

        // totalBoldDeposits = 394_618.823055173851372136 ether

        vm.prank(hope);
        handler.liquidateMe();

        // totalBoldDeposits = 296_609.425794899878753702 ether
        // P = 0.060692520666533981 ether

        // coll = 15.001438356164383562 ether, debt = 2_000.191780821917808221 ether
        vm.prank(hope);
        handler.openTrove(2_000.000000000000000002 ether);

        vm.prank(fran);
        handler.liquidateMe();

        // totalBoldDeposits = 196_599.836753803988342746 ether
        // P = 0.04022845741749393 ether

        vm.prank(carl);
        handler.provideToSp(5_402.444298333327140135 ether, false);

        // totalBoldDeposits = 202_002.281052137315482881 ether

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 103_992.883791863342867244 ether
        // P = 0.020710029983590154 ether

        // pulling `deposited` from fixture
        vm.prank(fran);
        handler.provideToSp(4_127.357567584137008351 ether, false);

        // totalBoldDeposits = 108_120.241359447479875595 ether

        // coll = 212.134477806648579043 ether, debt = 28_284.597040886477205604 ether
        vm.prank(adam);
        handler.openTrove(28_281.885079303530291741 ether);

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(28_279.173377746760054476 ether, false);

        // totalBoldDeposits = 136_399.414737194239930071 ether

        // coll = 735.070479452054794543 ether, debt = 98_009.39726027397260569 ether
        vm.prank(barb);
        handler.openTrove(98_000.00000000000000295 ether);

        // coll = 735.070479452054794531 ether, debt = 98_009.397260273972604071 ether
        vm.prank(fran);
        handler.openTrove(98_000.000000000000001332 ether);

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 108_114.817696307762724467 ether
        // P = 0.016415474512665603 ether

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(28_279.173377746760054476 ether, false);

        // totalBoldDeposits = 136_393.991074054522778943 ether

        vm.prank(hope);
        handler.liquidateMe();

        // totalBoldDeposits = 134_393.799293232604970722 ether
        // P = 0.016174744719952827 ether

        // coll = 197.748067291146799374 ether, debt = 26_366.408972152906583169 ether
        vm.prank(hope);
        handler.openTrove(26_363.88092877617462122 ether);

        vm.prank(fran);
        handler.provideToSp(53_501.727764378375272893 ether, false);

        // totalBoldDeposits = 187_895.527057610980243615 ether

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(100_009.589041095890510966 ether, false);

        // totalBoldDeposits = 287_905.116098706870754581 ether

        vm.prank(barb);
        handler.liquidateMe();

        // totalBoldDeposits = 189_895.718838432898148891 ether
        // P = 0.010668496681283479 ether

        vm.prank(hope);
        handler.liquidateMe();

        // totalBoldDeposits = 163_529.309866279991565722 ether
        // P = 0.009187210276632602 ether

        // pulling `deposited` from fixture
        vm.prank(eric);
        handler.provideToSp(7_203.192719734595086581 ether, false);

        // totalBoldDeposits = 170_732.502586014586652303 ether

        vm.prank(gabe);
        handler.liquidateMe();

        // totalBoldDeposits = 142_450.617506711056360562 ether
        // P = 0.007665346417627682 ether

        // coll = 735.070479452054794678 ether, debt = 98_009.397260273972623677 ether
        vm.prank(gabe);
        handler.openTrove(98_000.000000000000020936 ether);

        vm.prank(gabe);
        handler.liquidateMe();

        // totalBoldDeposits = 44_441.220246437083736885 ether
        // P = 0.002391406610750427 ether

        // pulling `deposited` from fixture
        vm.prank(eric);
        handler.provideToSp(98_009.397260273972702081 ether, false);

        // totalBoldDeposits = 142_450.617506711056438966 ether

        // coll = 387.055734406178125123 ether, debt = 51_607.431254157083349661 ether
        vm.prank(adam);
        handler.openTrove(51_602.483070848919754617 ether);

        // pulling `deposited` from fixture
        vm.prank(carl);
        handler.provideToSp(11_114.168704751488694317 ether, false);

        // totalBoldDeposits = 153_564.786211462545133283 ether

        // coll = 261.726531711891681095 ether, debt = 34_896.870894918890812555 ether
        vm.prank(hope);
        handler.openTrove(34_893.524940472544130242 ether);

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 101_957.354957305461783622 ether
        // P = 0.00158774350992017 ether

        vm.prank(carl);
        handler.provideToSp(0.049730355963373855 ether, false);

        // totalBoldDeposits = 101_957.404687661425157477 ether

        // pulling `deposited` from fixture
        vm.prank(fran);
        handler.provideToSp(28_284.597040886477205604 ether, false);

        // totalBoldDeposits = 130_242.001728547902363081 ether

        vm.prank(fran);
        handler.provideToSp(48_667.900292985662359538 ether, false);

        // totalBoldDeposits = 178_909.902021533564722619 ether

        vm.prank(dana);
        handler.liquidateMe();

        // totalBoldDeposits = 106_335.902284392031381093 ether
        // P = 0.000943682472662849 ether

        vm.prank(fran);
        handler.liquidateMe();

        // totalBoldDeposits = 8_326.505024118058777022 ether
        // P = 0.000073893921817529 ether

        // coll = 151.470551994044601936 ether, debt = 20_196.073599205946924742 ether
        vm.prank(gabe);
        handler.openTrove(20_194.137175093266748479 ether);

        // coll = 212.093800333100700409 ether, debt = 28_279.173377746760054476 ether
        vm.prank(fran);
        handler.openTrove(28_276.461936191234867571 ether);

        vm.prank(eric);
        handler.liquidateMe();

        // totalBoldDeposits = 1_123.312304383463690441 ether
        // P = 0.000009968882665217 ether

        vm.prank(dana);
        handler.provideToSp(2_852.053480319991176208 ether, false);

        // totalBoldDeposits = 3_975.365784703454866649 ether

        // coll = 735.070479452079782458 ether, debt = 98_009.397260277304327642 ether
        vm.prank(adam);
        handler.openTrove(98_000.000000003331405453 ether);

        // pulling `deposited` from fixture
        vm.prank(fran);
        handler.provideToSp(100_009.589041095890510966 ether, false);

        // totalBoldDeposits = 103_984.954825799345377615 ether

        // coll = 735.070479452054794621 ether, debt = 98_009.397260273972616078 ether
        vm.prank(dana);
        handler.openTrove(98_000.000000000000013337 ether);

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 5_975.557565522041049973 ether
        // P = 0.000000572867799286 ether

        vm.prank(eric);
        handler.provideToSp(52_006.981742593048111854 ether, false);

        // totalBoldDeposits = 57_982.539308115089161827 ether

        // pulling `deposited` from fixture
        vm.prank(fran);
        handler.provideToSp(20_196.073599205946944939 ether, false);

        // totalBoldDeposits = 78_178.612907321036106766 ether

        // coll = 15.002876850253330832 ether, debt = 2_000.383580033777444175 ether
        vm.prank(adam);
        handler.openTrove(2_000.191780821917808221 ether);

        vm.prank(adam);
        handler.provideToSp(17_475.158101181705619252 ether, false);

        // totalBoldDeposits = 95_653.771008502741726018 ether

        // pulling `deposited` from fixture
        vm.prank(adam);
        handler.provideToSp(10_332.149862223406230478 ether, false);

        // totalBoldDeposits = 105_985.920870726147956496 ether

        vm.prank(fran);
        handler.provideToSp(0.000000000000020212 ether, false);

        // totalBoldDeposits = 105_985.920870726147976708 ether

        vm.prank(adam);
        handler.provideToSp(77_345.143414797930027166 ether, false);

        // totalBoldDeposits = 183_331.064285524078003874 ether

        vm.prank(barb);
        handler.provideToSp(0.000000000000000001 ether, false);

        // totalBoldDeposits = 183_331.064285524078003875 ether

        // coll = 735.140965662413210834 ether, debt = 98_018.795421655094777835 ether
        vm.prank(carl);
        handler.openTrove(98_009.397260273972616078 ether);

        vm.prank(carl);
        handler.provideToSp(28_281.885079303530291741 ether, false);

        // totalBoldDeposits = 211_612.949364827608295616 ether

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 209_612.565784793830851441 ether
        // P = 0.000000567452462736 ether

        // coll = 735.116261563280042202 ether, debt = 98_015.501541770672293587 ether
        vm.prank(adam);
        handler.openTrove(98_006.103696210761672605 ether);

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 111_597.064243023158557854 ether
        // P = 0.000000302109888793 ether

        vm.prank(dana);
        handler.liquidateMe();

        // totalBoldDeposits = 13_587.666982749185941776 ether
        // P = 0.000000036783840049 ether

        // coll = 735.140965662413210891 ether, debt = 98_018.795421655094785435 ether
        vm.prank(eric);
        handler.openTrove(98_009.397260273972623677 ether);

        // pulling `deposited` from fixture
        vm.prank(carl);
        handler.provideToSp(98_015.501541770672391603 ether, false);

        // totalBoldDeposits = 111_603.168524519858333379 ether

        vm.prank(adam);
        handler.provideToSp(31_612.330986009193455818 ether, false);

        // totalBoldDeposits = 143_215.499510529051789197 ether

        // coll = 497.18795568613956868 ether, debt = 66_291.727424818609157294 ether
        vm.prank(barb);
        handler.openTrove(66_285.371293324728703857 ether);

        vm.prank(gabe);
        handler.liquidateMe();

        // totalBoldDeposits = 123_019.425911323104864455 ether
        // P = 0.000000031596628166 ether

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(2_000.383580033777444175 ether, false);

        // totalBoldDeposits = 125_019.80949135688230863 ether

        // pulling `deposited` from fixture
        vm.prank(barb);
        handler.provideToSp(98_009.397260273972626238 ether, false);

        // totalBoldDeposits = 223_029.206751630854934868 ether

        vm.prank(hope);
        handler.liquidateMe();

        // totalBoldDeposits = 188_132.335856711964122313 ether
        // P = 0.000000026652775879 ether

        // coll = 443.918121581534570342 ether, debt = 59_189.082877537942712236 ether
        vm.prank(hope);
        handler.openTrove(59_183.407756246247866551 ether);

        // pulling `deposited` from fixture
        vm.prank(eric);
        handler.provideToSp(28_281.885079303530291741 ether, false);

        // totalBoldDeposits = 216_414.220936015494414054 ether

        vm.prank(hope);
        handler.provideToSp(7_203.192719734595086581 ether, false);

        // totalBoldDeposits = 223_617.413655750089500635 ether

        vm.prank(eric);
        handler.liquidateMe();

        // totalBoldDeposits = 125_598.6182340949947152 ether
        // P = 0.000000014969996154 ether

        // pulling `deposited` from fixture
        vm.prank(fran);
        handler.provideToSp(28_284.597040886477233889 ether, false);

        // totalBoldDeposits = 153_883.215274981471949089 ether

        vm.prank(fran);
        handler.provideToSp(0.000000232148155373 ether, false);

        // totalBoldDeposits = 153_883.215275213620104462 ether

        vm.prank(barb);
        handler.provideToSp(0.000000000000014235 ether, false);

        // totalBoldDeposits = 153_883.215275213620118697 ether

        // coll = 170.932345052439560746 ether, debt = 22_790.979340325274766096 ether
        vm.prank(adam);
        handler.openTrove(22_788.794113492474117893 ether);

        vm.prank(barb);
        handler.liquidateMe();

        // totalBoldDeposits = 87_591.487850395010961403 ether
        // P = 0.000000008521034824 ether

        // coll = 735.070479452054844487 ether, debt = 98_009.397260273979264887 ether
        vm.prank(eric);
        handler.openTrove(98_000.000000000006661509 ether);

        vm.prank(barb);
        handler.provideToSp(0.000000000000019157 ether, false);

        // totalBoldDeposits = 87_591.48785039501098056 ether

        vm.prank(barb);
        handler.provideToSp(125_482.693298298766496276 ether, false);

        // totalBoldDeposits = 213_074.181148693777476836 ether

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(72_573.999737141533341526 ether, false);

        // totalBoldDeposits = 285_648.180885835310818362 ether

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(7_697.523863364741437469 ether, false);

        // totalBoldDeposits = 293_345.704749200052255831 ether

        vm.prank(barb);
        handler.provideToSp(10_695.146175949584310071 ether, false);

        // totalBoldDeposits = 304_040.850925149636565902 ether

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 281_249.871584824361799806 ether
        // P = 0.000000007882295892 ether

        vm.prank(eric);
        handler.liquidateMe();

        // totalBoldDeposits = 183_240.474324550382534919 ether
        // P = 0.000000005135489057 ether

        // coll = 15.001438356164383562 ether, debt = 2_000.19178082191780822 ether
        vm.prank(barb);
        handler.openTrove(2_000.000000000000000001 ether);

        vm.prank(hope);
        handler.liquidateMe();

        // totalBoldDeposits = 124_051.391447012439822683 ether
        // P = 0.000000003476658558 ether

        // coll = 387.092849339614333984 ether, debt = 51_612.379911948577864502 ether
        vm.prank(eric);
        handler.openTrove(51_607.431254157083349661 ether);

        vm.prank(barb);
        handler.liquidateMe();

        // totalBoldDeposits = 122_051.199666190522014463 ether
        // P = 0.000000003420601276 ether

        // pulling `deposited` from fixture
        vm.prank(fran);
        handler.provideToSp(28_284.597040886477233889 ether, false);

        // totalBoldDeposits = 150_335.796707076999248352 ether

        vm.prank(gabe);
        handler.provideToSp(15_486.177794212508715247 ether, false);

        // totalBoldDeposits = 165_821.974501289507963599 ether

        // coll = 15.001438356164383562 ether, debt = 2_000.191780821917808219 ether
        vm.prank(hope);
        handler.openTrove(2_000 ether);

        vm.prank(gabe);
        handler.provideToSp(2_210.99055961415947915 ether, false);

        // totalBoldDeposits = 168_032.965060903667442749 ether

        // pulling `deposited` from fixture
        vm.prank(adam);
        handler.provideToSp(3_491.628702974305045589 ether, false);

        // totalBoldDeposits = 171_524.593763877972488338 ether

        vm.prank(eric);
        handler.liquidateMe();

        // totalBoldDeposits = 119_912.213851929394623836 ether
        // P = 0.000000002391329796 ether

        // coll = 735.070479452054794524 ether, debt = 98_009.397260273972603177 ether
        vm.prank(adam);
        handler.openTrove(98_000.000000000000000438 ether);

        // coll = 213.264056925706413656 ether, debt = 28_435.207590094188487431 ether
        vm.prank(gabe);
        handler.openTrove(28_432.481187788510137144 ether);

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 21_902.816591655422020659 ether
        // P = 0.436793352815794323 ether

        // pulling `deposited` from fixture
        vm.prank(carl);
        handler.provideToSp(20_196.073599205946924742 ether, false);

        // totalBoldDeposits = 42_098.890190861368945401 ether

        // coll = 197.767029434585676465 ether, debt = 26_368.937257944756861882 ether
        vm.prank(dana);
        handler.openTrove(26_366.408972152906583169 ether);

        vm.prank(hope);
        handler.provideToSp(118_362.452448773787997761 ether, false);

        // totalBoldDeposits = 160_461.342639635156943162 ether

        // pulling `deposited` from fixture
        vm.prank(adam);
        handler.provideToSp(7_718.428390404075875511 ether, false);

        // totalBoldDeposits = 168_179.771030039232818673 ether

        vm.prank(carl);
        handler.liquidateMe();

        // totalBoldDeposits = 70_160.975608384138040838 ether
        // P = 0.182220772362328287 ether

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(6_866.774931095217580838 ether, false);

        // totalBoldDeposits = 77_027.750539479355621676 ether

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(2_134.549253087445261453 ether, false);

        // totalBoldDeposits = 79_162.299792566800883129 ether

        vm.prank(gabe);
        handler.provideToSp(5_371.066727816941678925 ether, false);

        // totalBoldDeposits = 84_533.366520383742562054 ether

        // coll = 735.070479452054794551 ether, debt = 98_009.397260273972606767 ether
        vm.prank(eric);
        handler.openTrove(98_000.000000000000004027 ether);

        // coll = 735.070479452054794529 ether, debt = 98_009.397260273972603757 ether
        vm.prank(carl);
        handler.openTrove(98_000.000000000000001018 ether);

        // coll = 661.284015816160857429 ether, debt = 88_171.202108821447657074 ether
        vm.prank(adam);
        handler.openTrove(88_162.748146670397071054 ether);

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(7_203.192719734595093785 ether, false);

        // totalBoldDeposits = 91_736.559240118337655839 ether

        vm.prank(adam);
        handler.provideToSp(169_355.451545285381203938 ether, false);

        // totalBoldDeposits = 261_092.010785403718859777 ether

        vm.prank(eric);
        handler.provideToSp(0.000000001300773669 ether, false);

        // totalBoldDeposits = 261_092.010785405019633446 ether

        vm.prank(gabe);
        handler.liquidateMe();

        // totalBoldDeposits = 232_656.803195310831146015 ether
        // P = 0.162375333684356504 ether

        // pulling `deposited` from fixture
        vm.prank(adam);
        handler.provideToSp(28_279.173377746760082756 ether, false);

        // totalBoldDeposits = 260_935.976573057591228771 ether

        vm.prank(carl);
        handler.liquidateMe();

        // totalBoldDeposits = 162_926.579312783618625014 ether
        // P = 0.101386010581630156 ether

        vm.prank(eric);
        handler.liquidateMe();

        // totalBoldDeposits = 64_917.182052509646018247 ether
        // P = 0.040396687478903808 ether

        vm.prank(hope);
        handler.liquidateMe();

        // totalBoldDeposits = 62_916.990271687728210028 ether
        // P = 0.039152007415582862 ether

        // pulling `deposited` from fixture
        vm.prank(fran);
        handler.provideToSp(28_276.461936191234867571 ether, false);

        // totalBoldDeposits = 91_193.452207878963077599 ether

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 3_022.250099057515420525 ether
        // P = 0.001297540069218068 ether

        // coll = 735.140654259986691808 ether, debt = 98_018.753901331558907716 ether
        vm.prank(hope);
        handler.openTrove(98_009.355743931455891398 ether);

        vm.prank(dana);
        handler.provideToSp(40_955.227054936825038894 ether, false);

        // totalBoldDeposits = 43_977.477153994340459419 ether

        vm.prank(barb);
        handler.provideToSp(21_183.197275633065138814 ether, false);

        // totalBoldDeposits = 65_160.674429627405598233 ether

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(10_597.35431639066253481 ether, false);

        // totalBoldDeposits = 75_758.028746018068133043 ether

        // coll = 15.001438356164383562 ether, debt = 2_000.19178082191780822 ether
        vm.prank(barb);
        handler.openTrove(2_000.000000000000000001 ether);

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(19_191.171884798977347577 ether, false);

        // totalBoldDeposits = 94_949.20063081704548062 ether

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(38_376.219974865978882777 ether, false);

        // totalBoldDeposits = 133_325.420605683024363397 ether

        // coll = 27.082376666417516489 ether, debt = 3_610.983555522335531794 ether
        vm.prank(adam);
        handler.openTrove(3_610.637330024935880409 ether);

        // coll = 151.485076567523482925 ether, debt = 20_198.010209003131056638 ether
        vm.prank(eric);
        handler.openTrove(20_196.073599205946924742 ether);

        vm.prank(hope);
        handler.provideToSp(45_063.668239772897643351 ether, false);

        // totalBoldDeposits = 178_389.088845455922006748 ether

        // pulling `deposited` from fixture
        vm.prank(hope);
        handler.provideToSp(1.099153507842646919 ether, false);

        // totalBoldDeposits = 178_390.187998963764653667 ether

        vm.prank(hope);
        handler.provideToSp(0.00000000001368704 ether, false);

        // totalBoldDeposits = 178_390.187998963778340707 ether

        // pulling `deposited` from fixture
        vm.prank(hope);
        handler.provideToSp(1.109803997904305171 ether, false);

        // totalBoldDeposits = 178_391.297802961682645878 ether

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 174_780.314247439347114084 ether
        // P = 0.001271275358381372 ether

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(6.738011572562381246 ether, false);

        // totalBoldDeposits = 174_787.05225901190949533 ether

        vm.prank(dana);
        handler.liquidateMe();

        // totalBoldDeposits = 148_418.115001067152633448 ether
        // P = 0.001079486666201507 ether

        // coll = 517.646580268358284784 ether, debt = 69_019.544035781104637756 ether
        vm.prank(adam);
        handler.openTrove(69_012.926357911167950419 ether);

        vm.prank(adam);
        handler.provideToSp(40_474.031081466471471988 ether, false);

        // totalBoldDeposits = 188_892.146082533624105436 ether

        vm.prank(carl);
        handler.provideToSp(0.010654065586010047 ether, false);

        // totalBoldDeposits = 188_892.156736599210115483 ether

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(7_203.192719734595093785 ether, false);

        // totalBoldDeposits = 196_095.349456333805209268 ether

        vm.prank(eric);
        handler.provideToSp(21_348.717284693164989548 ether, false);

        // totalBoldDeposits = 217_444.066741026970198816 ether

        // coll = 15.002876850253330832 ether, debt = 2_000.383580033777444173 ether
        vm.prank(gabe);
        handler.openTrove(2_000.191780821917808219 ether);

        // coll = 735.211147199436279573 ether, debt = 98_028.152959924837276378 ether
        vm.prank(carl);
        handler.openTrove(98_018.753901331558907716 ether);

        vm.prank(eric);
        handler.liquidateMe();

        // totalBoldDeposits = 197_246.056532023839142178 ether
        // P = 0.000979214982401606 ether

        // coll = 735.140965662413210744 ether, debt = 98_018.795421655094765827 ether
        vm.prank(dana);
        handler.openTrove(98_009.397260273972604071 ether);

        vm.prank(fran);
        handler.provideToSp(64_349.693803520460900733 ether, false);

        // totalBoldDeposits = 261_595.750335544300042911 ether

        // pulling `deposited` from fixture
        vm.prank(carl);
        handler.provideToSp(20_198.010209003131056638 ether, false);

        // totalBoldDeposits = 281_793.760544547431099549 ether

        // pulling `deposited` from fixture
        vm.prank(carl);
        handler.provideToSp(2_000.191780821917808219 ether, false);

        // totalBoldDeposits = 283_793.952325369348907768 ether

        // coll = 16.433936029743427258 ether, debt = 2_191.191470632456967713 ether
        vm.prank(eric);
        handler.openTrove(2_190.981376527858405949 ether);

        vm.prank(eric);
        handler.provideToSp(0.000000000000000003 ether, false);

        // totalBoldDeposits = 283_793.952325369348907771 ether

        // pulling `deposited` from fixture
        vm.prank(hope);
        handler.provideToSp(2_000.383580033777446176 ether, false);

        // totalBoldDeposits = 285_794.335905403126353947 ether

        vm.prank(carl);
        handler.liquidateMe();

        // totalBoldDeposits = 187_766.182945478289077569 ether
        // P = 0.00064334185961415 ether

        vm.prank(barb);
        handler.provideToSp(23_862.208877916221456296 ether, false);

        // totalBoldDeposits = 211_628.391823394510533865 ether

        vm.prank(hope);
        handler.provideToSp(26_368.937257944756861882 ether, false);

        // totalBoldDeposits = 237_997.329081339267395747 ether

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 168_977.785045558162757991 ether
        // P = 0.00045677185909736 ether

        vm.prank(eric);
        handler.liquidateMe();

        // totalBoldDeposits = 166_786.593574925705790278 ether
        // P = 0.00045084874558626 ether

        // pulling `deposited` from fixture
        vm.prank(carl);
        handler.provideToSp(28_279.173377746760054476 ether, false);

        // totalBoldDeposits = 195_065.766952672465844754 ether

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(31_669.587953377532084414 ether, false);

        // totalBoldDeposits = 226_735.354906049997929168 ether

        // coll = 735.070479479623171012 ether, debt = 98_009.397263949756134816 ether
        vm.prank(eric);
        handler.openTrove(98_000.000003675431093479 ether);

        // coll = 212.154819468904011098 ether, debt = 28_287.309262520534813007 ether
        vm.prank(adam);
        handler.openTrove(28_284.597040886477205604 ether);

        vm.prank(dana);
        handler.liquidateMe();

        // totalBoldDeposits = 128_716.559484394903163341 ether
        // P = 0.000255944642615461 ether

        vm.prank(eric);
        handler.liquidateMe();

        // totalBoldDeposits = 30_707.162220445147028525 ether
        // P = 0.000061059227279918 ether

        vm.prank(fran);
        handler.provideToSp(0.00000000000001447 ether, false);

        // totalBoldDeposits = 30_707.162220445147042995 ether

        // pulling `deposited` from fixture
        vm.prank(adam);
        handler.provideToSp(98_009.397260273972603757 ether, false);

        // totalBoldDeposits = 128_716.559480719119646752 ether

        // pulling `deposited` from fixture
        vm.prank(adam);
        handler.provideToSp(7_203.192719734595093785 ether, false);

        // totalBoldDeposits = 135_919.752200453714740537 ether

        // pulling `deposited` from fixture
        vm.prank(barb);
        handler.provideToSp(20_430.963516910854734298 ether, false);

        // totalBoldDeposits = 156_350.715717364569474835 ether

        // coll = 735.07060480817355789 ether, debt = 98_009.413974423141051906 ether
        vm.prank(carl);
        handler.openTrove(98_000.016712546595487956 ether);

        vm.prank(gabe);
        handler.liquidateMe();

        // totalBoldDeposits = 154_350.332137330792030662 ether
        // P = 0.000060278022824921 ether

        // coll = 735.070479452054794702 ether, debt = 98_009.397260273972626926 ether
        vm.prank(dana);
        handler.openTrove(98_000.000000000000024184 ether);

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(3_610.983555522335535405 ether, false);

        // totalBoldDeposits = 157_961.315692853127566067 ether

        // pulling `deposited` from fixture
        vm.prank(eric);
        handler.provideToSp(98_009.397260277304327642 ether, false);

        // totalBoldDeposits = 255_970.712953130431893709 ether

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(51_612.379911948577916115 ether, false);

        // totalBoldDeposits = 307_583.092865079009809824 ether

        vm.prank(carl);
        handler.provideToSp(43_392.91760181421015885 ether, false);

        // totalBoldDeposits = 350_976.010466893219968674 ether

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 322_688.701204372685155667 ether
        // P = 0.000055419847272941 ether

        vm.prank(fran);
        handler.provideToSp(0.000000000000005437 ether, false);

        // totalBoldDeposits = 322_688.701204372685161104 ether

        // coll = 735.07047945205479453 ether, debt = 98_009.397260273972603928 ether
        vm.prank(adam);
        handler.openTrove(98_000.000000000000001189 ether);

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 224_679.303944098712557176 ether
        // P = 0.00003858732166171 ether

        vm.prank(dana);
        handler.liquidateMe();

        // totalBoldDeposits = 126_669.90668382473993025 ether
        // P = 0.000021754796050479 ether

        vm.prank(gabe);
        handler.provideToSp(5_966.758068024307190228 ether, false);

        // totalBoldDeposits = 132_636.664751849047120478 ether

        vm.prank(carl);
        handler.provideToSp(0.012820845162158187 ether, false);

        // totalBoldDeposits = 132_636.677572694209278665 ether

        vm.prank(fran);
        handler.provideToSp(58_077.35957209945457682 ether, false);

        // totalBoldDeposits = 190_714.037144793663855485 ether

        // coll = 735.070491735654094392 ether, debt = 98_009.398898087212585509 ether
        vm.prank(gabe);
        handler.openTrove(98_000.001637656204456315 ether);

        // pulling `deposited` from fixture
        vm.prank(hope);
        handler.provideToSp(22_790.979340325274766096 ether, false);

        // totalBoldDeposits = 213_505.016485118938621581 ether

        // coll = 76.407411375152727949 ether, debt = 10_187.654850020363726401 ether
        vm.prank(eric);
        handler.openTrove(10_186.678045276296136361 ether);

        // pulling `deposited` from fixture
        vm.prank(fran);
        handler.provideToSp(98_028.152959924837374407 ether, false);

        // totalBoldDeposits = 311_533.169445043775995988 ether

        vm.prank(barb);
        handler.provideToSp(18_840.018039105368775261 ether, false);

        // totalBoldDeposits = 330_373.187484149144771249 ether

        // coll = 193.633357658356869418 ether, debt = 25_817.781021114249255706 ether
        vm.prank(dana);
        handler.openTrove(25_815.305580853071563913 ether);

        vm.prank(eric);
        handler.provideToSp(0.00000000000000108 ether, false);

        // totalBoldDeposits = 330_373.187484149144772329 ether

        // pulling `deposited` from fixture
        vm.prank(hope);
        handler.provideToSp(28_435.207590094188487431 ether, false);

        // totalBoldDeposits = 358_808.39507424333325976 ether

        vm.prank(hope);
        handler.provideToSp(0.000000000000010222 ether, false);

        // totalBoldDeposits = 358_808.395074243333269982 ether

        vm.prank(dana);
        handler.provideToSp(1_320.983509178266986989 ether, false);

        // totalBoldDeposits = 360_129.378583421600256971 ether

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(0.964444671443677399 ether, false);

        // totalBoldDeposits = 360_130.34302809304393437 ether

        vm.prank(carl);
        handler.liquidateMe();

        // totalBoldDeposits = 262_120.929053669902882464 ether
        // P = 0.000015834231862212 ether

        vm.prank(hope);
        handler.provideToSp(36.04838160213574232 ether, false);

        // totalBoldDeposits = 262_156.977435272038624784 ether

        vm.prank(carl);
        handler.provideToSp(0.00000004745079447 ether, false);

        // totalBoldDeposits = 262_156.977435319489419254 ether

        // coll = 517.696217611671689003 ether, debt = 69_026.162348222891866967 ether
        vm.prank(carl);
        handler.openTrove(69_019.544035781104637756 ether);

        vm.prank(fran);
        handler.liquidateMe();

        // totalBoldDeposits = 233_877.804057572729364778 ether
        // P = 0.000014126175137895 ether

        // pulling `deposited` from fixture
        vm.prank(carl);
        handler.provideToSp(28_940.54751420239501101 ether, false);

        // totalBoldDeposits = 262_818.351571775124375788 ether

        vm.prank(fran);
        handler.provideToSp(0.000000000000000003 ether, false);

        // totalBoldDeposits = 262_818.351571775124375791 ether

        vm.prank(barb);
        handler.liquidateMe();

        // totalBoldDeposits = 260_818.159790953206567571 ether
        // P = 0.000014018667198528 ether

        // coll = 750.071917808219178083 ether, debt = 100_009.589041095890410956 ether
        vm.prank(adam);
        handler.openTrove(99_999.999999999999999998 ether);

        // pulling `deposited` from fixture
        vm.prank(fran);
        handler.provideToSp(3_610.983555522335531794 ether, false);

        // totalBoldDeposits = 264_429.143346475542099365 ether

        vm.prank(dana);
        handler.liquidateMe();

        // totalBoldDeposits = 238_611.362325361292843659 ether
        // P = 0.00001264994181766 ether

        vm.prank(adam);
        handler.provideToSp(1_200.684027535573554832 ether, false);

        // totalBoldDeposits = 239_812.046352896866398491 ether

        vm.prank(hope);
        handler.liquidateMe();

        // totalBoldDeposits = 141_793.292451565307490775 ether
        // P = 0.000007479511254439 ether

        vm.prank(gabe);
        handler.liquidateMe();

        // totalBoldDeposits = 43_783.893553478094905266 ether
        // P = 0.000002309574162037 ether

        vm.prank(carl);
        handler.provideToSp(106_825.887204152091547508 ether, false);

        // totalBoldDeposits = 150_609.780757630186452774 ether

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 50_600.191716534296041818 ether
        // P = 0.000000775944927313 ether

        // coll = 735.070479455018001563 ether, debt = 98_009.397260669066875052 ether
        vm.prank(hope);
        handler.openTrove(98_000.000000395056390193 ether);

        vm.prank(carl);
        handler.provideToSp(5_708.250732151631567845 ether, false);

        // totalBoldDeposits = 56_308.442448685927609663 ether

        vm.prank(carl);
        handler.provideToSp(81_053.660208964921071107 ether, false);

        // totalBoldDeposits = 137_362.10265765084868077 ether

        vm.prank(fran);
        handler.provideToSp(31_329.389054002845513915 ether, false);

        // totalBoldDeposits = 168_691.491711653694194685 ether

        vm.prank(carl);
        handler.liquidateMe();

        // totalBoldDeposits = 99_665.329363430802327718 ether
        // P = 0.000000458439284423 ether

        // coll = 15.001438356164383562 ether, debt = 2_000.19178082191780822 ether
        vm.prank(fran);
        handler.openTrove(2_000.000000000000000001 ether);

        // pulling `deposited` from fixture
        vm.prank(eric);
        handler.provideToSp(4_125.857325965774507712 ether, false);

        // totalBoldDeposits = 103_791.18668939657683543 ether

        vm.prank(gabe);
        handler.provideToSp(6_158.378764443511857106 ether, false);

        // totalBoldDeposits = 109_949.565453840088692536 ether

        // coll = 443.960689072645128452 ether, debt = 59_194.758543019350460167 ether
        vm.prank(dana);
        handler.openTrove(59_189.082877537942712236 ether);

        vm.prank(adam);
        handler.provideToSp(38_669.837411800794048741 ether, false);

        // totalBoldDeposits = 148_619.402865640882741277 ether

        // coll = 608.165542922133951899 ether, debt = 81_088.739056284526919848 ether
        vm.prank(gabe);
        handler.openTrove(81_080.964169309387663497 ether);

        // pulling `deposited` from fixture
        vm.prank(barb);
        handler.provideToSp(98_009.397260273972616078 ether, false);

        // totalBoldDeposits = 246_628.800125914855357355 ether

        vm.prank(hope);
        handler.provideToSp(700.179491275546795139 ether, false);

        // totalBoldDeposits = 247_328.979617190402152494 ether

        // pulling `deposited` from fixture
        vm.prank(barb);
        handler.provideToSp(1_114.342911790312239349 ether, false);

        // totalBoldDeposits = 248_443.322528980714391843 ether

        vm.prank(eric);
        handler.liquidateMe();

        // totalBoldDeposits = 238_255.667678960350665442 ether
        // P = 0.000000439640545331 ether

        // coll = 143.285786476507227958 ether, debt = 19_104.771530200963727709 ether
        vm.prank(eric);
        handler.openTrove(19_102.939741458632078058 ether);

        vm.prank(dana);
        handler.liquidateMe();

        // totalBoldDeposits = 179_060.909135941000205275 ether
        // P = 0.000000330411597368 ether

        // pulling `deposited` from fixture
        vm.prank(hope);
        handler.provideToSp(13_877.310326107221825752 ether, false);

        // totalBoldDeposits = 192_938.219462048222031027 ether

        vm.prank(eric);
        handler.liquidateMe();

        // totalBoldDeposits = 173_833.447931847258303318 ether
        // P = 0.000000297694191266 ether

        vm.prank(fran);
        handler.liquidateMe();

        // totalBoldDeposits = 171_833.256151025340495098 ether
        // P = 0.000000294268812079 ether

        vm.prank(carl);
        handler.provideToSp(991.554779447762634754 ether, false);

        // totalBoldDeposits = 172_824.810930473103129852 ether

        // pulling `deposited` from fixture
        vm.prank(eric);
        handler.provideToSp(3_606.586198797072017743 ether, false);

        // totalBoldDeposits = 176_431.397129270175147595 ether

        vm.prank(eric);
        handler.provideToSp(587.339419783342194551 ether, false);

        // totalBoldDeposits = 177_018.736549053517342146 ether

        // coll = 500.857826775587502992 ether, debt = 66_781.043570078333732179 ether
        vm.prank(fran);
        handler.openTrove(66_774.640522357011826936 ether);

        // coll = 735.369505324153573118 ether, debt = 98_049.267376553809749034 ether
        vm.prank(dana);
        handler.openTrove(98_039.866293484571502452 ether);

        vm.prank(fran);
        handler.liquidateMe();

        // totalBoldDeposits = 110_237.692978975183609967 ether
        // P = 0.000000183254697167 ether

        // coll = 750.071917808219178083 ether, debt = 100_009.589041095890410955 ether
        vm.prank(barb);
        handler.openTrove(99_999.999999999999999997 ether);

        // coll = 278.239501960215884977 ether, debt = 37_098.600261362117996907 ether
        vm.prank(carl);
        handler.openTrove(37_095.04320242489917096 ether);

        // pulling `deposited` from fixture
        vm.prank(hope);
        handler.provideToSp(98_009.397260273979362897 ether, false);

        // totalBoldDeposits = 208_247.090239249162972864 ether

        vm.prank(fran);
        handler.provideToSp(188_066.550586338573484215 ether, false);

        // totalBoldDeposits = 396_313.640825587736457079 ether

        vm.prank(barb);
        handler.liquidateMe();

        // totalBoldDeposits = 296_304.051784491846046124 ether
        // P = 0.000000137010447498 ether

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(10_619.918266821517099228 ether, false);

        // totalBoldDeposits = 306_923.970051313363145352 ether

        vm.prank(barb);
        handler.provideToSp(0.000000000000000001 ether, false);

        // totalBoldDeposits = 306_923.970051313363145353 ether

        vm.prank(carl);
        handler.liquidateMe();

        // totalBoldDeposits = 269_825.369789951245148446 ether
        // P = 0.000000120449682229 ether

        vm.prank(hope);
        handler.provideToSp(5_260.555739098740315187 ether, false);

        // totalBoldDeposits = 275_085.925529049985463633 ether

        vm.prank(dana);
        handler.liquidateMe();

        // totalBoldDeposits = 177_036.658152496175714599 ether
        // P = 0.000000077517630814 ether

        vm.prank(hope);
        handler.liquidateMe();

        // totalBoldDeposits = 79_027.260891827108839547 ether
        // P = 0.000000034603037009 ether

        vm.prank(hope);
        handler.provideToSp(735.070479452054794529 ether, false);

        // totalBoldDeposits = 79_762.331371279163634076 ether

        vm.prank(hope);
        handler.provideToSp(0.000000000000861025 ether, false);

        // totalBoldDeposits = 79_762.331371279164495101 ether

        // coll = 735.070479452069202438 ether, debt = 98_009.397260275893658302 ether
        vm.prank(fran);
        handler.openTrove(98_000.00000000192087137 ether);

        // coll = 508.601353210050790499 ether, debt = 67_813.513761340105399857 ether
        vm.prank(eric);
        handler.openTrove(67_807.011719120463711556 ether);

        // coll = 319.684290785467252668 ether, debt = 42_624.572104728967022286 ether
        vm.prank(carl);
        handler.openTrove(42_620.485208887018951976 ether);

        vm.prank(hope);
        handler.provideToSp(14_056.341287047622549574 ether, false);

        // totalBoldDeposits = 93_818.672658326787044675 ether

        // coll = 735.070479452054794522 ether, debt = 98_009.397260273972602903 ether
        vm.prank(dana);
        handler.openTrove(98_000.000000000000000164 ether);

        // coll = 544.357191658509444315 ether, debt = 72_580.958887801259241983 ether
        vm.prank(barb);
        handler.openTrove(72_573.999737141533341526 ether);

        vm.prank(adam);
        handler.provideToSp(3_610.983555522335531794 ether, false);

        // totalBoldDeposits = 97_429.656213849122576469 ether

        vm.prank(carl);
        handler.liquidateMe();

        // totalBoldDeposits = 54_805.084109120155554183 ether
        // P = 0.000000019464528845 ether

        // coll = 15.001438356164383562 ether, debt = 2_000.191780821917808219 ether
        vm.prank(hope);
        handler.openTrove(2_000 ether);

        vm.prank(carl);
        handler.provideToSp(8_443.061629342576891915 ether, false);

        // totalBoldDeposits = 63_248.145738462732446098 ether

        vm.prank(carl);
        handler.provideToSp(72_580.958887801259241983 ether, false);

        // totalBoldDeposits = 135_829.104626263991688081 ether

        vm.prank(hope);
        handler.provideToSp(93.3700286235112182 ether, false);

        // totalBoldDeposits = 135_922.474654887502906281 ether

        vm.prank(gabe);
        handler.liquidateMe();

        // totalBoldDeposits = 54_833.735598602975986433 ether
        // P = 0.000000007852364599 ether

        // pulling `deposited` from fixture
        vm.prank(eric);
        handler.provideToSp(2_000.19178082191781022 ether, false);

        // totalBoldDeposits = 56_833.927379424893796653 ether

        // pulling `deposited` from fixture
        vm.prank(eric);
        handler.provideToSp(7_203.192719734595093785 ether, false);

        // totalBoldDeposits = 64_037.120099159488890438 ether

        vm.prank(eric);
        handler.provideToSp(274_245.06787137850800868 ether, false);

        // totalBoldDeposits = 338_282.187970537996899118 ether

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(0.000000000000000003 ether, false);

        // totalBoldDeposits = 338_282.187970537996899121 ether

        // coll = 15.001438356164383562 ether, debt = 2_000.19178082191780822 ether
        vm.prank(carl);
        handler.openTrove(2_000.000000000000000001 ether);

        vm.prank(fran);
        handler.provideToSp(0.181573511635796686 ether, false);

        // totalBoldDeposits = 338_282.369544049632695807 ether

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(1_460.576157988085089255 ether, false);

        // totalBoldDeposits = 339_742.945702037717785062 ether

        // coll = 735.070479452054794613 ether, debt = 98_009.397260273972614959 ether
        vm.prank(adam);
        handler.openTrove(98_000.000000000000012219 ether);

        // pulling `deposited` from fixture
        vm.prank(eric);
        handler.provideToSp(98_009.398898087212585509 ether, false);

        // totalBoldDeposits = 437_752.344600124930370571 ether

        vm.prank(hope);
        handler.liquidateMe();

        // totalBoldDeposits = 435_752.152819303012562352 ether
        // P = 0.000000007816485328 ether

        vm.prank(gabe);
        handler.provideToSp(0.000000000000019905 ether, false);

        // totalBoldDeposits = 435_752.152819303012582257 ether

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 337_742.755559029039967298 ether
        // P = 0.000000006058401035 ether

        // coll = 735.13278143530641484 ether, debt = 98_017.704191374188645223 ether
        vm.prank(gabe);
        handler.openTrove(98_008.306134621553701718 ether);

        vm.prank(dana);
        handler.liquidateMe();

        // totalBoldDeposits = 239_733.358298755067364395 ether
        // P = 0.000000004300316741 ether

        // coll = 15.001438356164383562 ether, debt = 2_000.19178082191780822 ether
        vm.prank(hope);
        handler.openTrove(2_000.000000000000000001 ether);

        // coll = 469.810276194584395539 ether, debt = 62_641.370159277919405116 ether
        vm.prank(dana);
        handler.openTrove(62_635.364028480667834228 ether);

        vm.prank(eric);
        handler.provideToSp(21_097.460509412491003887 ether, false);

        // totalBoldDeposits = 260_830.818808167558368282 ether

        vm.prank(eric);
        handler.provideToSp(83_757.266675643468347618 ether, false);

        // totalBoldDeposits = 344_588.0854838110267159 ether

        vm.prank(fran);
        handler.liquidateMe();

        // totalBoldDeposits = 246_578.688223535133057598 ether
        // P = 0.000000003077200012 ether

        vm.prank(dana);
        handler.liquidateMe();

        // totalBoldDeposits = 183_937.318064257213652482 ether
        // P = 0.000000002295461629 ether

        // coll = 668.766201175330133997 ether, debt = 89_168.826823377351199558 ether
        vm.prank(fran);
        handler.openTrove(89_160.277207754689790948 ether);

        vm.prank(hope);
        handler.provideToSp(38_233.653891621233262723 ether, false);

        // totalBoldDeposits = 222_170.971955878446915205 ether

        vm.prank(carl);
        handler.provideToSp(0.000000021524550851 ether, false);

        // totalBoldDeposits = 222_170.971955899971466056 ether

        vm.prank(carl);
        handler.liquidateMe();

        // totalBoldDeposits = 220_170.780175078053657836 ether
        // P = 0.000000002274795728 ether

        vm.prank(hope);
        handler.liquidateMe();

        // totalBoldDeposits = 218_170.588394256135849616 ether
        // P = 0.000000002254129826 ether

        vm.prank(gabe);
        handler.liquidateMe();

        // totalBoldDeposits = 120_152.884202881947204393 ether
        // P = 0.000000001241414812 ether

        // coll = 99.499550069000631429 ether, debt = 13_266.606675866750857192 ether
        vm.prank(dana);
        handler.openTrove(13_265.334657474938191886 ether);

        vm.prank(barb);
        handler.provideToSp(59_096.520374013452717244 ether, false);

        // totalBoldDeposits = 179_249.404576895399921637 ether

        vm.prank(adam);
        handler.provideToSp(23_015.108655260103608912 ether, false);

        // totalBoldDeposits = 202_264.513232155503530549 ether

        vm.prank(adam);
        handler.provideToSp(11_640.920533719287905407 ether, false);

        // totalBoldDeposits = 213_905.433765874791435956 ether

        // coll = 212.093800333100700409 ether, debt = 28_279.173377746760054476 ether
        vm.prank(gabe);
        handler.openTrove(28_276.461936191234867571 ether);

        // pulling `deposited` from fixture
        vm.prank(fran);
        handler.provideToSp(11_951.860820266565233373 ether, false);

        // totalBoldDeposits = 225_857.294586141356669329 ether

        vm.prank(eric);
        handler.liquidateMe();

        // totalBoldDeposits = 158_043.780824801251269472 ether
        // P = 0.868680778364501791 ether

        vm.prank(gabe);
        handler.provideToSp(14_072.771289030588622223 ether, false);

        // totalBoldDeposits = 172_116.552113831839891695 ether

        vm.prank(barb);
        handler.liquidateMe();

        // totalBoldDeposits = 99_535.593226030580649712 ether
        // P = 0.502361077634044115 ether

        vm.prank(gabe);
        handler.liquidateMe();

        // totalBoldDeposits = 71_256.419848283820595236 ether
        // P = 0.359634686478828868 ether

        // pulling `deposited` from fixture
        vm.prank(barb);
        handler.provideToSp(4_878.710419896136587321 ether, false);

        // totalBoldDeposits = 76_135.130268179957182557 ether

        vm.prank(adam);
        handler.provideToSp(14_374.214356116689334934 ether, false);

        // totalBoldDeposits = 90_509.344624296646517491 ether

        // pulling `deposited` from fixture
        vm.prank(barb);
        handler.provideToSp(3_677.370505812043912663 ether, false);

        // totalBoldDeposits = 94_186.715130108690430154 ether

        // pulling `deposited` from fixture
        vm.prank(hope);
        handler.provideToSp(639.80319832560635617 ether, false);

        // totalBoldDeposits = 94_826.518328434296786324 ether

        // coll = 213.284506903767782764 ether, debt = 28_437.934253835704368518 ether
        vm.prank(barb);
        handler.openTrove(28_435.207590094188487431 ether);

        vm.prank(barb);
        handler.liquidateMe();

        // totalBoldDeposits = 66_388.584074598592417806 ether
        // P = 0.251782286646312349 ether

        // coll = 735.07047945560555349 ether, debt = 98_009.397260747407131972 ether
        vm.prank(eric);
        handler.openTrove(98_000.000000473389135754 ether);

        // pulling `deposited` from fixture
        vm.prank(adam);
        handler.provideToSp(72_573.999737141533341526 ether, false);

        // totalBoldDeposits = 138_962.583811740125759332 ether

        vm.prank(fran);
        handler.liquidateMe();

        // totalBoldDeposits = 49_793.756988362774559774 ether
        // P = 0.090219868192905479 ether

        // coll = 735.070479452054794547 ether, debt = 98_009.39726027397260621 ether
        vm.prank(hope);
        handler.openTrove(98_000.00000000000000347 ether);

        // coll = 735.070479461551818819 ether, debt = 98_009.397261540242509165 ether
        vm.prank(adam);
        handler.openTrove(98_000.000001266148494926 ether);

        // pulling `deposited` from fixture
        vm.prank(eric);
        handler.provideToSp(28_437.934253835704396956 ether, false);

        // totalBoldDeposits = 78_231.69124219847895673 ether

        vm.prank(eric);
        handler.provideToSp(76_531.421401180754433115 ether, false);

        // totalBoldDeposits = 154_763.112643379233389845 ether

        // pulling `deposited` from fixture
        vm.prank(hope);
        handler.provideToSp(20_198.010209003131056638 ether, false);

        // totalBoldDeposits = 174_961.122852382364446483 ether

        // pulling `deposited` from fixture
        vm.prank(barb);
        handler.provideToSp(28_279.173377746760054476 ether, false);

        // totalBoldDeposits = 203_240.296230129124500959 ether

        vm.prank(dana);
        handler.liquidateMe();

        // totalBoldDeposits = 189_973.689554262373643767 ether
        // P = 0.08433072353082255 ether

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(2_000.191780821917810221 ether, false);

        // totalBoldDeposits = 191_973.881335084291453988 ether

        // pulling `deposited` from fixture
        vm.prank(carl);
        handler.provideToSp(69_026.162348222891866967 ether, false);

        // totalBoldDeposits = 261_000.043683307183320955 ether

        // coll = 195.211213953575393473 ether, debt = 26_028.161860476719129601 ether
        vm.prank(gabe);
        handler.openTrove(26_025.666248644657313147 ether);

        vm.prank(eric);
        handler.liquidateMe();

        // totalBoldDeposits = 162_990.646422559776188983 ether
        // P = 0.052663282915956226 ether

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(2_000.383580033777444175 ether, false);

        // totalBoldDeposits = 164_991.030002593553633158 ether

        vm.prank(hope);
        handler.liquidateMe();

        // totalBoldDeposits = 66_981.632742319581026948 ether
        // P = 0.021379784556930176 ether

        // coll = 735.078238459032984122 ether, debt = 98_010.431794537731216171 ether
        vm.prank(carl);
        handler.openTrove(98_001.034435071354510944 ether);

        vm.prank(gabe);
        handler.provideToSp(127_043.190467742264219876 ether, false);

        // totalBoldDeposits = 194_024.823210061845246824 ether

        vm.prank(eric);
        handler.provideToSp(10_187.654850020363726401 ether, false);

        // totalBoldDeposits = 204_212.478060082208973225 ether

        vm.prank(dana);
        handler.provideToSp(2_000.19178082191780822 ether, false);

        // totalBoldDeposits = 206_212.669840904126781445 ether

        vm.prank(carl);
        handler.liquidateMe();

        // totalBoldDeposits = 108_202.238046366395565274 ether
        // P = 0.011218226987671323 ether

        vm.prank(carl);
        handler.provideToSp(3_923.019318064356157605 ether, false);

        // totalBoldDeposits = 112_125.257364430751722879 ether

        vm.prank(carl);
        handler.provideToSp(6_975.91127252392829994 ether, false);

        // totalBoldDeposits = 119_101.168636954680022819 ether

        vm.prank(gabe);
        handler.liquidateMe();

        // totalBoldDeposits = 93_073.006776477960893218 ether
        // P = 0.008766615209513851 ether

        vm.prank(adam);
        handler.provideToSp(0.000000000000000084 ether, false);

        // totalBoldDeposits = 93_073.006776477960893302 ether

        vm.prank(fran);
        handler.provideToSp(0.000000004191118464 ether, false);

        // totalBoldDeposits = 93_073.006776482152011766 ether

        // coll = 735.141091030552423847 ether, debt = 98_018.812137406989846253 ether
        vm.prank(eric);
        handler.openTrove(98_009.413974423141051906 ether);

        // coll = 735.070479452054794643 ether, debt = 98_009.397260273972618968 ether
        vm.prank(fran);
        handler.openTrove(98_000.000000000000016227 ether);

        // coll = 351.402972089012993467 ether, debt = 46_853.729611868399128896 ether
        vm.prank(barb);
        handler.openTrove(46_849.237219258333261323 ether);

        // coll = 313.566752994904857452 ether, debt = 41_808.900399320647660165 ether
        vm.prank(gabe);
        handler.openTrove(41_804.89171107438025384 ether);

        // pulling `deposited` from fixture
        vm.prank(eric);
        handler.provideToSp(2_000.191780821917808221 ether, false);

        // totalBoldDeposits = 95_073.198557304069819987 ether

        // pulling `deposited` from fixture
        vm.prank(adam);
        handler.provideToSp(2_000.191780821917810221 ether, false);

        // totalBoldDeposits = 97_073.390338125987630208 ether

        vm.prank(gabe);
        handler.liquidateMe();

        // totalBoldDeposits = 55_264.489938805339970043 ether
        // P = 0.004990889020729643 ether

        vm.prank(carl);
        handler.provideToSp(840.618911668657767952 ether, false);

        // totalBoldDeposits = 56_105.108850473997737995 ether

        // coll = 735.271010848292029883 ether, debt = 98_036.134779772270651031 ether
        vm.prank(dana);
        handler.openTrove(98_026.73495587239247641 ether);

        // coll = 15.004315482280067453 ether, debt = 2_000.575397637342326941 ether
        vm.prank(carl);
        handler.openTrove(2_000.383580033777444173 ether);

        vm.prank(barb);
        handler.liquidateMe();

        // totalBoldDeposits = 9_251.379238605598609099 ether
        // P = 0.00082296617927643 ether

        vm.prank(hope);
        handler.provideToSp(98_009.397260273972626926 ether, false);

        // totalBoldDeposits = 107_260.776498879571236025 ether

        vm.prank(hope);
        handler.provideToSp(0.000000000000000008 ether, false);

        // totalBoldDeposits = 107_260.776498879571236033 ether

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(10_187.654850020363726401 ether, false);

        // totalBoldDeposits = 117_448.431348899934962434 ether

        // coll = 735.211458631723305252 ether, debt = 98_028.194484229774033498 ether
        vm.prank(barb);
        handler.openTrove(98_018.795421655094777835 ether);

        vm.prank(carl);
        handler.liquidateMe();

        // totalBoldDeposits = 115_447.855951262592635493 ether
        // P = 0.000808948061942389 ether

        vm.prank(barb);
        handler.liquidateMe();

        // totalBoldDeposits = 17_419.661467032818601995 ether
        // P = 0.000122060312574342 ether

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(2_000.19178082191780822 ether, false);

        // totalBoldDeposits = 19_419.853247854736410215 ether

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(98_009.397263949756232826 ether, false);

        // totalBoldDeposits = 117_429.250511804492643041 ether

        // pulling `deposited` from fixture
        vm.prank(barb);
        handler.provideToSp(28_435.207590094188515867 ether, false);

        // totalBoldDeposits = 145_864.458101898681158908 ether

        vm.prank(eric);
        handler.liquidateMe();

        // totalBoldDeposits = 47_845.645964491691312655 ether
        // P = 0.00004003754291993 ether

        vm.prank(hope);
        handler.provideToSp(0.000000000000000001 ether, false);

        // totalBoldDeposits = 47_845.645964491691312656 ether

        // pulling `deposited` from fixture
        vm.prank(adam);
        handler.provideToSp(66_291.727424818609157294 ether, false);

        // totalBoldDeposits = 114_137.37338931030046995 ether

        vm.prank(dana);
        handler.provideToSp(34_514.867687279318087443 ether, false);

        // totalBoldDeposits = 148_652.241076589618557393 ether

        vm.prank(fran);
        handler.liquidateMe();

        // totalBoldDeposits = 50_642.843816315645938425 ether
        // P = 0.000013639989671184 ether

        // coll = 352.109720323032555887 ether, debt = 46_947.962709737674118221 ether
        vm.prank(carl);
        handler.openTrove(46_943.461281943515151015 ether);

        vm.prank(eric);
        handler.provideToSp(132_655.49297647131706795 ether, false);

        // totalBoldDeposits = 183_298.336792786963006375 ether

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(20_196.073599205946944939 ether, false);

        // totalBoldDeposits = 203_494.410391992909951314 ether

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 105_485.013130452667442149 ether
        // P = 0.000007070535681016 ether

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(2_433.132675147864181608 ether, false);

        // totalBoldDeposits = 107_918.145805600531623757 ether

        vm.prank(carl);
        handler.liquidateMe();

        // totalBoldDeposits = 60_970.183095862857505536 ether
        // P = 0.000003994618808907 ether

        // coll = 15.002876850253330832 ether, debt = 2_000.383580033777444175 ether
        vm.prank(gabe);
        handler.openTrove(2_000.191780821917808221 ether);

        // coll = 418.713296854525609391 ether, debt = 55_828.439580603414585439 ether
        vm.prank(fran);
        handler.openTrove(55_823.086681880494538018 ether);

        vm.prank(fran);
        handler.provideToSp(2_000.191780821917808221 ether, false);

        // totalBoldDeposits = 62_970.374876684775313757 ether

        // coll = 16.435511886622991697 ether, debt = 2_191.401584883065559477 ether
        vm.prank(carl);
        handler.openTrove(2_191.191470632456967713 ether);

        // coll = 735.070479572086427116 ether, debt = 98_009.397276278190282122 ether
        vm.prank(adam);
        handler.openTrove(98_000.000016002683175517 ether);

        vm.prank(dana);
        handler.provideToSp(144_474.430256544008468299 ether, false);

        // totalBoldDeposits = 207_444.805133228783782056 ether

        vm.prank(barb);
        handler.provideToSp(30_891.30993096708868557 ether, false);

        // totalBoldDeposits = 238_336.115064195872467626 ether

        vm.prank(gabe);
        handler.provideToSp(6_403.809474203878459994 ether, false);

        // totalBoldDeposits = 244_739.92453839975092762 ether

        vm.prank(carl);
        handler.provideToSp(8_750.712699789005768654 ether, false);

        // totalBoldDeposits = 253_490.637238188756696274 ether

        vm.prank(gabe);
        handler.liquidateMe();

        // totalBoldDeposits = 251_490.253658154979252099 ether
        // P = 0.00000396309586999 ether

        // pulling `deposited` from fixture
        vm.prank(fran);
        handler.provideToSp(2_000.19178082191781022 ether, false);

        // totalBoldDeposits = 253_490.445438976897062319 ether

        vm.prank(dana);
        handler.provideToSp(325.521972998768376221 ether, false);

        // totalBoldDeposits = 253_815.96741197566543854 ether

        // pulling `deposited` from fixture
        vm.prank(barb);
        handler.provideToSp(66.458390359133408403 ether, false);

        // totalBoldDeposits = 253_882.425802334798846943 ether

        // pulling `deposited` from fixture
        vm.prank(fran);
        handler.provideToSp(6.220868309032641881 ether, false);

        // totalBoldDeposits = 253_888.646670643831488824 ether

        // pulling `deposited` from fixture
        vm.prank(barb);
        handler.provideToSp(2.896719015833063074 ether, false);

        // totalBoldDeposits = 253_891.543389659664551898 ether

        vm.prank(dana);
        handler.liquidateMe();

        // totalBoldDeposits = 155_855.408609887393900867 ether
        // P = 0.000002432810159531 ether

        // pulling `deposited` from fixture
        vm.prank(hope);
        handler.provideToSp(4.326669099518489625 ether, false);

        // totalBoldDeposits = 155_859.735278986912390492 ether

        vm.prank(carl);
        handler.liquidateMe();

        // totalBoldDeposits = 153_668.333694103846831015 ether
        // P = 0.000002398604634738 ether

        vm.prank(fran);
        handler.liquidateMe();

        // totalBoldDeposits = 97_839.894113500432245576 ether
        // P = 0.00000152718011474 ether

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(1.708704760958511302 ether, false);

        // totalBoldDeposits = 97_841.602818261390756878 ether

        // coll = 450.991202005541885359 ether, debt = 60_132.16026740558471443 ether
        vm.prank(barb);
        handler.openTrove(60_126.394722706147138677 ether);

        // coll = 212.093800333100700409 ether, debt = 28_279.173377746760054476 ether
        vm.prank(eric);
        handler.openTrove(28_276.461936191234867571 ether);

        // coll = 735.070479452054794544 ether, debt = 98_009.397260273972605844 ether
        vm.prank(dana);
        handler.openTrove(98_000.000000000000003104 ether);

        vm.prank(barb);
        handler.liquidateMe();

        // totalBoldDeposits = 37_709.442550855806042448 ether
        // P = 0.000000588595333097 ether

        // coll = 721.927275004936852279 ether, debt = 96_256.970000658246970478 ether
        vm.prank(hope);
        handler.openTrove(96_247.740765242401808661 ether);

        // pulling `deposited` from fixture
        vm.prank(hope);
        handler.provideToSp(2_000.191780821917810221 ether, false);

        // totalBoldDeposits = 39_709.634331677723852669 ether

        vm.prank(carl);
        handler.provideToSp(215_905.794225194415503585 ether, false);

        // totalBoldDeposits = 255_615.428556872139356254 ether

        // pulling `deposited` from fixture
        vm.prank(hope);
        handler.provideToSp(28_279.173377746760082756 ether, false);

        // totalBoldDeposits = 283_894.60193461889943901 ether

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(28_284.597040886477233889 ether, false);

        // totalBoldDeposits = 312_179.198975505376672899 ether

        vm.prank(hope);
        handler.provideToSp(2_534.83011119743893462 ether, false);

        // totalBoldDeposits = 314_714.029086702815607519 ether

        vm.prank(hope);
        handler.liquidateMe();

        // totalBoldDeposits = 218_457.059086044568637041 ether
        // P = 0.000000408570300578 ether

        vm.prank(hope);
        handler.provideToSp(0.000000000000016955 ether, false);

        // totalBoldDeposits = 218_457.059086044568653996 ether

        // coll = 57.953212469014889301 ether, debt = 7_727.094995868651906762 ether
        vm.prank(hope);
        handler.openTrove(7_726.354112597580905854 ether);

        vm.prank(hope);
        handler.liquidateMe();

        // totalBoldDeposits = 210_729.964090175916747234 ether
        // P = 0.000000394118666292 ether

        // pulling `deposited` from fixture
        vm.prank(carl);
        handler.provideToSp(9_416.412249962597121674 ether, false);

        // totalBoldDeposits = 220_146.376340138513868908 ether

        // coll = 632.924278300284559828 ether, debt = 84_389.903773371274643656 ether
        vm.prank(fran);
        handler.openTrove(84_381.8123667059740708 ether);

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(28_276.461936191234867571 ether, false);

        // totalBoldDeposits = 248_422.838276329748736479 ether

        // pulling `deposited` from fixture
        vm.prank(barb);
        handler.provideToSp(2_000.19178082191781022 ether, false);

        // totalBoldDeposits = 250_423.030057151666546699 ether

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 152_413.632780873476264577 ether
        // P = 0.000000239870341248 ether

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(26_028.16186047671915563 ether, false);

        // totalBoldDeposits = 178_441.794641350195420207 ether

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(2_000.383580033777446176 ether, false);

        // totalBoldDeposits = 180_442.178221383972866383 ether

        vm.prank(fran);
        handler.liquidateMe();

        // totalBoldDeposits = 96_052.274448012698222727 ether
        // P = 0.000000127686841716 ether

        vm.prank(carl);
        handler.provideToSp(0.000065629200646993 ether, false);

        // totalBoldDeposits = 96_052.27451364189886972 ether

        vm.prank(gabe);
        handler.provideToSp(26_925.63798950431391582 ether, false);

        // totalBoldDeposits = 122_977.91250314621278554 ether

        // coll = 735.140965662413260705 ether, debt = 98_018.795421655101427282 ether
        vm.prank(carl);
        handler.openTrove(98_009.397260273979264887 ether);

        // pulling `deposited` from fixture
        vm.prank(adam);
        handler.provideToSp(2_000.383580033777444175 ether, false);

        // totalBoldDeposits = 124_978.296083179990229715 ether

        vm.prank(carl);
        handler.liquidateMe();

        // totalBoldDeposits = 26_959.500661524888802433 ether
        // P = 0.000000027543770411 ether

        // pulling `deposited` from fixture
        vm.prank(barb);
        handler.provideToSp(28_276.461936191234867571 ether, false);

        // totalBoldDeposits = 55_235.962597716123670004 ether

        // coll = 489.354614519513293973 ether, debt = 65_247.281935935105863003 ether
        vm.prank(barb);
        handler.openTrove(65_241.025947145653540061 ether);

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(7_727.094995868651906762 ether, false);

        // totalBoldDeposits = 62_963.057593584775576766 ether

        vm.prank(gabe);
        handler.provideToSp(125_493.367851671998899348 ether, false);

        // totalBoldDeposits = 188_456.425445256774476114 ether

        vm.prank(eric);
        handler.liquidateMe();

        // totalBoldDeposits = 160_177.252067510014421638 ether
        // P = 0.000000023410639598 ether

        // coll = 288.779681677176185452 ether, debt = 38_503.957556956824726877 ether
        vm.prank(carl);
        handler.openTrove(38_500.26575065196768888 ether);

        // pulling `deposited` from fixture
        vm.prank(fran);
        handler.provideToSp(15_228.59530001064662931 ether, false);

        // totalBoldDeposits = 175_405.847367520661050948 ether

        // pulling `deposited` from fixture
        vm.prank(carl);
        handler.provideToSp(21_523.188103775604494379 ether, false);

        // totalBoldDeposits = 196_929.035471296265545327 ether

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(521.190673062530333491 ether, false);

        // totalBoldDeposits = 197_450.226144358795878818 ether

        // coll = 304.311340504907979163 ether, debt = 40_574.845400654397221728 ether
        vm.prank(fran);
        handler.openTrove(40_570.95503510308596691 ether);

        // pulling `deposited` from fixture
        vm.prank(barb);
        handler.provideToSp(8_620.497290242565920867 ether, false);

        // totalBoldDeposits = 206_070.723434601361799685 ether

        // coll = 735.101608054811195911 ether, debt = 98_013.54774064149278813 ether
        vm.prank(hope);
        handler.openTrove(98_004.150082414411954108 ether);

        // pulling `deposited` from fixture
        vm.prank(eric);
        handler.provideToSp(98_009.397260273972701187 ether, false);

        // totalBoldDeposits = 304_080.120694875334500872 ether

        // pulling `deposited` from fixture
        vm.prank(adam);
        handler.provideToSp(25_872.571918570624937083 ether, false);

        // totalBoldDeposits = 329_952.692613445959437955 ether

        // pulling `deposited` from fixture
        vm.prank(hope);
        handler.provideToSp(6_135.327451498724588662 ether, false);

        // totalBoldDeposits = 336_088.020064944684026617 ether

        // pulling `deposited` from fixture
        vm.prank(dana);
        handler.provideToSp(2_205.113862383885336052 ether, false);

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

    function testNotEnoughYieldGains1CollSkin() external {
        // coll = 735.070479452054794554 ether, debt = 98_009.397260273972607081 ether
        vm.prank(barb);
        handler.openTrove(98_000.000000000000004341 ether);

        // coll = 527.780858402245104475 ether, debt = 70_370.781120299347263236 ether
        vm.prank(fran);
        handler.openTrove(70_364.033884173467615657 ether);

        // pulling `deposited` from fixture
        vm.prank(hope);
        handler.provideToSp(98_009.397260273972607081 ether, false);

        // totalBoldDeposits = 98_009.397260273972607081 ether

        // coll = 750.071917808219178083 ether, debt = 100_009.589041095890410955 ether
        vm.prank(eric);
        handler.openTrove(99_999.999999999999999997 ether);

        vm.prank(hope);
        handler.provideToSp(0.000000000000290715 ether, false);

        // totalBoldDeposits = 98_009.397260273972897796 ether

        // coll = 546.940373432087633662 ether, debt = 72_925.383124278351154915 ether
        vm.prank(carl);
        handler.openTrove(72_918.390949803712442763 ether);

        // coll = 15.073363060611747045 ether, debt = 2_009.781741414899605925 ether
        vm.prank(adam);
        handler.openTrove(2_009.589041095890410955 ether);

        vm.prank(barb);
        handler.liquidateMe();

        // totalBoldDeposits = 0.000000000000290715 ether
        // P = 0.000000002 ether

        vm.prank(barb);
        handler.provideToSp(98_009.397260275068501431 ether, false);

        // totalBoldDeposits = 98_009.397260275068792146 ether

        // pulling `deposited` from fixture
        vm.prank(adam);
        handler.provideToSp(98_009.397260273972705091 ether, false);

        // totalBoldDeposits = 196_018.794520549041497237 ether

        vm.prank(gabe);
        handler.provideToSp(0.000000000000011355 ether, false);

        // totalBoldDeposits = 196_018.794520549041508592 ether

        // coll = 735.070479452054794562 ether, debt = 98_009.397260273972608258 ether
        vm.prank(hope);
        handler.openTrove(98_000.000000000000005518 ether);

        vm.prank(barb);
        handler.provideToSp(0.000000000000000001 ether, false);

        // totalBoldDeposits = 196_018.794520549041508593 ether

        // pulling `deposited` from fixture
        vm.prank(barb);
        handler.provideToSp(98_009.397260273972607081 ether, false);

        // totalBoldDeposits = 294_028.191780823014115674 ether

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 292_018.410039408114509749 ether
        // P = 0.000000001986329327 ether

        // coll = 735.070479452637885892 ether, debt = 98_009.397260351718118851 ether
        vm.prank(adam);
        handler.openTrove(98_000.000000077738061777 ether);

        vm.prank(adam);
        handler.provideToSp(54_014.318999987483020796 ether, false);

        // totalBoldDeposits = 346_032.729039395597530545 ether

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 248_023.331779043879411694 ether
        // P = 0.000000001423726649 ether

        vm.prank(hope);
        handler.provideToSp(10_010.417493024139740761 ether, false);

        // totalBoldDeposits = 258_033.749272068019152455 ether

        // pulling `deposited` from fixture
        vm.prank(barb);
        handler.provideToSp(70_370.781120299347263236 ether, false);

        // totalBoldDeposits = 328_404.530392367366415691 ether

        // coll = 735.070479454295710315 ether, debt = 98_009.397260572761375235 ether
        vm.prank(barb);
        handler.openTrove(98_000.000000298760124265 ether);

        vm.prank(hope);
        handler.liquidateMe();

        // totalBoldDeposits = 230_395.133132093393807433 ether
        // P = 0.998828153948292459 ether

        // coll = 524.06108178133886219 ether, debt = 69_874.810904178514958649 ether
        vm.prank(hope);
        handler.openTrove(69_868.111222280488062534 ether);

        // pulling `deposited` from fixture
        vm.prank(adam);
        handler.provideToSp(2_009.781741414899605925 ether, false);

        // totalBoldDeposits = 232_404.914873508293413358 ether

        // pulling `deposited` from fixture
        vm.prank(eric);
        handler.provideToSp(100_009.589041095890410955 ether, false);

        // totalBoldDeposits = 332_414.503914604183824313 ether

        vm.prank(fran);
        handler.provideToSp(30_916.784221979109139156 ether, false);

        // totalBoldDeposits = 363_331.288136583292963469 ether

        vm.prank(hope);
        handler.provideToSp(38_550.515608151943845641 ether, false);

        // totalBoldDeposits = 401_881.80374473523680911 ether

        // coll = 735.070479452054794637 ether, debt = 98_009.397260273972618144 ether
        vm.prank(dana);
        handler.openTrove(98_000.000000000000015403 ether);

        // pulling `deposited` from fixture
        vm.prank(fran);
        handler.provideToSp(69_874.810904178514958649 ether, false);

        // totalBoldDeposits = 471_756.614648913751767759 ether

        vm.prank(carl);
        handler.provideToSp(21_247.332926908151003382 ether, false);

        // totalBoldDeposits = 493_003.947575821902771141 ether

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(1_048.559292073714518627 ether, false);

        // totalBoldDeposits = 494_052.506867895617289768 ether

        vm.prank(dana);
        handler.liquidateMe();

        // totalBoldDeposits = 396_043.109607621644671624 ether
        // P = 0.800682118913113001 ether

        vm.prank(fran);
        handler.liquidateMe();

        // totalBoldDeposits = 325_672.328487322297408388 ether
        // P = 0.658413197247500853 ether

        // pulling `deposited` from fixture
        vm.prank(barb);
        handler.provideToSp(2_009.781741414899605925 ether, false);

        // totalBoldDeposits = 327_682.110228737197014313 ether

        // coll = 203.858718000716882513 ether, debt = 27_181.162400095584334962 ether
        vm.prank(adam);
        handler.openTrove(27_178.556237168732538692 ether);

        vm.prank(hope);
        handler.liquidateMe();

        // totalBoldDeposits = 257_807.299324558682055664 ether
        // P = 0.518013412766223987 ether

        // coll = 597.837266373950539075 ether, debt = 79_711.635516526738543272 ether
        vm.prank(hope);
        handler.openTrove(79_703.992667914746718245 ether);

        vm.prank(hope);
        handler.provideToSp(79_079.315486624542686247 ether, false);

        // totalBoldDeposits = 336_886.614811183224741911 ether

        // coll = 449.401073316219739167 ether, debt = 59_920.143108829298555506 ether
        vm.prank(dana);
        handler.openTrove(59_914.397892593022512252 ether);

        vm.prank(dana);
        handler.liquidateMe();

        // totalBoldDeposits = 276_966.471702353926186405 ether
        // P = 0.425877256384225684 ether

        // coll = 15.001438356164383562 ether, debt = 2_000.19178082191780822 ether
        vm.prank(fran);
        handler.openTrove(2_000.000000000000000001 ether);

        vm.prank(fran);
        handler.liquidateMe();

        // totalBoldDeposits = 274_966.279921532008378185 ether
        // P = 0.422801663217215364 ether

        vm.prank(dana);
        handler.provideToSp(69_304.757955701409074879 ether, false);

        // totalBoldDeposits = 344_271.037877233417453064 ether

        vm.prank(adam);
        handler.liquidateMe();

        // totalBoldDeposits = 317_089.875477137833118102 ether
        // P = 0.389420288060598885 ether

        // pulling `deposited` from fixture
        vm.prank(carl);
        handler.provideToSp(2_009.781741414899605925 ether, false);

        // totalBoldDeposits = 319_099.657218552732724027 ether

        // coll = 314.202875422794292693 ether, debt = 41_893.716723039239025707 ether
        vm.prank(gabe);
        handler.openTrove(41_889.699902500643073632 ether);

        // coll = 47.278710891097670152 ether, debt = 6_303.828118813022686857 ether
        vm.prank(fran);
        handler.openTrove(6_303.223700102053996748 ether);

        // pulling `deposited` from fixture
        vm.prank(barb);
        handler.provideToSp(2.035382243718835535 ether, false);

        // totalBoldDeposits = 319_101.692600796451559562 ether

        // coll = 735.070479452054794666 ether, debt = 98_009.397260273972622067 ether
        vm.prank(dana);
        handler.openTrove(98_000.000000000000019326 ether);

        // coll = 735.140965662413220228 ether, debt = 98_018.795421655096030284 ether
        vm.prank(adam);
        handler.openTrove(98_009.397260273973868407 ether);

        vm.prank(dana);
        handler.liquidateMe();

        // totalBoldDeposits = 221_092.295340522478937495 ether
        // P = 0.269813126460584544 ether

        // pulling `deposited` from fixture
        vm.prank(gabe);
        handler.provideToSp(98_009.397260273972706268 ether, false);

        // totalBoldDeposits = 319_101.692600796451643763 ether

        vm.prank(fran);
        handler.liquidateMe();

        // totalBoldDeposits = 312_797.864481983428956906 ether
        // P = 0.264482989977933867 ether

        vm.prank(dana);
        handler.provideToSp(28_196.603228065989990891 ether, false);

        // totalBoldDeposits = 340_994.467710049418947797 ether

        vm.prank(hope);
        handler.liquidateMe();

        invariant_allFundsClaimable();

        // totalBoldDeposits = 261_282.832193522680404525 ether
        // P = 0.202656849985044645 ether

        // coll = 736.109464646854184108 ether, debt = 98_147.928619580557880966 ether
        vm.prank(fran);
        handler.openTrove(98_138.518076751280360932 ether);

        invariant_allFundsClaimable();
    }
}
