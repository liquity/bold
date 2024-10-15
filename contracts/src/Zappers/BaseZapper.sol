// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import "../Dependencies/AddRemoveManagers.sol";

contract BaseZapper is AddRemoveManagers {
    IBorrowerOperations public immutable borrowerOperations; // LST branch (i.e., not WETH as collateral)
    ITroveManager public immutable troveManager;
    IWETH public immutable WETH;
    IBoldToken public immutable boldToken;

    constructor(IAddressesRegistry _addressesRegistry) AddRemoveManagers(_addressesRegistry) {
        borrowerOperations = _addressesRegistry.borrowerOperations();
        troveManager = _addressesRegistry.troveManager();
        boldToken = _addressesRegistry.boldToken();
        WETH = _addressesRegistry.WETH();
    }

    function _checkAdjustTroveManagers(
        uint256 _troveId,
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _boldChange,
        bool _isDebtIncrease
    ) internal view returns (address) {
        address owner = troveNFT.ownerOf(_troveId);
        address receiver = owner;

        if ((!_isCollIncrease && _collChange > 0) || _isDebtIncrease) {
            receiver = _requireSenderIsOwnerOrRemoveManagerAndGetReceiver(_troveId, owner);
        }

        if (_isCollIncrease || (!_isDebtIncrease && _boldChange > 0)) {
            _requireSenderIsOwnerOrAddManager(_troveId, owner);
        }

        return receiver;
    }
}
