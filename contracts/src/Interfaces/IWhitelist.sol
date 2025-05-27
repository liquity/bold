// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IWhitelist {
    function addToWhitelist(address callingContract, address user) external;
    function removeFromWhitelist(address callingContract, address user) external;
    function isWhitelisted(address callingContract, address user) external view returns (bool);
}
