// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "./TestContracts/DevTestSetup.sol";
import {SystemParams} from "../src/SystemParams.sol";
import {ISystemParams} from "../src/Interfaces/ISystemParams.sol";

contract SystemParamsTest is DevTestSetup {
    function testConstructorSetsAllParametersCorrectly() public {
        ISystemParams.DebtParams memory debtParams = ISystemParams.DebtParams({
            minDebt: 2000e18
        });

        ISystemParams.LiquidationParams memory liquidationParams = ISystemParams.LiquidationParams({
            liquidationPenaltySP: 5e16, // 5%
            liquidationPenaltyRedistribution: 10e16 // 10%
        });

        ISystemParams.GasCompParams memory gasCompParams = ISystemParams.GasCompParams({
            collGasCompensationDivisor: 200,
            collGasCompensationCap: 2 ether,
            ethGasCompensation: 0.0375 ether
        });

        ISystemParams.CollateralParams memory collateralParams = ISystemParams.CollateralParams({
            ccr: 150 * _1pct,
            scr: 110 * _1pct,
            mcr: 110 * _1pct,
            bcr: 10 * _1pct
        });

        ISystemParams.InterestParams memory interestParams = ISystemParams.InterestParams({
            minAnnualInterestRate: _1pct / 2 // 0.5%
        });

        ISystemParams.RedemptionParams memory redemptionParams = ISystemParams.RedemptionParams({
            redemptionFeeFloor: _1pct / 2, // 0.5%
            initialBaseRate: _100pct,
            redemptionMinuteDecayFactor: 998076443575628800,
            redemptionBeta: 1
        });

        ISystemParams.StabilityPoolParams memory poolParams = ISystemParams.StabilityPoolParams({
            spYieldSplit: 75 * _1pct,
            minBoldInSP: 1e18,
            minBoldAfterRebalance: 1_000e18
        });

        SystemParams params = new SystemParams(false, 
            debtParams,
            liquidationParams,
            gasCompParams,
            collateralParams,
            interestParams,
            redemptionParams,
            poolParams
        );

        // Verify all parameters were set correctly
        assertEq(params.MIN_DEBT(), 2000e18);
        assertEq(params.LIQUIDATION_PENALTY_SP(), 5e16);
        assertEq(params.LIQUIDATION_PENALTY_REDISTRIBUTION(), 10e16);
        assertEq(params.COLL_GAS_COMPENSATION_DIVISOR(), 200);
        assertEq(params.COLL_GAS_COMPENSATION_CAP(), 2 ether);
        assertEq(params.ETH_GAS_COMPENSATION(), 0.0375 ether);
        assertEq(params.CCR(), 150 * _1pct);
        assertEq(params.SCR(), 110 * _1pct);
        assertEq(params.MCR(), 110 * _1pct);
        assertEq(params.BCR(), 10 * _1pct);
        assertEq(params.MIN_ANNUAL_INTEREST_RATE(), _1pct / 2);
        assertEq(params.REDEMPTION_FEE_FLOOR(), _1pct / 2);
        assertEq(params.INITIAL_BASE_RATE(), _100pct);
        assertEq(params.REDEMPTION_MINUTE_DECAY_FACTOR(), 998076443575628800);
        assertEq(params.REDEMPTION_BETA(), 1);
        assertEq(params.SP_YIELD_SPLIT(), 75 * _1pct);
        assertEq(params.MIN_BOLD_IN_SP(), 1e18);
    }

    // ========== DEBT VALIDATION TESTS ==========

    function testConstructorRevertsWhenMinDebtIsZero() public {
        ISystemParams.DebtParams memory debtParams = ISystemParams.DebtParams({minDebt: 0});

        vm.expectRevert(ISystemParams.InvalidMinDebt.selector);
        new SystemParams(false, 
            debtParams,
            _getValidLiquidationParams(),
            _getValidGasCompParams(),
            _getValidCollateralParams(),
            _getValidInterestParams(),
            _getValidRedemptionParams(),
            _getValidPoolParams()
        );
    }

    // ========== LIQUIDATION VALIDATION TESTS ==========

    function testConstructorRevertsWhenSPPenaltyTooLow() public {
        ISystemParams.LiquidationParams memory liquidationParams = ISystemParams.LiquidationParams({
            liquidationPenaltySP: 4 * _1pct, // Below hardcoded 5% minimum
            liquidationPenaltyRedistribution: 10e16
        });

        vm.expectRevert(ISystemParams.SPPenaltyTooLow.selector);
        new SystemParams(false, 
            _getValidDebtParams(),
            liquidationParams,
            _getValidGasCompParams(),
            _getValidCollateralParams(),
            _getValidInterestParams(),
            _getValidRedemptionParams(),
            _getValidPoolParams()
        );
    }

    function testConstructorRevertsWhenSPPenaltyGreaterThanRedistribution() public {
        ISystemParams.LiquidationParams memory liquidationParams = ISystemParams.LiquidationParams({
            liquidationPenaltySP: 15e16,
            liquidationPenaltyRedistribution: 10e16 // SP > Redistribution
        });

        vm.expectRevert(ISystemParams.SPPenaltyGtRedist.selector);
        new SystemParams(false, 
            _getValidDebtParams(),
            liquidationParams,
            _getValidGasCompParams(),
            _getValidCollateralParams(),
            _getValidInterestParams(),
            _getValidRedemptionParams(),
            _getValidPoolParams()
        );
    }

    function testConstructorRevertsWhenRedistPenaltyTooHigh() public {
        ISystemParams.LiquidationParams memory liquidationParams = ISystemParams.LiquidationParams({
            liquidationPenaltySP: 5e16,
            liquidationPenaltyRedistribution: 21 * _1pct // Above hardcoded 20% maximum
        });

        vm.expectRevert(ISystemParams.RedistPenaltyTooHigh.selector);
        new SystemParams(false, 
            _getValidDebtParams(),
            liquidationParams,
            _getValidGasCompParams(),
            _getValidCollateralParams(),
            _getValidInterestParams(),
            _getValidRedemptionParams(),
            _getValidPoolParams()
        );
    }

    function testConstructorRevertsWhenRedistPenaltyExceedsMCRBuffer() public {
        // MCR = 110%, so buffer = 10%. Set redistribution penalty to 11% (exceeds buffer)
        ISystemParams.LiquidationParams memory liquidationParams = ISystemParams.LiquidationParams({
            liquidationPenaltySP: 5e16,
            liquidationPenaltyRedistribution: 11 * _1pct // 11% > (110% - 100%)
        });

        vm.expectRevert(ISystemParams.RedistPenaltyTooHigh.selector);
        new SystemParams(false, 
            _getValidDebtParams(),
            liquidationParams,
            _getValidGasCompParams(),
            _getValidCollateralParams(),
            _getValidInterestParams(),
            _getValidRedemptionParams(),
            _getValidPoolParams()
        );
    }

    function testConstructorAllowsRedistPenaltyEqualToMCRBuffer() public {
        // MCR = 110%, so buffer = 10%. Set redistribution penalty to exactly 10%
        ISystemParams.LiquidationParams memory liquidationParams = ISystemParams.LiquidationParams({
            liquidationPenaltySP: 5e16,
            liquidationPenaltyRedistribution: 10 * _1pct // 10% == (110% - 100%)
        });

        // Should not revert
        SystemParams params = new SystemParams(false, 
            _getValidDebtParams(),
            liquidationParams,
            _getValidGasCompParams(),
            _getValidCollateralParams(),
            _getValidInterestParams(),
            _getValidRedemptionParams(),
            _getValidPoolParams()
        );

        assertEq(params.LIQUIDATION_PENALTY_REDISTRIBUTION(), 10 * _1pct);
    }

    function testConstructorRevertsWhenRedistPenaltyExceedsMCRBufferWithDifferentMCR() public {
        // MCR = 115%, so buffer = 15%. Set redistribution penalty to 16% (exceeds buffer)
        ISystemParams.CollateralParams memory collateralParams = ISystemParams.CollateralParams({
            ccr: 150 * _1pct,
            scr: 115 * _1pct,
            mcr: 115 * _1pct,
            bcr: 10 * _1pct
        });

        ISystemParams.LiquidationParams memory liquidationParams = ISystemParams.LiquidationParams({
            liquidationPenaltySP: 5e16,
            liquidationPenaltyRedistribution: 16 * _1pct // 16% > (115% - 100%)
        });

        vm.expectRevert(ISystemParams.RedistPenaltyTooHigh.selector);
        new SystemParams(false, 
            _getValidDebtParams(),
            liquidationParams,
            _getValidGasCompParams(),
            collateralParams,
            _getValidInterestParams(),
            _getValidRedemptionParams(),
            _getValidPoolParams()
        );

        liquidationParams = ISystemParams.LiquidationParams({
            liquidationPenaltySP: 5e16,
            liquidationPenaltyRedistribution: 15 * _1pct // 15%
        });

        new SystemParams(false, 
            _getValidDebtParams(),
            liquidationParams,
            _getValidGasCompParams(),
            collateralParams,
            _getValidInterestParams(),
            _getValidRedemptionParams(),
            _getValidPoolParams()
        );
    }

    // ========== GAS COMPENSATION VALIDATION TESTS ==========

    function testConstructorRevertsWhenGasCompDivisorZero() public {
        ISystemParams.GasCompParams memory gasCompParams = ISystemParams.GasCompParams({
            collGasCompensationDivisor: 0,
            collGasCompensationCap: 2 ether,
            ethGasCompensation: 0.0375 ether
        });

        vm.expectRevert(ISystemParams.InvalidGasCompensation.selector);
        new SystemParams(false, 
            _getValidDebtParams(),
            _getValidLiquidationParams(),
            gasCompParams,
            _getValidCollateralParams(),
            _getValidInterestParams(),
            _getValidRedemptionParams(),
            _getValidPoolParams()
        );
    }

    function testConstructorRevertsWhenGasCompDivisorTooHigh() public {
        ISystemParams.GasCompParams memory gasCompParams = ISystemParams.GasCompParams({
            collGasCompensationDivisor: 1001,
            collGasCompensationCap: 2 ether,
            ethGasCompensation: 0.0375 ether
        });

        vm.expectRevert(ISystemParams.InvalidGasCompensation.selector);
        new SystemParams(false, 
            _getValidDebtParams(),
            _getValidLiquidationParams(),
            gasCompParams,
            _getValidCollateralParams(),
            _getValidInterestParams(),
            _getValidRedemptionParams(),
            _getValidPoolParams()
        );
    }

    function testConstructorRevertsWhenGasCompCapZero() public {
        ISystemParams.GasCompParams memory gasCompParams = ISystemParams.GasCompParams({
            collGasCompensationDivisor: 200,
            collGasCompensationCap: 0,
            ethGasCompensation: 0.0375 ether
        });

        vm.expectRevert(ISystemParams.InvalidGasCompensation.selector);
        new SystemParams(false, 
            _getValidDebtParams(),
            _getValidLiquidationParams(),
            gasCompParams,
            _getValidCollateralParams(),
            _getValidInterestParams(),
            _getValidRedemptionParams(),
            _getValidPoolParams()
        );
    }

    function testConstructorRevertsWhenGasCompCapTooHigh() public {
        ISystemParams.GasCompParams memory gasCompParams = ISystemParams.GasCompParams({
            collGasCompensationDivisor: 200,
            collGasCompensationCap: 11 ether,
            ethGasCompensation: 0.0375 ether
        });

        vm.expectRevert(ISystemParams.InvalidGasCompensation.selector);
        new SystemParams(false, 
            _getValidDebtParams(),
            _getValidLiquidationParams(),
            gasCompParams,
            _getValidCollateralParams(),
            _getValidInterestParams(),
            _getValidRedemptionParams(),
            _getValidPoolParams()
        );
    }

    function testConstructorRevertsWhenETHGasCompZero() public {
        ISystemParams.GasCompParams memory gasCompParams = ISystemParams.GasCompParams({
            collGasCompensationDivisor: 200,
            collGasCompensationCap: 2 ether,
            ethGasCompensation: 0
        });

        vm.expectRevert(ISystemParams.InvalidGasCompensation.selector);
        new SystemParams(false, 
            _getValidDebtParams(),
            _getValidLiquidationParams(),
            gasCompParams,
            _getValidCollateralParams(),
            _getValidInterestParams(),
            _getValidRedemptionParams(),
            _getValidPoolParams()
        );
    }

    function testConstructorRevertsWhenETHGasCompTooHigh() public {
        ISystemParams.GasCompParams memory gasCompParams = ISystemParams.GasCompParams({
            collGasCompensationDivisor: 200,
            collGasCompensationCap: 2 ether,
            ethGasCompensation: 1.1 ether
        });

        vm.expectRevert(ISystemParams.InvalidGasCompensation.selector);
        new SystemParams(false, 
            _getValidDebtParams(),
            _getValidLiquidationParams(),
            gasCompParams,
            _getValidCollateralParams(),
            _getValidInterestParams(),
            _getValidRedemptionParams(),
            _getValidPoolParams()
        );
    }

    // ========== COLLATERAL VALIDATION TESTS ==========

    function testConstructorRevertsWhenCCRTooLow() public {
        ISystemParams.CollateralParams memory collateralParams = ISystemParams.CollateralParams({
            ccr: _100pct, // <= 100%
            scr: 110 * _1pct,
            mcr: 110 * _1pct,
            bcr: 10 * _1pct
        });

        vm.expectRevert(ISystemParams.InvalidCCR.selector);
        new SystemParams(false, 
            _getValidDebtParams(),
            _getValidLiquidationParams(),
            _getValidGasCompParams(),
            collateralParams,
            _getValidInterestParams(),
            _getValidRedemptionParams(),
            _getValidPoolParams()
        );
    }

    function testConstructorRevertsWhenCCRTooHigh() public {
        ISystemParams.CollateralParams memory collateralParams = ISystemParams.CollateralParams({
            ccr: 2 * _100pct, // >= 200%
            scr: 110 * _1pct,
            mcr: 110 * _1pct,
            bcr: 10 * _1pct
        });

        vm.expectRevert(ISystemParams.InvalidCCR.selector);
        new SystemParams(false, 
            _getValidDebtParams(),
            _getValidLiquidationParams(),
            _getValidGasCompParams(),
            collateralParams,
            _getValidInterestParams(),
            _getValidRedemptionParams(),
            _getValidPoolParams()
        );
    }

    function testConstructorRevertsWhenMCRTooLow() public {
        ISystemParams.CollateralParams memory collateralParams = ISystemParams.CollateralParams({
            ccr: 150 * _1pct,
            scr: 110 * _1pct,
            mcr: _100pct, // <= 100%
            bcr: 10 * _1pct
        });

        vm.expectRevert(ISystemParams.InvalidMCR.selector);
        new SystemParams(false, 
            _getValidDebtParams(),
            _getValidLiquidationParams(),
            _getValidGasCompParams(),
            collateralParams,
            _getValidInterestParams(),
            _getValidRedemptionParams(),
            _getValidPoolParams()
        );
    }

    function testConstructorRevertsWhenMCRTooHigh() public {
        ISystemParams.CollateralParams memory collateralParams = ISystemParams.CollateralParams({
            ccr: 150 * _1pct,
            scr: 110 * _1pct,
            mcr: 2 * _100pct, // >= 200%
            bcr: 10 * _1pct
        });

        vm.expectRevert(ISystemParams.InvalidMCR.selector);
        new SystemParams(false, 
            _getValidDebtParams(),
            _getValidLiquidationParams(),
            _getValidGasCompParams(),
            collateralParams,
            _getValidInterestParams(),
            _getValidRedemptionParams(),
            _getValidPoolParams()
        );
    }

    function testConstructorRevertsWhenBCRTooLow() public {
        ISystemParams.CollateralParams memory collateralParams = ISystemParams.CollateralParams({
            ccr: 150 * _1pct,
            scr: 110 * _1pct,
            mcr: 110 * _1pct,
            bcr: 4 * _1pct // < 5%
        });

        vm.expectRevert(ISystemParams.InvalidBCR.selector);
        new SystemParams(false, 
            _getValidDebtParams(),
            _getValidLiquidationParams(),
            _getValidGasCompParams(),
            collateralParams,
            _getValidInterestParams(),
            _getValidRedemptionParams(),
            _getValidPoolParams()
        );
    }

    function testConstructorRevertsWhenBCRTooHigh() public {
        ISystemParams.CollateralParams memory collateralParams = ISystemParams.CollateralParams({
            ccr: 150 * _1pct,
            scr: 110 * _1pct,
            mcr: 110 * _1pct,
            bcr: 50 * _1pct // >= 50%
        });

        vm.expectRevert(ISystemParams.InvalidBCR.selector);
        new SystemParams(false, 
            _getValidDebtParams(),
            _getValidLiquidationParams(),
            _getValidGasCompParams(),
            collateralParams,
            _getValidInterestParams(),
            _getValidRedemptionParams(),
            _getValidPoolParams()
        );
    }

    function testConstructorRevertsWhenSCRTooLow() public {
        ISystemParams.CollateralParams memory collateralParams = ISystemParams.CollateralParams({
            ccr: 150 * _1pct,
            scr: _100pct, // <= 100%
            mcr: 110 * _1pct,
            bcr: 10 * _1pct
        });

        vm.expectRevert(ISystemParams.InvalidSCR.selector);
        new SystemParams(false, 
            _getValidDebtParams(),
            _getValidLiquidationParams(),
            _getValidGasCompParams(),
            collateralParams,
            _getValidInterestParams(),
            _getValidRedemptionParams(),
            _getValidPoolParams()
        );
    }

    function testConstructorRevertsWhenSCRTooHigh() public {
        ISystemParams.CollateralParams memory collateralParams = ISystemParams.CollateralParams({
            ccr: 150 * _1pct,
            scr: 2 * _100pct, // >= 200%
            mcr: 110 * _1pct,
            bcr: 10 * _1pct
        });

        vm.expectRevert(ISystemParams.InvalidSCR.selector);
        new SystemParams(false, 
            _getValidDebtParams(),
            _getValidLiquidationParams(),
            _getValidGasCompParams(),
            collateralParams,
            _getValidInterestParams(),
            _getValidRedemptionParams(),
            _getValidPoolParams()
        );
    }

    // ========== INTEREST VALIDATION TESTS ==========

    function testConstructorRevertsWhenMinInterestRateGreaterThanMax() public {
        ISystemParams.InterestParams memory interestParams = ISystemParams.InterestParams({
            minAnnualInterestRate: 300 * _1pct // min > MAX (250%)
        });

        vm.expectRevert(ISystemParams.MinInterestRateGtMax.selector);
        new SystemParams(false, 
            _getValidDebtParams(),
            _getValidLiquidationParams(),
            _getValidGasCompParams(),
            _getValidCollateralParams(),
            interestParams,
            _getValidRedemptionParams(),
            _getValidPoolParams()
        );
    }


    // ========== REDEMPTION VALIDATION TESTS ==========

    function testConstructorRevertsWhenRedemptionFeeFloorTooHigh() public {
        ISystemParams.RedemptionParams memory redemptionParams = ISystemParams.RedemptionParams({
            redemptionFeeFloor: _100pct + 1,
            initialBaseRate: _100pct,
            redemptionMinuteDecayFactor: 998076443575628800,
            redemptionBeta: 1
        });

        vm.expectRevert(ISystemParams.InvalidFeeValue.selector);
        new SystemParams(false, 
            _getValidDebtParams(),
            _getValidLiquidationParams(),
            _getValidGasCompParams(),
            _getValidCollateralParams(),
            _getValidInterestParams(),
            redemptionParams,
            _getValidPoolParams()
        );
    }

    function testConstructorRevertsWhenInitialBaseRateTooHigh() public {
        ISystemParams.RedemptionParams memory redemptionParams = ISystemParams.RedemptionParams({
            redemptionFeeFloor: _1pct / 2,
            initialBaseRate: 1001 * _1pct, // > 1000%
            redemptionMinuteDecayFactor: 998076443575628800,
            redemptionBeta: 1
        });

        vm.expectRevert(ISystemParams.InvalidFeeValue.selector);
        new SystemParams(false, 
            _getValidDebtParams(),
            _getValidLiquidationParams(),
            _getValidGasCompParams(),
            _getValidCollateralParams(),
            _getValidInterestParams(),
            redemptionParams,
            _getValidPoolParams()
        );
    }

    // ========== STABILITY POOL VALIDATION TESTS ==========

    function testConstructorRevertsWhenSPYieldSplitTooHigh() public {
        ISystemParams.StabilityPoolParams memory poolParams = ISystemParams.StabilityPoolParams({
            spYieldSplit: _100pct + 1,
            minBoldInSP: 1e18,
            minBoldAfterRebalance: 1_000e18
        });

        vm.expectRevert(ISystemParams.InvalidFeeValue.selector);
        new SystemParams(false, 
            _getValidDebtParams(),
            _getValidLiquidationParams(),
            _getValidGasCompParams(),
            _getValidCollateralParams(),
            _getValidInterestParams(),
            _getValidRedemptionParams(),
            poolParams
        );
    }

    function testConstructorRevertsWhenMinBoldInSPLessThan1e18() public {
        ISystemParams.StabilityPoolParams memory poolParams = ISystemParams.StabilityPoolParams({
            spYieldSplit: 75 * _1pct,
            minBoldInSP: 1e18 - 1, // < 1e18
            minBoldAfterRebalance: 1_000e18
        });

        vm.expectRevert(ISystemParams.InvalidMinBoldInSP.selector);
        new SystemParams(false, 
            _getValidDebtParams(),
            _getValidLiquidationParams(),
            _getValidGasCompParams(),
            _getValidCollateralParams(),
            _getValidInterestParams(),
            _getValidRedemptionParams(),
            poolParams
        );
    }

    function testConstructorRevertsWhenMinBoldAfterRebalanceLessThanMinBoldInSP() public {
        ISystemParams.StabilityPoolParams memory poolParams = ISystemParams.StabilityPoolParams({
            spYieldSplit: 75 * _1pct,
            minBoldInSP: 1e18,
            minBoldAfterRebalance: 1e18 - 1 // < 1e18
        });

        vm.expectRevert(ISystemParams.InvalidMinBoldInSP.selector);
        new SystemParams(false, 
            _getValidDebtParams(),
            _getValidLiquidationParams(),
            _getValidGasCompParams(),
            _getValidCollateralParams(),
            _getValidInterestParams(),
            _getValidRedemptionParams(),
            poolParams
        );
    }

    // ========== HELPER FUNCTIONS ==========

    function _getValidDebtParams() internal pure returns (ISystemParams.DebtParams memory) {
        return ISystemParams.DebtParams({minDebt: 2000e18});
    }

    function _getValidLiquidationParams() internal pure returns (ISystemParams.LiquidationParams memory) {
        return ISystemParams.LiquidationParams({
            liquidationPenaltySP: 5e16,
            liquidationPenaltyRedistribution: 10e16
        });
    }

    function _getValidGasCompParams() internal pure returns (ISystemParams.GasCompParams memory) {
        return ISystemParams.GasCompParams({
            collGasCompensationDivisor: 200,
            collGasCompensationCap: 2 ether,
            ethGasCompensation: 0.0375 ether
        });
    }

    function _getValidCollateralParams() internal pure returns (ISystemParams.CollateralParams memory) {
        return ISystemParams.CollateralParams({
            ccr: 150 * _1pct,
            scr: 110 * _1pct,
            mcr: 110 * _1pct,
            bcr: 10 * _1pct
        });
    }

    function _getValidInterestParams() internal pure returns (ISystemParams.InterestParams memory) {
        return ISystemParams.InterestParams({
            minAnnualInterestRate: _1pct / 2
        });
    }

    function _getValidRedemptionParams() internal pure returns (ISystemParams.RedemptionParams memory) {
        return ISystemParams.RedemptionParams({
            redemptionFeeFloor: _1pct / 2,
            initialBaseRate: _100pct,
            redemptionMinuteDecayFactor: 998076443575628800,
            redemptionBeta: 1
        });
    }

    function _getValidPoolParams() internal pure returns (ISystemParams.StabilityPoolParams memory) {
        return ISystemParams.StabilityPoolParams({
            spYieldSplit: 75 * _1pct,
            minBoldInSP: 1e18,
            minBoldAfterRebalance: 1_000e18
        });
    }
}