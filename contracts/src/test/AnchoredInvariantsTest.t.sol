// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "./TestContracts/DevTestSetup.sol";
import {BaseInvariantTest} from "./TestContracts/BaseInvariantTest.sol";
import {BaseMultiCollateralTest} from "./TestContracts/BaseMultiCollateralTest.sol";
import {AdjustedTroveProperties, InvariantsTestHandler} from "./TestContracts/InvariantsTestHandler.t.sol";
import {Logging} from "./Utils/Logging.sol";

contract AnchoredInvariantsTest is Logging, BaseInvariantTest, BaseMultiCollateralTest {
    using StringFormatting for uint256;

    InvariantsTestHandler handler;

    function setUp() public override {
        super.setUp();

        TestDeployer.TroveManagerParams[] memory p = new TestDeployer.TroveManagerParams[](4);
        p[0] = TestDeployer.TroveManagerParams(1.5 ether, 1.1 ether, 1.01 ether, 0.05 ether, 0.1 ether);
        p[1] = TestDeployer.TroveManagerParams(1.6 ether, 1.2 ether, 1.01 ether, 0.05 ether, 0.1 ether);
        p[2] = TestDeployer.TroveManagerParams(1.6 ether, 1.2 ether, 1.01 ether, 0.05 ether, 0.1 ether);
        p[3] = TestDeployer.TroveManagerParams(1.6 ether, 1.25 ether, 1.01 ether, 0.05 ether, 0.1 ether);
        TestDeployer deployer = new TestDeployer();
        Contracts memory contracts;
        (contracts.branches, contracts.collateralRegistry, contracts.boldToken, contracts.hintHelpers,, contracts.weth,)
            = deployer.deployAndConnectContractsMultiColl(p);
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
        handler.registerBatchManager(0, 0.257486338754888547 ether, 0.580260126400716372 ether, 0.474304801140122485 ether, 0.84978254245815657 ether, 2121012);

        vm.prank(eric);
        handler.registerBatchManager(2, 0.995000000000011223 ether, 0.999999999997818617 ether, 0.999999999561578875 ether, 0.000000000000010359 ether, 5174410);

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
        handler.openTrove(0, 99_999.999999999999999997 ether, 2.251600954885856105 ether, 0.650005595391858041 ether, 8768, 0);

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
        handler.registerBatchManager(2, 0.995000000000011139 ether, 0.998635073564148166 ether, 0.996010156573547401 ether, 0.000000000000011577 ether, 9078342);

        vm.prank(carl);
        handler.registerBatchManager(1, 0.995000004199127012 ether, 1 ether, 0.999139502777974999 ether, 0.059938454189132239 ether, 1706585);

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
        handler.registerBatchManager(0, 0.995000001857124003 ether, 0.999999628575220679 ether, 0.999925530120657388 ether, 0.249999999999999999 ether, 12664);

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
        handler.registerBatchManager(0, 0.739903753088089514 ether, 0.780288740735740819 ether, 0.767858707410717411 ether, 0.000000000000022941 ether, 21644);

        // upper hint: 80084422859880547211683076133703299733277748156566366325829078699459944778998
        // lower hint: 104346312485569601582594868672255666718935311025283394307913733247512361320190
        // upfront fee: 290.81243876303301812 ether
        vm.prank(adam);
        handler.openTrove(3, 39_503.887731534058892956 ether, 1.6863644596244192 ether, 0.38385567397413886 ether, 1, 7433679);

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
        handler.registerBatchManager(1, 0.822978751289802582 ether, 0.835495454680029657 ether, 0.833312890646159679 ether, 0.422857251385135959 ether, 29470036);

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
        handler.registerBatchManager(0, 0.351143076054309979 ether, 0.467168361632094569 ether, 0.433984569464653931 ether, 0.000000000000000026 ether, 16482089);

        vm.prank(adam);
        handler.registerBatchManager(3, 0.995000000000006201 ether, 0.996462074472343849 ether, 0.995351673013151748 ether, 0.045759837128294745 ether, 10150905);

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
        handler.registerBatchManager(3, 0.30820256993275862 ether, 0.691797430067250243 ether, 0.383672204747583321 ether, 0.000000000000018015 ether, 11403);

        vm.prank(eric);
        handler.registerBatchManager(3, 0.018392910495297323 ether, 0.98160708950470919 ether, 0.963214179009414206 ether, 0.000000000000019546 ether, 13319597);

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
        handler.openTrove(1, 99_999.999999999999999998 ether, 1.883224555937797003 ether, 0.887905235895642125 ether, 4164477, 39);

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
        handler.openTrove(2, 79_311.063107967331806055 ether, 1.900000000000001559 ether, 0.995000000000007943 ether, 3270556590, 1229144376);

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
        handler.openTrove(3, 30_260.348082017558572105 ether, 1.683511222023706186 ether, 0.016900375815455486 ether, 108, 14159);

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
        handler.registerBatchManager(1, 0.995000000000425732 ether, 0.998288014105982235 ether, 0.996095220733623871 ether, 0.000000000000027477 ether, 3299);

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
}
