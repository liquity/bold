// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./IWhitelist.sol";

interface IAddressesRegistryWhitelist {
    function whitelist() external view returns (IWhitelist);
}
