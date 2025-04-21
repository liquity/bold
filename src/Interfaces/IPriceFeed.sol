// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IPriceFeed {
    function fetchPrice() external returns (uint256, bool);
    function fetchRedemptionPrice() external returns (uint256, bool);
    function lastGoodPrice() external view returns (uint256);
    function setAddresses(address _borrowerOperationsAddress) external;
}
