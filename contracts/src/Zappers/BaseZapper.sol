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

    function _getTroveIndex(address _sender, uint256 _ownerIndex) internal pure returns (uint256) {
        return uint256(keccak256(abi.encode(_sender, _ownerIndex)));
    }

    function _getTroveIndex(uint256 _ownerIndex) internal view returns (uint256) {
        return _getTroveIndex(msg.sender, _ownerIndex);
    }

    function _requireZapperIsReceiver(uint256 _troveId) internal view {
        (, address receiver) = borrowerOperations.removeManagerReceiverOf(_troveId);
        require(receiver == address(this), "BZ: Zapper is not receiver for this trove");
    }

    function _checkAdjustTroveManagers(
        uint256 _troveId,
        uint256 _collChange,
        bool _isCollIncrease,
        bool _isDebtIncrease
    ) internal view returns (address) {
        address owner = troveNFT.ownerOf(_troveId);
        address receiver = owner;

        if ((!_isCollIncrease && _collChange > 0) || _isDebtIncrease) {
            receiver = _requireSenderIsOwnerOrRemoveManagerAndGetReceiver(_troveId, owner);
            _requireZapperIsReceiver(_troveId);
        } else {
            // RemoveManager assumes AddManager, so if the former is set, there's no need to check the latter
            _requireSenderIsOwnerOrAddManager(_troveId, owner);
            // No need to check the type of trove change for two reasons:
            // - If the check above fails, it means sender is not owner, nor AddManager, nor RemoveManager.
            //   An independent 3rd party should not be allowed here.
            // - If it's not collIncrease or debtDecrease, _requireNonZeroAdjustment would revert
        }

        return receiver;
    }
}
