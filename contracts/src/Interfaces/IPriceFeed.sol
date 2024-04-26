// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

interface IPriceFeed {
    function fetchPrice() external returns (uint256);
}
