// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

contract StabilityPoolMock {
    uint256 internal totalBoldDeposits;

    function offset(uint256, uint256) external {}

    function setTotalBoldDeposits(uint256 _totalBoldDeposits) external {
        totalBoldDeposits = _totalBoldDeposits;
    }

    function getTotalBoldDeposits() external view returns (uint256) {
        return totalBoldDeposits;
    }
}
