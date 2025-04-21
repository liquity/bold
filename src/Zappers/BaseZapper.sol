// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "../Interfaces/IWETH.sol";
import "../Interfaces/IAddressesRegistry.sol";
import "../Interfaces/IBorrowerOperations.sol";
import "../Dependencies/AddRemoveManagers.sol";
import "./LeftoversSweep.sol";
import "./Interfaces/IFlashLoanProvider.sol";
import "./Interfaces/IFlashLoanReceiver.sol";
import "./Interfaces/IExchange.sol";
import "./Interfaces/IZapper.sol";

abstract contract BaseZapper is AddRemoveManagers, LeftoversSweep, IFlashLoanReceiver, IZapper {
    IBorrowerOperations public immutable borrowerOperations; // LST branch (i.e., not WETH as collateral)
    ITroveManager public immutable troveManager;
    IWETH public immutable WETH;
    IBoldToken public immutable boldToken;

    IFlashLoanProvider public immutable flashLoanProvider;
    IExchange public immutable exchange;

    constructor(IAddressesRegistry _addressesRegistry, IFlashLoanProvider _flashLoanProvider, IExchange _exchange)
        AddRemoveManagers(_addressesRegistry)
    {
        borrowerOperations = _addressesRegistry.borrowerOperations();
        troveManager = _addressesRegistry.troveManager();
        boldToken = _addressesRegistry.boldToken();
        WETH = _addressesRegistry.WETH();

        flashLoanProvider = _flashLoanProvider;
        exchange = _exchange;
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
