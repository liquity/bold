// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import "../Interfaces/IAddRemoveManagers.sol";
import "../Interfaces/IAddressesRegistry.sol";
import "../Interfaces/ITroveNFT.sol";

contract AddRemoveManagers is IAddRemoveManagers {
    ITroveNFT internal immutable troveNFT;

    struct RemoveManagerReceiver {
        address manager;
        address receiver;
    }

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
     * and for each of those addresses another address for the receiver of those withdrawn funds.
     * Useful for instance for cold/hot wallet setups or for automations.
     * Only the address in this mapping, if any, and the trove owner, will be allowed.
     * Therefore, by default this permission is restricted to no one.
     * If the receiver is zero, the owner is assumed as the receiver.
     * RemoveManager also assumes AddManager permission
     */
    mapping(uint256 => RemoveManagerReceiver) public removeManagerReceiverOf;

    error EmptyManager();
    error NotBorrower();
    error NotOwnerNorAddManager();
    error NotOwnerNorRemoveManager();

    event TroveNFTAddressChanged(address _newTroveNFTAddress);
    event AddManagerUpdated(uint256 indexed _troveId, address _newAddManager);
    event RemoveManagerAndReceiverUpdated(uint256 indexed _troveId, address _newRemoveManager, address _newReceiver);

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
        emit AddManagerUpdated(_troveId, _manager);
    }

    function setRemoveManager(uint256 _troveId, address _manager) external {
        setRemoveManagerWithReceiver(_troveId, _manager, troveNFT.ownerOf(_troveId));
    }

    function setRemoveManagerWithReceiver(uint256 _troveId, address _manager, address _receiver) public {
        _requireCallerIsBorrower(_troveId);
        _setRemoveManagerAndReceiver(_troveId, _manager, _receiver);
    }

    function _setRemoveManagerAndReceiver(uint256 _troveId, address _manager, address _receiver) internal {
        _requireNonZeroManagerUnlessWiping(_manager, _receiver);
        removeManagerReceiverOf[_troveId].manager = _manager;
        removeManagerReceiverOf[_troveId].receiver = _receiver;
        emit RemoveManagerAndReceiverUpdated(_troveId, _manager, _receiver);
    }

    function _wipeAddRemoveManagers(uint256 _troveId) internal {
        delete addManagerOf[_troveId];
        delete removeManagerReceiverOf[_troveId];
        emit AddManagerUpdated(_troveId, address(0));
        emit RemoveManagerAndReceiverUpdated(_troveId, address(0), address(0));
    }

    function _requireNonZeroManagerUnlessWiping(address _manager, address _receiver) internal pure {
        if (_manager == address(0) && _receiver != address(0)) {
            revert EmptyManager();
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
            // RemoveManager assumes AddManager permission too
            address removeManager = removeManagerReceiverOf[_troveId].manager;
            if (msg.sender != removeManager) {
                revert NotOwnerNorAddManager();
            }
        }
    }

    function _requireSenderIsOwnerOrRemoveManagerAndGetReceiver(uint256 _troveId, address _owner)
        internal
        view
        returns (address)
    {
        address manager = removeManagerReceiverOf[_troveId].manager;
        address receiver = removeManagerReceiverOf[_troveId].receiver;
        if (msg.sender != _owner && msg.sender != manager) {
            revert NotOwnerNorRemoveManager();
        }
        if (receiver == address(0) || msg.sender != manager) {
            return _owner;
        }
        return receiver;
    }
}
