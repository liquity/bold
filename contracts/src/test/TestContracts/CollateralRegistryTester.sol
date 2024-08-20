// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "../../CollateralRegistry.sol";

/* Tester contract inherits from CollateralRegistry, and provides external functions
for testing the parent's internal functions. */

contract CollateralRegistryTester is CollateralRegistry {
    constructor(IBoldToken _boldToken, IERC20[] memory _tokens) CollateralRegistry(_boldToken, _tokens) {}

    function unprotectedDecayBaseRateFromBorrowing() external returns (uint256) {
        baseRate = _calcDecayedBaseRate();
        assert(baseRate >= 0 && baseRate <= DECIMAL_PRECISION);

        _updateLastFeeOpTime();
        return baseRate;
    }

    function minutesPassedSinceLastFeeOp() external view returns (uint256) {
        return _minutesPassedSinceLastFeeOp();
    }

    function setLastFeeOpTimeToNow() external {
        lastFeeOperationTime = block.timestamp;
    }

    function setBaseRate(uint256 _baseRate) external {
        baseRate = _baseRate;
    }
}
