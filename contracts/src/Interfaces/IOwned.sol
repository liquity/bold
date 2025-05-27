// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IOwned {
    function owner() external view returns (address);

    function nominatedOwner() external view returns (address);

    function nominateNewOwner(address owner) external;

    function acceptOwnership() external;
}
