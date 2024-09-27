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
}
