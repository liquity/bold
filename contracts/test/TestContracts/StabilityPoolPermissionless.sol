// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import "src/StabilityPool.sol";



contract StabilityPoolPermissionless is StabilityPool {
    constructor(IAddressesRegistry _addressesRegistry) StabilityPool(_addressesRegistry) {}

    function _requireCallerIsActivePool() internal view override {}

    function _requireCallerIsTroveManager() internal view override {}
}
