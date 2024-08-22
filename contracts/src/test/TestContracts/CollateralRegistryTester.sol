// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "../../CollateralRegistry.sol";

/* Tester contract inherits from CollateralRegistry, and provides external functions
for testing the parent's internal functions. */

contract CollateralRegistryTester is CollateralRegistry {
<<<<<<< HEAD
    constructor(IBoldToken _boldToken, IERC20Metadata[] memory _tokens) CollateralRegistry(_boldToken, _tokens) {}
=======
    constructor(IBoldToken _boldToken, IERC20[] memory _tokens, ITroveManager[] memory _troveManagers)
        CollateralRegistry(_boldToken, _tokens, _troveManagers)
    {}
>>>>>>> c3bc3a0f122c0e858ca9751c0b3f01f8b2bf735f

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
