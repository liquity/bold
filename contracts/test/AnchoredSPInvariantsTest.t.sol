// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Strings} from "openzeppelin-contracts/contracts/utils/Strings.sol";

import "./TestContracts/DevTestSetup.sol";
import {BaseInvariantTest} from "./TestContracts/BaseInvariantTest.sol";
import {BaseMultiCollateralTest} from "./TestContracts/BaseMultiCollateralTest.sol";
import {AdjustedTroveProperties, InvariantsTestHandler} from "./TestContracts/InvariantsTestHandler.t.sol";
import {Logging} from "./Utils/Logging.sol";
import {TroveId} from "./Utils/TroveId.sol";

contract AnchoredInvariantsTest is Logging, BaseInvariantTest, BaseMultiCollateralTest, TroveId {
    using Strings for uint256;
    using StringFormatting for uint256;

    InvariantsTestHandler handler;

    function setUp() public override {
        super.setUp();

        TestDeployer.TroveManagerParams[] memory p = new TestDeployer.TroveManagerParams[](4);
        p[0] = TestDeployer.TroveManagerParams(1.5 ether, 1.1 ether, 0.1 ether, 1.01 ether, 0.05 ether, 0.1 ether);
        p[1] = TestDeployer.TroveManagerParams(1.6 ether, 1.2 ether, 0.1 ether, 1.01 ether, 0.05 ether, 0.1 ether);
        p[2] = TestDeployer.TroveManagerParams(1.6 ether, 1.2 ether, 0.1 ether, 1.01 ether, 0.05 ether, 0.1 ether);
        p[3] = TestDeployer.TroveManagerParams(1.6 ether, 1.25 ether, 0.1 ether, 1.01 ether, 0.05 ether, 0.1 ether);
        TestDeployer deployer = new TestDeployer();
        Contracts memory contracts;
        (contracts.branches, contracts.collateralRegistry, contracts.boldToken, contracts.hintHelpers,, contracts.weth)
        = deployer.deployAndConnectContractsMultiColl(p);
        contracts.systemParams = contracts.branches[0].systemParams;
        setupContracts(contracts);

        handler = new InvariantsTestHandler({contracts: contracts, assumeNoExpectedFailures: true});
        vm.label(address(handler), "handler");

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
    }

    function testWrongYield() external {
        vm.prank(adam);
        handler.addMeToUrgentRedemptionBatch();

        vm.prank(adam);
        handler.registerBatchManager(
            0,
            0.257486338754888547 ether,
            0.580260126400716372 ether,
            0.474304801140122485 ether,
            0.84978254245815657 ether,
            2121012
        );

        vm.prank(eric);
        handler.registerBatchManager(
            2,
            0.995000000000011223 ether,
            0.999999999997818617 ether,
            0.999999999561578875 ether,
            0.000000000000010359 ether,
            5174410
        );

        vm.prank(fran);
        handler.warp(3_662_052);

        vm.prank(adam);
        handler.addMeToUrgentRedemptionBatch();

        vm.prank(hope);
        handler.addMeToLiquidationBatch();

        vm.prank(barb);
        handler.addMeToLiquidationBatch();

        // upper hint: 0
        // lower hint: 0
        // upfront fee: 1_246.586073354248297808 ether
        vm.prank(hope);
        handler.openTrove(
            0, 99_999.999999999999999997 ether, 2.251600954885856105 ether, 0.650005595391858041 ether, 8768, 0
        );

        vm.prank(adam);
        handler.addMeToLiquidationBatch();

        vm.prank(eric);
        handler.addMeToLiquidationBatch();

        vm.prank(hope);
        handler.warp(9_396_472);

        vm.prank(gabe);
        handler.addMeToUrgentRedemptionBatch();

        vm.prank(adam);
        handler.addMeToUrgentRedemptionBatch();

        vm.prank(dana);
        handler.registerBatchManager(
            2,
            0.995000000000011139 ether,
            0.998635073564148166 ether,
            0.996010156573547401 ether,
            0.000000000000011577 ether,
            9078342
        );

        vm.prank(carl);
        handler.registerBatchManager(
            1, 0.995000004199127012 ether, 1 ether, 0.999139502777974999 ether, 0.059938454189132239 ether, 1706585
        );

        // initial deposit: 0 ether
        // compounded deposit: 0 ether
        // yield gain: 0 ether
        // coll gain: 0 ether
        // stashed coll: 0 ether
        // pendingYield: 897.541972815058774421 ether
        vm.prank(gabe);
        handler.provideToSP(0, 58_897.613356828171795189 ether, false);
    }

    function testRedeemUnderflow() external {
        vm.prank(fran);
        handler.warp(18_162);

        vm.prank(carl);
        handler.registerBatchManager(
            0,
            0.995000001857124003 ether,
            0.999999628575220679 ether,
            0.999925530120657388 ether,
            0.249999999999999999 ether,
            12664
        );

        vm.prank(hope);
        handler.addMeToLiquidationBatch();

        vm.prank(fran);
        handler.addMeToUrgentRedemptionBatch();

        vm.prank(fran);
        handler.addMeToUrgentRedemptionBatch();

        vm.prank(gabe);
        handler.addMeToUrgentRedemptionBatch();

        vm.prank(dana);
        handler.addMeToLiquidationBatch();

        vm.prank(eric);
        handler.warp(4_641_555);

        vm.prank(adam);
        handler.addMeToUrgentRedemptionBatch();

        vm.prank(dana);
        handler.addMeToLiquidationBatch();

        vm.prank(gabe);
        handler.addMeToLiquidationBatch();

        vm.prank(fran);
        handler.addMeToLiquidationBatch();

        vm.prank(hope);
        handler.registerBatchManager(
            0,
            0.739903753088089514 ether,
            0.780288740735740819 ether,
            0.767858707410717411 ether,
            0.000000000000022941 ether,
            21644
        );

        // upper hint: 80084422859880547211683076133703299733277748156566366325829078699459944778998
        // lower hint: 104346312485569601582594868672255666718935311025283394307913733247512361320190
        // upfront fee: 290.81243876303301812 ether
        vm.prank(adam);
        handler.openTrove(
            3, 39_503.887731534058892956 ether, 1.6863644596244192 ether, 0.38385567397413886 ether, 1, 7433679
        );

        vm.prank(adam);
        handler.addMeToUrgentRedemptionBatch();

        vm.prank(hope);
        handler.warp(23_201);

        vm.prank(carl);
        handler.warp(18_593_995);

        // redemption rate: 0.195871664252157123 ether
        // redeemed BOLD: 15_191.361299840412827416 ether
        // redeemed Troves: [
        //   [],
        //   [],
        //   [],
        //   [adam],
        // ]
        vm.prank(carl);
        handler.redeemCollateral(15_191.361299840412827416 ether, 0);

        // redemption rate: 0.195871664252157123 ether
        // redeemed BOLD: 0.000000000000006302 ether
        // redeemed Troves: [
        //   [],
        //   [],
        //   [],
        //   [adam],
        // ]
        vm.prank(dana);
        handler.redeemCollateral(0.000000000000006302 ether, 1);

        vm.prank(hope);
        handler.registerBatchManager(
            1,
            0.822978751289802582 ether,
            0.835495454680029657 ether,
            0.833312890646159679 ether,
            0.422857251385135959 ether,
            29470036
        );

        vm.prank(gabe);
        handler.addMeToUrgentRedemptionBatch();

        vm.prank(barb);
        handler.addMeToLiquidationBatch();

        vm.prank(gabe);
        handler.warp(31);

        // initial deposit: 0 ether
        // compounded deposit: 0 ether
        // yield gain: 0 ether
        // coll gain: 0 ether
        // stashed coll: 0 ether
        // pendingYield: 0 ether
        // pendingInterest: 0.012686316538387649 ether
        vm.prank(carl);
        handler.provideToSP(3, 0.000000000000021916 ether, false);

        // upper hint: 0
        // lower hint: 39695913545351040647077841548061220386885435874215782275463606055905069661493
        // upfront fee: 0 ether
        vm.prank(carl);
        handler.setBatchManagerAnnualInterestRate(0, 0.998884384586837808 ether, 15539582, 63731457);

        vm.prank(gabe);
        handler.registerBatchManager(
            0,
            0.351143076054309979 ether,
            0.467168361632094569 ether,
            0.433984569464653931 ether,
            0.000000000000000026 ether,
            16482089
        );

        vm.prank(adam);
        handler.registerBatchManager(
            3,
            0.995000000000006201 ether,
            0.996462074472343849 ether,
            0.995351673013151748 ether,
            0.045759837128294745 ether,
            10150905
        );

        vm.prank(dana);
        handler.warp(23_299);

        vm.prank(carl);
        handler.warp(13_319_679);

        // redemption rate: 0.246264103698059017 ether
        // redeemed BOLD: 16_223.156659761268542045 ether
        // redeemed Troves: [
        //   [],
        //   [],
        //   [],
        //   [adam],
        // ]
        vm.prank(eric);
        handler.redeemCollateral(16_223.156659761268542045 ether, 0);
    }

    function testWrongYieldPrecision() external {
        vm.prank(carl);
        handler.addMeToLiquidationBatch();

        vm.prank(adam);
        handler.addMeToUrgentRedemptionBatch();

        vm.prank(barb);
        handler.warp(19_326);

        vm.prank(carl);
        handler.addMeToUrgentRedemptionBatch();

        vm.prank(dana);
        handler.registerBatchManager(
            3,
            0.30820256993275862 ether,
            0.691797430067250243 ether,
            0.383672204747583321 ether,
            0.000000000000018015 ether,
            11403
        );

        vm.prank(eric);
        handler.registerBatchManager(
            3,
            0.018392910495297323 ether,
            0.98160708950470919 ether,
            0.963214179009414206 ether,
            0.000000000000019546 ether,
            13319597
        );

        vm.prank(fran);
        handler.warp(354);

        vm.prank(adam);
        handler.addMeToUrgentRedemptionBatch();

        vm.prank(eric);
        handler.warp(15_305_108);

        // upper hint: 84669063888545001427406517193344625874395507444463583314999084271619652858036
        // lower hint: 69042136817699606427763587628766179145825895354994492055731203083594873444699
        // upfront fee: 1_702.831959251916404109 ether
        vm.prank(fran);
        handler.openTrove(
            1, 99_999.999999999999999998 ether, 1.883224555937797003 ether, 0.887905235895642125 ether, 4164477, 39
        );

        vm.prank(dana);
        handler.warp(996);

        vm.prank(eric);
        handler.addMeToUrgentRedemptionBatch();

        vm.prank(barb);
        handler.warp(4_143_017);

        vm.prank(fran);
        handler.addMeToLiquidationBatch();

        // initial deposit: 0 ether
        // compounded deposit: 0 ether
        // yield gain: 0 ether
        // coll gain: 0 ether
        // stashed coll: 0 ether
        // pendingYield: 0 ether
        // pendingInterest: 0 ether
        vm.prank(adam);
        handler.provideToSP(0, 0.000000000000011094 ether, true);

        vm.prank(carl);
        handler.addMeToUrgentRedemptionBatch();

        // upper hint: 0
        // lower hint: 0
        // upfront fee: 1_513.428916567114728229 ether
        vm.prank(barb);
        handler.openTrove(
            2,
            79_311.063107967331806055 ether,
            1.900000000000001559 ether,
            0.995000000000007943 ether,
            3270556590,
            1229144376
        );

        vm.prank(fran);
        handler.addMeToLiquidationBatch();

        // price: 221.052631578948441462 ether
        vm.prank(dana);
        handler.setPrice(2, 2.100000000000011917 ether);

        // initial deposit: 0 ether
        // compounded deposit: 0 ether
        // yield gain: 0 ether
        // coll gain: 0 ether
        // stashed coll: 0 ether
        // pendingYield: 1_226.039010661379810958 ether
        // pendingInterest: 11_866.268348193546380256 ether
        vm.prank(carl);
        handler.provideToSP(1, 0.027362680048399155 ether, false);

        // upper hint: 0
        // lower hint: 109724453348421969168156614404527408958334892291486496459024204968877369036377
        // upfront fee: 9.807887080131946403 ether
        vm.prank(eric);
        handler.openTrove(
            3, 30_260.348082017558572105 ether, 1.683511222023706186 ether, 0.016900375815455486 ether, 108, 14159
        );

        vm.prank(carl);
        handler.addMeToUrgentRedemptionBatch();

        vm.prank(adam);
        handler.addMeToLiquidationBatch();

        vm.prank(adam);
        handler.addMeToUrgentRedemptionBatch();

        // redemption rate: 0.1474722457669512 ether
        // redeemed BOLD: 64_016.697525751186019703 ether
        // redeemed Troves: [
        //   [],
        //   [fran],
        //   [barb],
        //   [eric],
        // ]
        vm.prank(dana);
        handler.redeemCollateral(64_016.697525751186019705 ether, 0);

        // upper hint: 102052496222650354016228296600262737092032771006947291868573062530791731100756
        // lower hint: 0
        vm.prank(eric);
        handler.applyMyPendingDebt(3, 2542, 468);

        vm.prank(gabe);
        handler.warp(20_216);

        vm.prank(carl);
        handler.registerBatchManager(
            1,
            0.995000000000425732 ether,
            0.998288014105982235 ether,
            0.996095220733623871 ether,
            0.000000000000027477 ether,
            3299
        );

        vm.prank(carl);
        handler.addMeToLiquidationBatch();

        // redemption rate: 0.108097849716691371 ether
        // redeemed BOLD: 0.000151948988774207 ether
        // redeemed Troves: [
        //   [],
        //   [fran],
        //   [barb],
        //   [eric],
        // ]
        vm.prank(hope);
        handler.redeemCollateral(0.000151948988774209 ether, 0);

        // initial deposit: 0 ether
        // compounded deposit: 0 ether
        // yield gain: 0 ether
        // coll gain: 0 ether
        // stashed coll: 0 ether
        // pendingYield: 0 ether
        // pendingInterest: 0 ether
        vm.prank(eric);
        handler.provideToSP(0, 76_740.446487959260685533 ether, true);

        vm.prank(adam);
        handler.addMeToUrgentRedemptionBatch();

        // initial deposit: 0 ether
        // compounded deposit: 0 ether
        // yield gain: 0 ether
        // coll gain: 0 ether
        // stashed coll: 0 ether
        // pendingYield: 9_803.032557027063219919 ether
        // pendingInterest: 0 ether
        vm.prank(hope);
        handler.provideToSP(1, 4.127947448768090932 ether, false);
    }

    function testSortedTroveSize() external {
        uint256 i = 1;
        TestDeployer.LiquityContractsDev memory c = branches[i];

        vm.prank(adam);
        handler.addMeToLiquidationBatch();

        vm.prank(barb);
        handler.addMeToLiquidationBatch();

        vm.prank(adam);
        handler.addMeToUrgentRedemptionBatch();

        vm.prank(adam);
        handler.registerBatchManager(
            3,
            0.100944149373120884 ether,
            0.377922952132481818 ether,
            0.343424998629201343 ether,
            0.489955880173256455 ether,
            2070930
        );

        vm.prank(carl);
        handler.addMeToLiquidationBatch();

        vm.prank(carl);
        handler.warp(9_303_785);

        vm.prank(barb);
        handler.registerBatchManager(
            1,
            0.301964103682871801 ether,
            0.756908371280377546 ether,
            0.540898165697757771 ether,
            0.000017102564306416 ether,
            27657915
        );

        vm.prank(fran);
        handler.addMeToLiquidationBatch();

        vm.prank(eric);
        handler.addMeToUrgentRedemptionBatch();

        vm.prank(hope);
        handler.addMeToLiquidationBatch();

        // upper hint: 30979495632948298397104351002742564073201815129975103483277328125306028611241
        // lower hint: 36051278007718023196469061266077621121244014979449590376694871896669965056265
        // upfront fee: 118.231198854524639989 ether
        vm.prank(gabe);
        handler.openTrove(
            1, 7_591.289850943621327156 ether, 1.900000000017470971 ether, 0.812103428106344175 ether, 1121, 415425919
        );

        // redemption rate: 0.005000000000000004 ether
        // redeemed BOLD: 0.000000000000071705 ether
        // redeemed Troves: [
        //   [],
        //   [gabe],
        //   [],
        //   [],
        // ]
        vm.prank(hope);
        handler.redeemCollateral(0.000000000000071705 ether, 1);

        // redemption rate: 0.387443853477360594 ether
        // redeemed BOLD: 5_896.917877499258624384 ether
        // redeemed Troves: [
        //   [],
        //   [gabe],
        //   [],
        //   [],
        // ]
        vm.prank(gabe);
        handler.redeemCollateral(5_896.917877499258624384 ether, 1);

        vm.prank(eric);
        handler.warp(11_371_761);

        vm.prank(gabe);
        handler.registerBatchManager(
            0,
            0.23834235868248997 ether,
            0.761711006198436234 ether,
            0.523368647516059893 ether,
            0.761688376122671962 ether,
            31535998
        );

        vm.prank(hope);
        handler.registerBatchManager(
            2,
            0.036127532604869915 ether,
            0.999999999999999999 ether,
            0.963882428861225203 ether,
            0.848537401570757863 ether,
            29802393
        );

        vm.prank(eric);
        handler.addMeToUrgentRedemptionBatch();

        // batch manager: hope
        // upper hint: 111996671338791781291582287523793567344508255320483065919810498665837663289426
        // lower hint: 37857035535383668733402580992354953018471987882089934484705744026840633200601
        // upfront fee: 1_355.203530437779650125 ether
        vm.prank(carl);
        handler.openTroveAndJoinInterestBatchManager(
            2, 73_312.036791249214758342 ether, 1.900020510596646286 ether, 40, 115, 737
        );

        vm.prank(barb);
        handler.registerBatchManager(
            0,
            0.955741837871335122 ether,
            0.974535636428930833 ether,
            0.964294359297779033 ether,
            0.000000000000268875 ether,
            3335617
        );

        vm.prank(gabe);
        handler.addMeToLiquidationBatch();

        // initial deposit: 0 ether
        // compounded deposit: 0 ether
        // yield gain: 0 ether
        // coll gain: 0 ether
        // stashed coll: 0 ether
        // blocked SP yield: 975.74654191520134809 ether
        vm.prank(fran);
        handler.provideToSP(2, 12_633.808570846161076142 ether, true);

        // batch manager: adam
        // upper hint: 7512901306961997563120107574274771509748256751277397278816998908345777536679
        // lower hint: 27989025468780058605431608942843597971189459457295957311648808450848491056535
        // upfront fee: 166.681364294341638522 ether
        vm.prank(carl);
        handler.openTroveAndJoinInterestBatchManager(
            3, 25_307.541971224954454066 ether, 2.401194840294921108 ether, 142, 6432363, 25223
        );

        vm.prank(carl);
        handler.addMeToUrgentRedemptionBatch();

        vm.prank(adam);
        handler.addMeToUrgentRedemptionBatch();

        vm.prank(dana);
        handler.warp(8_774_305);

        vm.prank(adam);
        handler.warp(3_835);

        vm.prank(eric);
        handler.warp(9_078_180);

        // initial deposit: 0 ether
        // compounded deposit: 0 ether
        // yield gain: 0 ether
        // coll gain: 0 ether
        // stashed coll: 0 ether
        // blocked SP yield: 0 ether
        vm.prank(gabe);
        handler.provideToSP(2, 5_179.259567321319728284 ether, true);

        // price: 120.905132749610222778 ether
        vm.prank(hope);
        handler.setPrice(1, 2.100000000000002648 ether);

        vm.prank(barb);
        handler.lowerBatchManagementFee(1, 0.000008085711886436 ether);

        vm.prank(hope);
        handler.addMeToLiquidationBatch();

        vm.prank(adam);
        handler.addMeToLiquidationBatch();

        vm.prank(gabe);
        handler.addMeToLiquidationBatch();

        // price: 80.314880400478576408 ether
        vm.prank(gabe);
        handler.setPrice(1, 1.394988326842136963 ether);

        vm.prank(carl);
        handler.warp(1_849_907);

        // upper hint: 84800337471693920904250232874319843718400766719524250287777680170677855896573
        // lower hint: 0
        // upfront fee: 0 ether
        // function: adjustZombieTrove()
        vm.prank(gabe);
        handler.adjustTrove(
            1,
            uint8(AdjustedTroveProperties.onlyColl),
            29.524853479148084596 ether,
            true,
            0 ether,
            true,
            40,
            14,
            4554760
        );

        info("SortedTroves size: ", c.sortedTroves.getSize().toString());
        info("num troves:        ", handler.numTroves(i).toString());
        info("num zombies:       ", handler.numZombies(i).toString());
        info("gabe debt: ", c.troveManager.getTroveEntireDebt(addressToTroveId(gabe)).decimal());

        // upper hint: 0
        // lower hint: 74750724351164404027318726202729770837051588626953680774538886892291438048970
        // upfront fee: 773.037543760336600445 ether
        vm.prank(carl);
        handler.openTrove(
            0, 40_510.940914935073773948 ether, 2.063402456659389908 ether, 0.995000000000000248 ether, 0, 55487655
        );

        vm.prank(adam);
        handler.registerBatchManager(
            0,
            0.541865737266494949 ether,
            0.672692246806001449 ether,
            0.650860934960147488 ether,
            0.070089828074852802 ether,
            29179158
        );

        vm.prank(fran);
        handler.registerBatchManager(
            1,
            0.566980989185701648 ether,
            0.86881504225021711 ether,
            0.702666683322997409 ether,
            0.667232273668645041 ether,
            7007521
        );

        vm.prank(dana);
        handler.addMeToUrgentRedemptionBatch();

        // initial deposit: 0 ether
        // compounded deposit: 0 ether
        // yield gain: 0 ether
        // coll gain: 0 ether
        // stashed coll: 0 ether
        // blocked SP yield: 1_129.588991574293634631 ether
        vm.prank(barb);
        handler.provideToSP(1, 0.000000000000000002 ether, false);

        info("SortedTroves size: ", c.sortedTroves.getSize().toString());
        info("num troves:        ", handler.numTroves(i).toString());
        info("num zombies:       ", handler.numZombies(i).toString());
        info("gabe debt: ", c.troveManager.getTroveEntireDebt(addressToTroveId(gabe)).decimal());

        // redemption rate: 0.184202341360173417 ether
        // redeemed BOLD: 66_462.494346928386331338 ether
        // redeemed Troves: [
        //   [carl],
        //   [gabe],
        //   [],
        //   [carl],
        // ]
        vm.prank(eric);
        handler.redeemCollateral(66_462.49434692838633134 ether, 1);

        info("SortedTroves size: ", c.sortedTroves.getSize().toString());
        info("num troves:        ", handler.numTroves(i).toString());
        info("num zombies:       ", handler.numZombies(i).toString());
        info("gabe trove Id:     ", addressToTroveId(gabe).toString());
        info("gabe debt: ", c.troveManager.getTroveEntireDebt(addressToTroveId(gabe)).decimal());
        assertEq(c.sortedTroves.getSize(), handler.numTroves(i) - handler.numZombies(i), "Wrong SortedTroves size");
    }

    function testAssertLastZombieTroveInABatchHasMoreThanMinDebt() external {
        uint256 i = 1;
        TestDeployer.LiquityContractsDev memory c = branches[i];

        vm.prank(adam);
        handler.addMeToUrgentRedemptionBatch();

        vm.prank(hope);
        handler.registerBatchManager(
            0,
            0.99500000000072184 ether,
            0.996944021609020651 ether,
            0.99533906344899454 ether,
            0.378970428480541887 ether,
            314055
        );

        vm.prank(dana);
        handler.warp(2_225_439);

        vm.prank(adam);
        handler.addMeToUrgentRedemptionBatch();

        vm.prank(barb);
        handler.addMeToUrgentRedemptionBatch();

        vm.prank(barb);
        handler.registerBatchManager(
            2,
            0.995000000000009379 ether,
            0.999999999998128142 ether,
            0.997477804125778004 ether,
            0.000000001035389259 ether,
            10046
        );

        vm.prank(gabe);
        handler.registerBatchManager(
            2,
            0.346476084765605513 ether,
            0.346476084765605514 ether,
            0.346476084765605514 ether,
            0.000000000000000002 ether,
            27010346
        );

        vm.prank(fran);
        handler.warp(19_697_329);

        vm.prank(gabe);
        handler.addMeToUrgentRedemptionBatch();

        vm.prank(fran);
        handler.registerBatchManager(
            1,
            0.995000000000019257 ether,
            0.999999999996150378 ether,
            0.999999999226237651 ether,
            0.696688179568702502 ether,
            7641047
        );

        vm.prank(gabe);
        handler.warp(977_685);

        vm.prank(gabe);
        handler.addMeToUrgentRedemptionBatch();

        vm.prank(fran);
        handler.addMeToLiquidationBatch();

        // batch manager: fran
        // upper hint: 0
        // lower hint: 60678094901167127062962700790111047491633904950610080336398562382189456360809
        // upfront fee: 242.684833433337541236 ether
        vm.prank(gabe);
        handler.openTroveAndJoinInterestBatchManager(
            1, 12_654.280610244006254376 ether, 2.145058504746006382 ether, 182, 22444926, 124118903
        );

        // redemption rate: 0.005 ether
        // redeemed BOLD: 0.000000000000017162 ether
        // redeemed Troves: [
        //   [],
        //   [gabe],
        //   [],
        //   [],
        // ]
        vm.prank(hope);
        info("gabe trove Id:     ", addressToTroveId(gabe).toString());
        info("gabe debt: ", c.troveManager.getTroveEntireDebt(addressToTroveId(gabe)).decimal());
        handler.redeemCollateral(0.000000000000017162 ether, 0);
        info("gabe trove Id:     ", addressToTroveId(gabe).toString());
        info("gabe debt: ", c.troveManager.getTroveEntireDebt(addressToTroveId(gabe)).decimal());

        // upper hint: 79178440845664423591903906560915994242429107602729190780850212197412640295587
        // lower hint: 0
        // upfront fee: 624.393448965513162837 ether
        vm.prank(hope);
        handler.openTrove(
            0, 32_721.264734011072612096 ether, 2.333153121000516764 ether, 0.995000000000109949 ether, 52719, 31482
        );

        // price: 244.435094708283018275 ether
        vm.prank(dana);
        handler.setPrice(1, 2.621637893811990143 ether);

        vm.prank(carl);
        handler.addMeToUrgentRedemptionBatch();

        // redemption rate: 0.37622704640950591 ether
        // redeemed BOLD: 34_333.025174298345667786 ether
        // redeemed Troves: [
        //   [hope],
        //   [gabe],
        //   [],
        //   [],
        // ]
        vm.prank(carl);
        info("gabe trove Id:     ", addressToTroveId(gabe).toString());
        info("gabe debt: ", c.troveManager.getTroveEntireDebt(addressToTroveId(gabe)).decimal());
        handler.redeemCollateral(34_333.025174298345667787 ether, 0);
        info("gabe trove Id:     ", addressToTroveId(gabe).toString());
        info("gabe debt: ", c.troveManager.getTroveEntireDebt(addressToTroveId(gabe)).decimal());

        vm.prank(gabe);
        handler.addMeToLiquidationBatch();

        vm.prank(adam);
        handler.addMeToLiquidationBatch();

        // upper hint: hope
        // lower hint: hope
        // upfront fee: 45.851924869044942133 ether
        vm.prank(carl);
        handler.openTrove(
            0, 3_111.607048463492852195 ether, 1.16895262626418546 ether, 0.142852735597140811 ether, 1885973, 10937
        );

        // upper hint: 2646484967802154597987056038088487662712072023062744056283555991417410575365
        // lower hint: 20207836743015961388089283396921182522044498153231052202943306959004515414684
        // upfront fee: 0 ether
        // function: addColl()
        info("gabe trove Id:     ", addressToTroveId(gabe).toString());
        info("gabe debt: ", c.troveManager.getTroveEntireDebt(addressToTroveId(gabe)).decimal());
        vm.prank(gabe);
        handler.adjustTrove(
            1, uint8(AdjustedTroveProperties.onlyColl), 3.631424438531681645 ether, true, 0 ether, false, 86, 703, 9499
        );
        info("gabe trove Id:     ", addressToTroveId(gabe).toString());
        info("gabe debt: ", c.troveManager.getTroveEntireDebt(addressToTroveId(gabe)).decimal());

        vm.prank(barb);
        handler.lowerBatchManagementFee(2, 0.000000000204221707 ether);

        vm.prank(hope);
        handler.addMeToLiquidationBatch();

        vm.prank(hope);
        handler.addMeToLiquidationBatch();

        vm.prank(hope);
        handler.addMeToUrgentRedemptionBatch();

        // redemption rate: 0.37622704640950591 ether
        // redeemed BOLD: 0.000000000000005602 ether
        // redeemed Troves: [
        //   [carl],
        //   [gabe],
        //   [],
        //   [],
        // ]
        vm.prank(carl);
        info("gabe trove Id:     ", addressToTroveId(gabe).toString());
        info("gabe debt: ", c.troveManager.getTroveEntireDebt(addressToTroveId(gabe)).decimal());
        handler.redeemCollateral(0.000000000000005603 ether, 1);
        info("gabe trove Id:     ", addressToTroveId(gabe).toString());
        info("gabe debt: ", c.troveManager.getTroveEntireDebt(addressToTroveId(gabe)).decimal());

        vm.prank(fran);
        handler.addMeToUrgentRedemptionBatch();

        vm.prank(dana);
        handler.addMeToUrgentRedemptionBatch();

        vm.prank(dana);
        handler.registerBatchManager(
            1, 0.995000000000001129 ether, 1 ether, 0.999999999999799729 ether, 0.000000000000000001 ether, 31535999
        );

        // redemption rate: 0.718476929948594246 ether
        // redeemed BOLD: 5_431.066474911544502914 ether
        // redeemed Troves: [
        //   [carl],
        //   [gabe],
        //   [],
        //   [],
        // ]
        vm.prank(barb);
        info("gabe trove Id:     ", addressToTroveId(gabe).toString());
        info("gabe debt: ", c.troveManager.getTroveEntireDebt(addressToTroveId(gabe)).decimal());
        handler.redeemCollateral(10_313.397298437031513085 ether, 1);
        info("gabe trove Id:     ", addressToTroveId(gabe).toString());
        info("gabe ent debt: ", c.troveManager.getTroveEntireDebt(addressToTroveId(gabe)).decimal());
        info("gabe rec debt: ", c.troveManager.getTroveDebt(addressToTroveId(gabe)).decimal());
        info("lzti: ", c.troveManager.lastZombieTroveId().toString());

        vm.prank(dana);
        handler.warp(30_167_580);

        info("gabe ent debt: ", c.troveManager.getTroveEntireDebt(addressToTroveId(gabe)).decimal());
        info("gabe rec debt: ", c.troveManager.getTroveDebt(addressToTroveId(gabe)).decimal());
        info("lzti: ", c.troveManager.lastZombieTroveId().toString());
        vm.prank(gabe);
        handler.registerBatchManager(
            1,
            0.995000000000002877 ether,
            0.999999999999430967 ether,
            0.996456350847225481 ether,
            0.000000001322368348 ether,
            14343
        );
        info("gabe ent debt 1: ", c.troveManager.getTroveEntireDebt(addressToTroveId(gabe)).decimal());
        info("gabe rec debt 1: ", c.troveManager.getTroveDebt(addressToTroveId(gabe)).decimal());

        vm.prank(hope);
        handler.addMeToLiquidationBatch();

        // initial deposit: 0 ether
        // compounded deposit: 0 ether
        // yield gain: 0 ether
        // coll gain: 0 ether
        // stashed coll: 0 ether
        // blocked SP yield: 0 ether
        vm.prank(barb);
        handler.provideToSP(3, 1_933.156398582065633891 ether, false);

        vm.prank(hope);
        handler.addMeToUrgentRedemptionBatch();

        // initial deposit: 0 ether
        // compounded deposit: 0 ether
        // yield gain: 0 ether
        // coll gain: 0 ether
        // stashed coll: 0 ether
        // blocked SP yield: 6_368.077020894268536036 ether
        vm.prank(hope);
        handler.provideToSP(0, 6_184.412833814428802676 ether, true);

        vm.prank(carl);
        handler.addMeToLiquidationBatch();

        // upper hint: 81940996894813545005963650320412669449148720334632109303327864712326705297348
        // lower hint: carl
        // upfront fee: 297.236383200558451701 ether
        vm.prank(barb);
        handler.openTrove(
            0,
            69_695.596747080749922615 ether,
            1.900000000000006402 ether,
            0.153255449436557929 ether,
            1498297936,
            1276315316
        );

        // upper hint: 0
        // lower hint: 30960623452289762463130736603892188849115197753010878244835568881362241800197
        // upfront fee: 56.245103106642574315 ether
        // function: withdrawBold()
        vm.prank(hope);
        handler.adjustTrove(
            0,
            uint8(AdjustedTroveProperties.onlyDebt),
            0 ether,
            false,
            7_875.177407392532383015 ether,
            true,
            5,
            16648,
            270
        );

        // batch manager: gabe
        // upper hint: gabe
        // lower hint: 0
        // upfront fee: 1_261.275141740191589507 ether
        vm.prank(adam);
        handler.openTroveAndJoinInterestBatchManager(
            1, 66_969.454138225567397381 ether, 2.984784797753777921 ether, 4294967294, 1, 52
        );
        info("gabe ent debt 2: ", c.troveManager.getTroveEntireDebt(addressToTroveId(gabe)).decimal());
        info("gabe rec debt 2: ", c.troveManager.getTroveDebt(addressToTroveId(gabe)).decimal());

        // batch manager: hope
        // upper hint: 0
        // lower hint: barb
        // upfront fee: 1_272.067039116734276271 ether
        vm.prank(eric);
        handler.openTroveAndJoinInterestBatchManager(
            0, 96_538.742068715532219745 ether, 2.762063859567414329 ether, 0, 61578232, 336273331
        );

        // initial deposit: 6_184.412833814428802676 ether
        // compounded deposit: 6_184.412833814428802676 ether
        // yield gain: 7_538.471959199501948711 ether
        // coll gain: 0 ether
        // stashed coll: 0 ether
        // blocked SP yield: 0 ether
        vm.prank(hope);
        handler.provideToSP(0, 0.000000001590447554 ether, true);

        // initial deposit: 0 ether
        // compounded deposit: 0 ether
        // yield gain: 0 ether
        // coll gain: 0 ether
        // stashed coll: 0 ether
        // blocked SP yield: 0 ether
        vm.prank(fran);
        handler.provideToSP(3, 180_836.387435487377369461 ether, true);

        vm.prank(fran);
        handler.addMeToLiquidationBatch();

        // initial deposit: 0 ether
        // compounded deposit: 0 ether
        // yield gain: 0 ether
        // coll gain: 0 ether
        // stashed coll: 0 ether
        // blocked SP yield: 0 ether
        vm.prank(eric);
        handler.provideToSP(2, 0.000000000000000012 ether, true);

        vm.prank(carl);
        handler.addMeToUrgentRedemptionBatch();

        // redemption rate: 0.00500000000000102 ether
        // redeemed BOLD: 0.000000000536305094 ether
        // redeemed Troves: [
        //   [barb],
        //   [gabe],
        //   [],
        //   [],
        // ]
        info("gabe trove Id:     ", addressToTroveId(gabe).toString());
        info("gabe ent debt e: ", c.troveManager.getTroveEntireDebt(addressToTroveId(gabe)).decimal());
        info("gabe rec debt e: ", c.troveManager.getTroveDebt(addressToTroveId(gabe)).decimal());
        info("lzti: ", c.troveManager.lastZombieTroveId().toString());
        vm.prank(barb);
        handler.redeemCollateral(0.000000000536305095 ether, 3);
    }
}