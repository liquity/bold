// SPDX-License-Identifier: GPL-2.0
pragma solidity ^0.8.0;

import {Test} from "forge-std/Test.sol";
import {TargetFunctions} from "./TargetFunctions.sol";
import {FoundryAsserts} from "@chimera/FoundryAsserts.sol";
import "forge-std/console2.sol";

import {ERC1820RegistryCompiled} from
    "@superfluid-finance/ethereum-contracts/contracts/libs/ERC1820RegistryCompiled.sol";

// forge test --match-contract CryticToFoundry -vv
contract CryticToFoundry is Test, TargetFunctions, FoundryAsserts {
    function setUp() public {
        vm.etch(ERC1820RegistryCompiled.at, ERC1820RegistryCompiled.bin); // TODO: Deploy at a new address

        setup();
    }

    // forge test --match-test test_crytic -vvv
    function test_crytic() public {
        // TODO: add failing property tests here for debugging
        borrowerOperations_openTrove(address(this), 123, 100e18, 2000e18, 0, 0, 1e18, 100e18, address(this), address(this), address(this));
        borrowerOperations_openTrove(address(this), 13232, 100e18, 2000e18, 0, 0, 1e18, 100e18, address(this), address(this), address(this));
        borrowerOperations_adjustTrove_clamped(123, true, 0, true, 0);
        priceFeed_setPrice(1);
        troveManager_liquidate_clamped();
    }

    // forge test --match-test test_property_active_troves_are_above_MIN_DEBT_1 -vvv 
function test_property_active_troves_are_above_MIN_DEBT_1() public {

    borrowerOperations_openTrove_clamped(0x0000000000000000000000000000000000000000,0,13339564538247939756636,1996998175339557135783,0x0000000000000000000000000000000000000000,0x0000000000000000000000000000000000000000,0x0000000000000000000000000000000000000000);

    priceFeed_setPrice(63326149451276);

    borrowerOperations_shutdown();
    
    // Doesn't matter once you're shutdown
    troveManager_urgentRedemption_clamped(828122044839760619);
    property_active_troves_are_above_MIN_DEBT();

 }

 // forge test --match-test test_property_AP01_2 -vvv 
function test_property_AP01_2() public {

    borrowerOperations_openTrove_clamped(0x0000000000000000000000000000000000000000,0,1506153691784959742,1996342313314219885149,0x0000000000000000000000000000000000000000,0x0000000000000000000000000000000000000000,0x0000000000000000000000000000000000000000);

    property_AP01();

 }

 // forge test --match-test test_optimize_ap01_under_0 -vvv 
function test_optimize_ap01_under_0() public {

    // Max value: 2005160758086615185564410686266145742105615563;

    vm.roll(block.number + 5054);
    vm.warp(block.timestamp + 81172);
    console2.log("before activePool.aggWeightedDebtSum", activePool.aggWeightedDebtSum());
    borrowerOperations_openTrove_clamped(0x00000000000000000000000000000002fFffFffD,93701483398682665984728072936648256433854685342449288884605117331643986361215,79409241918338619357573071,260636221954315249937846958,0xc98D9175A32ca68C4B83dB84B4707AF82ae37cC4,0x0000000000000000000000000000000000000F08,0x00000000000000000000000000000002fFffFffD);
 console2.log("optimize_ap01_under 0", optimize_ap01_under());
    console2.log("activePool.aggWeightedDebtSum", activePool.aggWeightedDebtSum());
    console2.log("_before.ghostWeightedRecordedDebtAccumulator", _before.ghostWeightedRecordedDebtAccumulator);
    console2.log("_after.ghostWeightedRecordedDebtAccumulator", _after.ghostWeightedRecordedDebtAccumulator);
    vm.roll(block.number + 20910);
    vm.warp(block.timestamp + 322374);
    stabilityPool_provideToSP_clamped(27424305496545741552056768792830585584317965363475532520705411256164270180376,false);

 console2.log("optimize_ap01_under", optimize_ap01_under());
    vm.warp(block.timestamp + 695463);

    vm.roll(block.number + 102155);

    vm.roll(block.number + 40897);
    vm.warp(block.timestamp + 856);
    borrowerOperations_withdrawBold_clamped(148127151065994630252606205);

    vm.warp(block.timestamp + 717585);

    vm.roll(block.number + 98985);

    vm.roll(block.number + 2526);
    vm.warp(block.timestamp + 338920);
    canary_liquidation();

    vm.warp(block.timestamp + 1350578);

    vm.roll(block.number + 88170);

    vm.roll(block.number + 60054);
    vm.warp(block.timestamp + 24867);
    asset_approve(0x00000000000000000000000000000001fffffffE,254075269958341709303778481485360912762);
     console2.log("optimize_ap01_under", optimize_ap01_under());

    vm.roll(block.number + 24311);
    vm.warp(block.timestamp + 277232);
    property_CS04();

    vm.warp(block.timestamp + 1448730);

    vm.roll(block.number + 132063);

    vm.roll(block.number + 22909);
    vm.warp(block.timestamp + 322374);
    borrowerOperations_addColl_clamped(32590110299340558042976583);

    vm.warp(block.timestamp + 511822);

    vm.roll(block.number + 11905);

    vm.roll(block.number + 53166);
    vm.warp(block.timestamp + 212460);
    priceFeed_triggerShutdown();
     console2.log("optimize_ap01_under", optimize_ap01_under());

    vm.warp(block.timestamp + 135921);

    vm.roll(block.number + 30042);

    vm.roll(block.number + 6234);
    vm.warp(block.timestamp + 50417);
    property_BT01();

    vm.roll(block.number + 22699);
    vm.warp(block.timestamp + 4177);
    property_BT02();

    vm.roll(block.number + 53451);
    vm.warp(block.timestamp + 156190);
    property_BT05();

    vm.warp(block.timestamp + 436727);

    vm.roll(block.number + 59552);

    vm.roll(block.number + 55052);
    vm.warp(block.timestamp + 275394);
    property_sum_of_batches_debt_and_shares();
     console2.log("optimize_ap01_under", optimize_ap01_under());

    vm.warp(block.timestamp + 446947);

    vm.roll(block.number + 61528);

    vm.roll(block.number + 4462);
    vm.warp(block.timestamp + 254414);
    priceFeed_setPrice(184319410175182376593245936);

    vm.warp(block.timestamp + 1234164);

    vm.roll(block.number + 187559);

    vm.roll(block.number + 32435);
    vm.warp(block.timestamp + 135921);
    stabilityPool_withdrawFromSP_clamped(94239526814803268770816854694085645879100106975629632379034,true);

    vm.roll(block.number + 60054);
    vm.warp(block.timestamp + 419861);
    asset_mint(0x00000000000000000000000000000001fffffffE,726);

    vm.warp(block.timestamp + 400981);

    vm.roll(block.number + 15367);

    vm.roll(block.number + 1088);
    vm.warp(block.timestamp + 73040);
    property_weighted_sum();
     console2.log("optimize_ap01_under", optimize_ap01_under());

    vm.warp(block.timestamp + 522178);

    vm.roll(block.number + 59983);

    vm.roll(block.number + 23978);
    vm.warp(block.timestamp + 172101);
    collToken_approve(0x00000000000000000000000000000000DeaDBeef,101382401482932389799902259568732152409);

    vm.warp(block.timestamp + 527243);

    vm.roll(block.number + 54311);

    vm.roll(block.number + 57086);
    vm.warp(block.timestamp + 100835);
    property_BA01();

    vm.roll(block.number + 7712);
    vm.warp(block.timestamp + 45142);
    asset_approve(0x00000000000000000000000000000000DeaDBeef,43234010939624185218020403123525591057);
     console2.log("optimize_ap01_under", optimize_ap01_under());

    vm.warp(block.timestamp + 913317);

    vm.roll(block.number + 34710);

    vm.roll(block.number + 20243);
    vm.warp(block.timestamp + 31593);
    borrowerOperations_adjustTroveInterestRate_clamped(64479505916471466477331997908391885217657807194625147020426390684972435426202,15398573290560247665990881735019176722007117505318547132077308618354371879859,2962310210599114012974028230312168185270655657574208074510281456716751689783);

    vm.warp(block.timestamp + 33271);

    vm.roll(block.number + 59983);

    vm.roll(block.number + 30011);
    vm.warp(block.timestamp + 478623);
    borrowerOperations_applyPendingDebt_clamped();

    vm.warp(block.timestamp + 322374);

    vm.roll(block.number + 20152);

    vm.roll(block.number + 59981);
    vm.warp(block.timestamp + 358061);
    property_CS04();
     console2.log("optimize_ap01_under", optimize_ap01_under());

    vm.roll(block.number + 46212);
    vm.warp(block.timestamp + 405856);
    asset_approve(0x0000000000000000000000000000000000000F0A,195760263594747118956609330224137207565);

    vm.roll(block.number + 2526);
    vm.warp(block.timestamp + 82671);
    canary_liquidation();

    vm.warp(block.timestamp + 422565);

    vm.roll(block.number + 77402);

    vm.roll(block.number + 8447);
    vm.warp(block.timestamp + 48884);
    property_BT01();

    vm.warp(block.timestamp + 526194);

    vm.roll(block.number + 23885);

    vm.roll(block.number + 561);
    vm.warp(block.timestamp + 166184);
    property_CS04();
     console2.log("optimize_ap01_under", optimize_ap01_under());

    vm.warp(block.timestamp + 729777);

    vm.roll(block.number + 114136);

    vm.roll(block.number + 5140);
    vm.warp(block.timestamp + 13573);
    borrowerOperations_addColl_clamped(205933596267234158443431627);

    vm.warp(block.timestamp + 219064);

    vm.roll(block.number + 21894);

    vm.roll(block.number + 49415);
    vm.warp(block.timestamp + 115085);
    priceFeed_fetchRedemptionPrice();

    vm.roll(block.number + 5023);
    vm.warp(block.timestamp + 490446);
    property_BT01();

    vm.warp(block.timestamp + 402051);

    vm.roll(block.number + 76286);

    vm.roll(block.number + 23978);
    vm.warp(block.timestamp + 446755);
    collToken_mint(0x00000000000000000000000000000000FFFFfFFF,340282366920938463463374607431768211454);
     console2.log("optimize_ap01_under", optimize_ap01_under());

    vm.warp(block.timestamp + 1035661);

    vm.roll(block.number + 50455);

    vm.roll(block.number + 6729);
    vm.warp(block.timestamp + 150273);
    priceFeed_setPrice(81060101198367503560470122);

    vm.roll(block.number + 22909);
    vm.warp(block.timestamp + 24867);
    property_BA01();

    vm.roll(block.number + 45852);
    vm.warp(block.timestamp + 244814);
    property_sum_of_batches_debt_and_shares();

    vm.roll(block.number + 33357);
    vm.warp(block.timestamp + 463587);
    property_CS05();

    vm.roll(block.number + 60267);
    vm.warp(block.timestamp + 209115);
    borrowerOperations_withdrawColl_clamped(1524785991);
     console2.log("optimize_ap01_under", optimize_ap01_under());

    vm.warp(block.timestamp + 259947);

    vm.roll(block.number + 38548);

    vm.roll(block.number + 6721);
    vm.warp(block.timestamp + 463587);
    priceFeed_setPrice(81898490519679642781584296);

    vm.warp(block.timestamp + 392860);

    vm.roll(block.number + 19692);

    vm.roll(block.number + 27404);
    vm.warp(block.timestamp + 437838);
    borrowerOperations_repayBold_clamped(507656663);

    console2.log("optimize_ap01_under", optimize_ap01_under());

 }
}
