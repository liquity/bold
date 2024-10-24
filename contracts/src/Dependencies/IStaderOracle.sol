// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

interface IStaderOracle {
    function exchangeRate() external view returns (uint256, uint256, uint256);
}
