// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IWhitelist {
    function addToWhitelist(address user) external;
    function removeFromWhitelist(address user) external;
    function isWhitelisted(address user) external view returns (bool);
}
