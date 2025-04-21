// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "src/Dependencies/AddRemoveManagers.sol";

contract AddRemoveManagersTester is AddRemoveManagers {
    constructor(IAddressesRegistry _addressesRegistry) AddRemoveManagers(_addressesRegistry) {}

    function setRemoveManagerWithReceiverPermissionless(uint256 _troveId, address _manager, address _receiver) public {
        _setRemoveManagerAndReceiver(_troveId, _manager, _receiver);
    }

    function requireSenderIsOwnerOrRemoveManagerAndGetReceiver(uint256 _troveId, address _owner)
        external
        view
        returns (address)
    {
        return _requireSenderIsOwnerOrRemoveManagerAndGetReceiver(_troveId, _owner);
    }
}
