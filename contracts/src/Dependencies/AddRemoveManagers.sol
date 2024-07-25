// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.18;

import "../Interfaces/IAddRemoveManagers.sol";
import "../Interfaces/IAddressesRegistry.sol";
import "../Interfaces/ITroveNFT.sol";

contract AddRemoveManagers is IAddRemoveManagers {
    ITroveNFT public immutable troveNFT;

    /*
     * Mapping from TroveId to granted address for operations that "give" money to the trove (add collateral, pay debt).
     * Useful for instance for cold/hot wallet setups.
     * If its value is zero address, any address is allowed to do those operations on behalf of trove owner.
     * Otherwise, only the address in this mapping (and the trove owner) will be allowed.
     * To restrict this permission to no one, trove owner should be set in this mapping.
     */
    mapping(uint256 => address) public addManagerOf;

    /*
     * Mapping from TroveId to granted addresses for operations that "withdraw" money from the trove (withdraw collateral, borrow),
     * and for each of those addresses another mapping to the receiver of those withdrawn funds.
     * Useful for instance for cold/hot wallet setups or for automations.
     * Only the address in this mapping, if any, and the trove owner, be allowed.
     * Therefore, by default this permission is restricted to no one.
     * The receiver can never be zero.
     */
    mapping(uint256 => mapping(address => address)) public removeManagerReceiverOf;

    error EmptyManager();
    error EmptyReceiver();
    error NotBorrower();
    error NotOwnerNorAddManager();
    error NotOwnerNorRemoveManager();

    event TroveNFTAddressChanged(address _newTroveNFTAddress);

    constructor(IAddressesRegistry _addressesRegistry) {
        troveNFT = _addressesRegistry.troveNFT();
        emit TroveNFTAddressChanged(address(troveNFT));
    }

    function setAddManager(uint256 _troveId, address _manager) external {
        _requireCallerIsBorrower(_troveId);
        _setAddManager(_troveId, _manager);
    }

    function _setAddManager(uint256 _troveId, address _manager) internal {
        addManagerOf[_troveId] = _manager;
    }

    function setRemoveManager(uint256 _troveId, address _manager) external {
        setRemoveManager(_troveId, _manager, troveNFT.ownerOf(_troveId));
    }

    function setRemoveManager(uint256 _troveId, address _manager, address _receiver) public {
        _requireCallerIsBorrower(_troveId);
        _requireNonZeroManager(_manager);
        _setRemoveManager(_troveId, _manager, _receiver);
    }

    function _setRemoveManager(uint256 _troveId, address _manager, address _receiver) internal {
        _requireNonZeroReceiver(_receiver);
        removeManagerReceiverOf[_troveId][_manager] = _receiver;
    }

    function _requireNonZeroManager(address _manager) internal pure {
        if (_manager == address(0)) {
            revert EmptyManager();
        }
    }

    function _requireNonZeroReceiver(address _receiver) internal pure {
        if (_receiver == address(0)) {
            revert EmptyReceiver();
        }
    }

    function _requireCallerIsBorrower(uint256 _troveId) internal view {
        if (msg.sender != troveNFT.ownerOf(_troveId)) {
            revert NotBorrower();
        }
    }

    function _requireSenderIsOwnerOrAddManager(uint256 _troveId, address _owner) internal view {
        address addManager = addManagerOf[_troveId];
        if (msg.sender != _owner && addManager != address(0) && msg.sender != addManager) {
            revert NotOwnerNorAddManager();
        }
    }

    function _requireSenderIsOwnerOrRemoveManager(uint256 _troveId, address _owner) internal view returns (address) {
        address receiver = removeManagerReceiverOf[_troveId][msg.sender];
        if (receiver == address(0)) {
            if (msg.sender != _owner) {
                revert NotOwnerNorRemoveManager();
            }
            return _owner;
        }
        return receiver;
    }
}
