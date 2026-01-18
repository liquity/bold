// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IPriceFeed {
    function fetchPrice() external returns (uint256);
    function isL2SequencerUp() external view returns (bool);
}
