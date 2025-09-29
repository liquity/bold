// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "./TestContracts/DevTestSetup.sol";
import {SystemParams} from "../src/SystemParams.sol";
import {ISystemParams} from "../src/Interfaces/ISystemParams.sol";

contract SystemParamsTest is DevTestSetup {
    address owner;
    address nonOwner;

    event VersionUpdated(uint256 oldVersion, uint256 newVersion);
    event MinDebtUpdated(uint256 oldMinDebt, uint256 newMinDebt);
    event LiquidationParamsUpdated(
        uint256 minLiquidationPenaltySP,
        uint256 maxLiquidationPenaltyRedistribution,
        uint256 liquidationPenaltySP,
        uint256 liquidationPenaltyRedistribution
    );
    event GasCompParamsUpdated(
        uint256 collGasCompensationDivisor,
        uint256 collGasCompensationCap,
        uint256 ethGasCompensation
    );
    event CollateralParamsUpdated(uint256 ccr, uint256 scr, uint256 mcr, uint256 bcr);
    event InterestParamsUpdated(
        uint256 minAnnualInterestRate,
        uint256 maxAnnualInterestRate,
        uint128 maxAnnualBatchManagementFee,
        uint256 upfrontInterestPeriod,
        uint256 interestRateAdjCooldown,
        uint128 minInterestRateChangePeriod,
        uint256 maxBatchSharesRatio
    );
    event RedemptionParamsUpdated(
        uint256 redemptionFeeFloor,
        uint256 initialBaseRate,
        uint256 redemptionMinuteDecayFactor,
        uint256 redemptionBeta,
        uint256 urgentRedemptionBonus
    );
    event StabilityPoolParamsUpdated(uint256 spYieldSplit, uint256 minBoldInSP);

    function setUp() public override {
        super.setUp();
        owner = SystemParams(address(systemParams)).owner();
        nonOwner = address(0x1234);
    }

    function testInitialization() public {
        SystemParams freshParams = new SystemParams(false);
        freshParams.initialize(owner);

        // Check debt parameters
        assertEq(freshParams.MIN_DEBT(), 2000e18);

        // Check liquidation parameters
        assertEq(freshParams.MIN_LIQUIDATION_PENALTY_SP(), 5 * _1pct);
        assertEq(freshParams.MAX_LIQUIDATION_PENALTY_REDISTRIBUTION(), 20 * _1pct);
        assertEq(freshParams.LIQUIDATION_PENALTY_SP(), 5e16);
        assertEq(freshParams.LIQUIDATION_PENALTY_REDISTRIBUTION(), 10e16);

        // Check gas compensation parameters
        assertEq(freshParams.COLL_GAS_COMPENSATION_DIVISOR(), 200);
        assertEq(freshParams.COLL_GAS_COMPENSATION_CAP(), 2 ether);
        assertEq(freshParams.ETH_GAS_COMPENSATION(), 0.0375 ether);

        // Check collateral parameters
        assertEq(freshParams.CCR(), 150 * _1pct);
        assertEq(freshParams.SCR(), 110 * _1pct);
        assertEq(freshParams.MCR(), 110 * _1pct);
        assertEq(freshParams.BCR(), 10 * _1pct);

        // Check interest parameters
        assertEq(freshParams.MIN_ANNUAL_INTEREST_RATE(), _1pct / 2);
        assertEq(freshParams.MAX_ANNUAL_INTEREST_RATE(), 250 * _1pct);
        assertEq(freshParams.MAX_ANNUAL_BATCH_MANAGEMENT_FEE(), uint128(_100pct / 10));
        assertEq(freshParams.UPFRONT_INTEREST_PERIOD(), 7 days);
        assertEq(freshParams.INTEREST_RATE_ADJ_COOLDOWN(), 7 days);
        assertEq(freshParams.MIN_INTEREST_RATE_CHANGE_PERIOD(), 1 hours);
        assertEq(freshParams.MAX_BATCH_SHARES_RATIO(), 1e9);

        // Check redemption parameters
        assertEq(freshParams.REDEMPTION_FEE_FLOOR(), _1pct / 2);
        assertEq(freshParams.INITIAL_BASE_RATE(), _100pct);
        assertEq(freshParams.REDEMPTION_MINUTE_DECAY_FACTOR(), 998076443575628800);
        assertEq(freshParams.REDEMPTION_BETA(), 1);
        assertEq(freshParams.URGENT_REDEMPTION_BONUS(), 2 * _1pct);

        // Check stability pool parameters
        assertEq(freshParams.SP_YIELD_SPLIT(), 75 * _1pct);
        assertEq(freshParams.MIN_BOLD_IN_SP(), 1e18);

        // Check version
        assertEq(freshParams.version(), 1);

        // Check ownership
        assertEq(freshParams.owner(), owner);
    }

    function testDisableInitializers() public {
        SystemParams disabledParams = new SystemParams(true);

        vm.expectRevert();
        disabledParams.initialize(owner);
    }

    function testUpdateMinDebt() public {
        uint256 oldMinDebt = systemParams.MIN_DEBT();
        uint256 newMinDebt = 3000e18;

        vm.prank(owner);
        vm.expectEmit(true, true, false, true);
        emit MinDebtUpdated(oldMinDebt, newMinDebt);
        systemParams.updateMinDebt(newMinDebt);

        assertEq(systemParams.MIN_DEBT(), newMinDebt);
    }

    function testUpdateMinDebtRevertsWhenZero() public {
        vm.prank(owner);
        vm.expectRevert(ISystemParams.InvalidMinDebt.selector);
        systemParams.updateMinDebt(0);
    }

    function testUpdateMinDebtRevertsWhenTooHigh() public {
        vm.prank(owner);
        vm.expectRevert(ISystemParams.InvalidMinDebt.selector);
        systemParams.updateMinDebt(10001e18);
    }

    function testUpdateLiquidationParams() public {
        uint256 minPenaltySP = 6 * _1pct;
        uint256 maxPenaltyRedist = 25 * _1pct;
        uint256 penaltySP = 7 * _1pct;
        uint256 penaltyRedist = 15 * _1pct;

        vm.prank(owner);
        vm.expectEmit(true, true, false, true);
        emit LiquidationParamsUpdated(minPenaltySP, maxPenaltyRedist, penaltySP, penaltyRedist);
        systemParams.updateLiquidationParams(minPenaltySP, maxPenaltyRedist, penaltySP, penaltyRedist);

        assertEq(systemParams.MIN_LIQUIDATION_PENALTY_SP(), minPenaltySP);
        assertEq(systemParams.MAX_LIQUIDATION_PENALTY_REDISTRIBUTION(), maxPenaltyRedist);
        assertEq(systemParams.LIQUIDATION_PENALTY_SP(), penaltySP);
        assertEq(systemParams.LIQUIDATION_PENALTY_REDISTRIBUTION(), penaltyRedist);
    }

    function testUpdateLiquidationParamsRevertsSPPenaltyTooLow() public {
        uint256 minPenaltySP = 10 * _1pct;
        uint256 penaltySP = 5 * _1pct; 

        vm.prank(owner);
        vm.expectRevert(ISystemParams.SPPenaltyTooLow.selector);
        systemParams.updateLiquidationParams(minPenaltySP, 20 * _1pct, penaltySP, 15 * _1pct);
    }

    function testUpdateLiquidationParamsRevertsSPPenaltyGtRedist() public {
        uint256 penaltySP = 20 * _1pct;
        uint256 penaltyRedist = 15 * _1pct;

        vm.prank(owner);
        vm.expectRevert(ISystemParams.SPPenaltyGtRedist.selector);
        systemParams.updateLiquidationParams(5 * _1pct, 25 * _1pct, penaltySP, penaltyRedist);
    }

    function testUpdateLiquidationParamsRevertsRedistPenaltyTooHigh() public {
        uint256 maxPenaltyRedist = 20 * _1pct;
        uint256 penaltyRedist = 25 * _1pct;

        vm.prank(owner);
        vm.expectRevert(ISystemParams.RedistPenaltyTooHigh.selector);
        systemParams.updateLiquidationParams(5 * _1pct, maxPenaltyRedist, 10 * _1pct, penaltyRedist);
    }

    function testUpdateGasCompParams() public {
        uint256 divisor = 300;
        uint256 cap = 3 ether;
        uint256 ethComp = 0.05 ether;

        vm.prank(owner);
        vm.expectEmit(true, true, false, true);
        emit GasCompParamsUpdated(divisor, cap, ethComp);
        systemParams.updateGasCompParams(divisor, cap, ethComp);

        assertEq(systemParams.COLL_GAS_COMPENSATION_DIVISOR(), divisor);
        assertEq(systemParams.COLL_GAS_COMPENSATION_CAP(), cap);
        assertEq(systemParams.ETH_GAS_COMPENSATION(), ethComp);
    }

    function testUpdateGasCompParamsRevertsInvalidDivisor() public {
        // Test zero divisor
        vm.prank(owner);
        vm.expectRevert(ISystemParams.InvalidGasCompensation.selector);
        systemParams.updateGasCompParams(0, 2 ether, 0.05 ether);

        // Test divisor too high
        vm.prank(owner);
        vm.expectRevert(ISystemParams.InvalidGasCompensation.selector);
        systemParams.updateGasCompParams(1001, 2 ether, 0.05 ether);
    }

    function testUpdateGasCompParamsRevertsInvalidCap() public {
        // Test zero cap
        vm.prank(owner);
        vm.expectRevert(ISystemParams.InvalidGasCompensation.selector);
        systemParams.updateGasCompParams(200, 0, 0.05 ether);

        // Test cap too high
        vm.prank(owner);
        vm.expectRevert(ISystemParams.InvalidGasCompensation.selector);
        systemParams.updateGasCompParams(200, 11 ether, 0.05 ether);
    }

    function testUpdateGasCompParamsRevertsInvalidETHCompensation() public {
        // Test zero ETH compensation
        vm.prank(owner);
        vm.expectRevert(ISystemParams.InvalidGasCompensation.selector);
        systemParams.updateGasCompParams(200, 2 ether, 0);

        // Test ETH compensation too high
        vm.prank(owner);
        vm.expectRevert(ISystemParams.InvalidGasCompensation.selector);
        systemParams.updateGasCompParams(200, 2 ether, 1.1 ether);
    }

    function testUpdateCollateralParams() public {
        uint256 ccr = 160 * _1pct;
        uint256 scr = 120 * _1pct;
        uint256 mcr = 115 * _1pct;
        uint256 bcr = 15 * _1pct;

        vm.prank(owner);
        vm.expectEmit(true, true, false, true);
        emit CollateralParamsUpdated(ccr, scr, mcr, bcr);
        systemParams.updateCollateralParams(ccr, scr, mcr, bcr);

        assertEq(systemParams.CCR(), ccr);
        assertEq(systemParams.SCR(), scr);
        assertEq(systemParams.MCR(), mcr);
        assertEq(systemParams.BCR(), bcr);
    }

    function testUpdateCollateralParamsRevertsInvalidCCR() public {
        // CCR too low
        vm.prank(owner);
        vm.expectRevert(ISystemParams.InvalidCCR.selector);
        systemParams.updateCollateralParams(100 * _1pct, 110 * _1pct, 110 * _1pct, 10 * _1pct);

        // CCR too high
        vm.prank(owner);
        vm.expectRevert(ISystemParams.InvalidCCR.selector);
        systemParams.updateCollateralParams(200 * _1pct, 110 * _1pct, 110 * _1pct, 10 * _1pct);
    }

    function testUpdateCollateralParamsRevertsInvalidMCR() public {
        // MCR too low
        vm.prank(owner);
        vm.expectRevert(ISystemParams.InvalidMCR.selector);
        systemParams.updateCollateralParams(150 * _1pct, 110 * _1pct, 100 * _1pct, 10 * _1pct);

        // MCR too high
        vm.prank(owner);
        vm.expectRevert(ISystemParams.InvalidMCR.selector);
        systemParams.updateCollateralParams(150 * _1pct, 110 * _1pct, 200 * _1pct, 10 * _1pct);
    }

    function testUpdateCollateralParamsRevertsInvalidBCR() public {
        // BCR too low
        vm.prank(owner);
        vm.expectRevert(ISystemParams.InvalidBCR.selector);
        systemParams.updateCollateralParams(150 * _1pct, 110 * _1pct, 110 * _1pct, 4 * _1pct);

        // BCR too high
        vm.prank(owner);
        vm.expectRevert(ISystemParams.InvalidBCR.selector);
        systemParams.updateCollateralParams(150 * _1pct, 110 * _1pct, 110 * _1pct, 50 * _1pct);
    }

    function testUpdateCollateralParamsRevertsInvalidSCR() public {
        // SCR too low
        vm.prank(owner);
        vm.expectRevert(ISystemParams.InvalidSCR.selector);
        systemParams.updateCollateralParams(150 * _1pct, 100 * _1pct, 110 * _1pct, 10 * _1pct);

        // SCR too high
        vm.prank(owner);
        vm.expectRevert(ISystemParams.InvalidSCR.selector);
        systemParams.updateCollateralParams(150 * _1pct, 200 * _1pct, 110 * _1pct, 10 * _1pct);
    }

    function testUpdateInterestParams() public {
        uint256 minRate = 1 * _1pct;
        uint256 maxRate = 200 * _1pct;
        uint128 maxFee = uint128(5 * _1pct);
        uint256 upfrontPeriod = 14 days;
        uint256 cooldown = 14 days;
        uint128 minChangePeriod = 2 hours;
        uint256 maxSharesRatio = 2e9;

        vm.prank(owner);
        vm.expectEmit(true, true, false, true);
        emit InterestParamsUpdated(minRate, maxRate, maxFee, upfrontPeriod, cooldown, minChangePeriod, maxSharesRatio);
        systemParams.updateInterestParams(minRate, maxRate, maxFee, upfrontPeriod, cooldown, minChangePeriod, maxSharesRatio);

        assertEq(systemParams.MIN_ANNUAL_INTEREST_RATE(), minRate);
        assertEq(systemParams.MAX_ANNUAL_INTEREST_RATE(), maxRate);
        assertEq(systemParams.MAX_ANNUAL_BATCH_MANAGEMENT_FEE(), maxFee);
        assertEq(systemParams.UPFRONT_INTEREST_PERIOD(), upfrontPeriod);
        assertEq(systemParams.INTEREST_RATE_ADJ_COOLDOWN(), cooldown);
        assertEq(systemParams.MIN_INTEREST_RATE_CHANGE_PERIOD(), minChangePeriod);
        assertEq(systemParams.MAX_BATCH_SHARES_RATIO(), maxSharesRatio);
    }

    function testUpdateInterestParamsRevertsMinGtMax() public {
        vm.prank(owner);
        vm.expectRevert(ISystemParams.MinInterestRateGtMax.selector);
        systemParams.updateInterestParams(
            200 * _1pct, // min > max
            100 * _1pct,
            uint128(5 * _1pct),
            7 days,
            7 days,
            1 hours,
            1e9
        );
    }

    function testUpdateInterestParamsRevertsMaxTooHigh() public {
        vm.prank(owner);
        vm.expectRevert(ISystemParams.InvalidInterestRateBounds.selector);
        systemParams.updateInterestParams(
            1 * _1pct,
            1001 * _1pct, // > 1000%
            uint128(5 * _1pct),
            7 days,
            7 days,
            1 hours,
            1e9
        );
    }

    function testUpdateInterestParamsRevertsInvalidFee() public {
        vm.prank(owner);
        vm.expectRevert(ISystemParams.InvalidFeeValue.selector);
        systemParams.updateInterestParams(
            1 * _1pct,
            100 * _1pct,
            uint128(101 * _1pct), // > 100%
            7 days,
            7 days,
            1 hours,
            1e9
        );
    }

    function testUpdateInterestParamsRevertsInvalidUpfrontPeriod() public {
        // Zero upfront period
        vm.prank(owner);
        vm.expectRevert(ISystemParams.InvalidTimeValue.selector);
        systemParams.updateInterestParams(1 * _1pct, 100 * _1pct, uint128(5 * _1pct), 0, 7 days, 1 hours, 1e9);

        // Upfront period too long
        vm.prank(owner);
        vm.expectRevert(ISystemParams.InvalidTimeValue.selector);
        systemParams.updateInterestParams(1 * _1pct, 100 * _1pct, uint128(5 * _1pct), 366 days, 7 days, 1 hours, 1e9);
    }

    function testUpdateInterestParamsRevertsInvalidCooldown() public {
        // Zero cooldown
        vm.prank(owner);
        vm.expectRevert(ISystemParams.InvalidTimeValue.selector);
        systemParams.updateInterestParams(1 * _1pct, 100 * _1pct, uint128(5 * _1pct), 7 days, 0, 1 hours, 1e9);

        // Cooldown too long
        vm.prank(owner);
        vm.expectRevert(ISystemParams.InvalidTimeValue.selector);
        systemParams.updateInterestParams(1 * _1pct, 100 * _1pct, uint128(5 * _1pct), 7 days, 366 days, 1 hours, 1e9);
    }

    function testUpdateInterestParamsRevertsInvalidChangePeriod() public {
        // Zero change period
        vm.prank(owner);
        vm.expectRevert(ISystemParams.InvalidTimeValue.selector);
        systemParams.updateInterestParams(1 * _1pct, 100 * _1pct, uint128(5 * _1pct), 7 days, 7 days, 0, 1e9);

        // Change period too long
        vm.prank(owner);
        vm.expectRevert(ISystemParams.InvalidTimeValue.selector);
        systemParams.updateInterestParams(1 * _1pct, 100 * _1pct, uint128(5 * _1pct), 7 days, 7 days, 31 days, 1e9);
    }

    function testUpdateRedemptionParams() public {
        uint256 feeFloor = 1 * _1pct;
        uint256 baseRate = 50 * _1pct;
        uint256 decayFactor = 999000000000000000;
        uint256 beta = 2;
        uint256 urgentBonus = 3 * _1pct;

        vm.prank(owner);
        vm.expectEmit(true, true, false, true);
        emit RedemptionParamsUpdated(feeFloor, baseRate, decayFactor, beta, urgentBonus);
        systemParams.updateRedemptionParams(feeFloor, baseRate, decayFactor, beta, urgentBonus);

        assertEq(systemParams.REDEMPTION_FEE_FLOOR(), feeFloor);
        assertEq(systemParams.INITIAL_BASE_RATE(), baseRate);
        assertEq(systemParams.REDEMPTION_MINUTE_DECAY_FACTOR(), decayFactor);
        assertEq(systemParams.REDEMPTION_BETA(), beta);
        assertEq(systemParams.URGENT_REDEMPTION_BONUS(), urgentBonus);
    }

    function testUpdateRedemptionParamsRevertsInvalidFeeFloor() public {
        vm.prank(owner);
        vm.expectRevert(ISystemParams.InvalidFeeValue.selector);
        systemParams.updateRedemptionParams(101 * _1pct, 50 * _1pct, 999000000000000000, 1, 2 * _1pct);
    }

    function testUpdateRedemptionParamsRevertsInvalidBaseRate() public {
        vm.prank(owner);
        vm.expectRevert(ISystemParams.InvalidFeeValue.selector);
        systemParams.updateRedemptionParams(1 * _1pct, 1001 * _1pct, 999000000000000000, 1, 2 * _1pct);
    }

    function testUpdateRedemptionParamsRevertsInvalidUrgentBonus() public {
        vm.prank(owner);
        vm.expectRevert(ISystemParams.InvalidFeeValue.selector);
        systemParams.updateRedemptionParams(1 * _1pct, 50 * _1pct, 999000000000000000, 1, 101 * _1pct);
    }

    function testUpdatePoolParams() public {
        uint256 yieldSplit = 80 * _1pct;
        uint256 minBold = 10e18;

        vm.prank(owner);
        vm.expectEmit(true, true, false, true);
        emit StabilityPoolParamsUpdated(yieldSplit, minBold);
        systemParams.updatePoolParams(yieldSplit, minBold);

        assertEq(systemParams.SP_YIELD_SPLIT(), yieldSplit);
        assertEq(systemParams.MIN_BOLD_IN_SP(), minBold);
    }

    function testUpdatePoolParamsRevertsInvalidYieldSplit() public {
        vm.prank(owner);
        vm.expectRevert(ISystemParams.InvalidFeeValue.selector);
        systemParams.updatePoolParams(101 * _1pct, 1e18);
    }

    function testUpdatePoolParamsRevertsZeroMinBold() public {
        vm.prank(owner);
        vm.expectRevert(ISystemParams.InvalidMinDebt.selector);
        systemParams.updatePoolParams(75 * _1pct, 0);
    }

    function testUpdateVersion() public {
        uint256 oldVersion = systemParams.version();
        uint256 newVersion = 2;

        vm.prank(owner);
        vm.expectEmit(true, true, false, true);
        emit VersionUpdated(oldVersion, newVersion);
        systemParams.updateVersion(newVersion);

        assertEq(systemParams.version(), newVersion);
    }

    function testOnlyOwnerCanUpdate() public {
        vm.startPrank(nonOwner);

        // Test all update functions revert for non-owner
        vm.expectRevert("Ownable: caller is not the owner");
        systemParams.updateMinDebt(3000e18);

        vm.expectRevert("Ownable: caller is not the owner");
        systemParams.updateLiquidationParams(6 * _1pct, 25 * _1pct, 7 * _1pct, 15 * _1pct);

        vm.expectRevert("Ownable: caller is not the owner");
        systemParams.updateGasCompParams(300, 3 ether, 0.05 ether);

        vm.expectRevert("Ownable: caller is not the owner");
        systemParams.updateCollateralParams(160 * _1pct, 120 * _1pct, 115 * _1pct, 15 * _1pct);

        vm.expectRevert("Ownable: caller is not the owner");
        systemParams.updateInterestParams(1 * _1pct, 200 * _1pct, uint128(5 * _1pct), 14 days, 14 days, 2 hours, 2e9);

        vm.expectRevert("Ownable: caller is not the owner");
        systemParams.updateRedemptionParams(1 * _1pct, 50 * _1pct, 999000000000000000, 2, 3 * _1pct);

        vm.expectRevert("Ownable: caller is not the owner");
        systemParams.updatePoolParams(80 * _1pct, 10e18);

        vm.expectRevert("Ownable: caller is not the owner");
        systemParams.updateVersion(2);

        vm.stopPrank();
    }

    function testOwnerCanTransferOwnership() public {
        address newOwner = address(0x5678);

        // Transfer ownership
        vm.prank(owner);
        SystemParams(address(systemParams)).transferOwnership(newOwner);
        assertEq(SystemParams(address(systemParams)).owner(), newOwner);

        // New owner can update
        vm.prank(newOwner);
        systemParams.updateVersion(3);
        assertEq(systemParams.version(), 3);

        // Old owner cannot update
        vm.prank(owner);
        vm.expectRevert("Ownable: caller is not the owner");
        systemParams.updateVersion(4);
    }

    function testParameterBoundaryValues() public {
        // Test minimum valid values
        vm.prank(owner);
        systemParams.updateMinDebt(1); // Just above 0
        assertEq(systemParams.MIN_DEBT(), 1);

        vm.prank(owner);
        systemParams.updateMinDebt(10000e18); // Exactly at max
        assertEq(systemParams.MIN_DEBT(), 10000e18);

        // Test collateral params at boundaries
        vm.prank(owner);
        systemParams.updateCollateralParams(
            _100pct + 1,      // CCR just above 100%
            _100pct + 1,      // SCR just above 100%
            _100pct + 1,      // MCR just above 100%
            5 * _1pct         // BCR at minimum
        );
        assertEq(systemParams.CCR(), _100pct + 1);
        assertEq(systemParams.BCR(), 5 * _1pct);

        // Test gas comp at boundaries
        vm.prank(owner);
        systemParams.updateGasCompParams(
            1,           // Min divisor
            10 ether,    // Max cap
            1 ether      // Max ETH comp
        );
        assertEq(systemParams.COLL_GAS_COMPENSATION_DIVISOR(), 1);
        assertEq(systemParams.COLL_GAS_COMPENSATION_CAP(), 10 ether);
        assertEq(systemParams.ETH_GAS_COMPENSATION(), 1 ether);
    }
}