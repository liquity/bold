// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import "../Interfaces/IAddRemoveManagers.sol";
import "../Interfaces/ITroveManager.sol";


contract AddRemoveManagers is IAddRemoveManagers {

    ITroveManager public immutable troveManager;

    /*
     * Mapping from TroveId to granted address for operations that "give" money to the trove (add collateral, pay debt).
     * Useful for instance for cold/hot wallet setups.
     * If its value is zero address, any address is allowed to do those operations on behalf of trove owner.
     * Otherwise, only the address in this mapping (and the trove owner) will be allowed.
     * To restrict this permission to no one, trove owner should be set in this mapping.
     */
    mapping(uint256 => address) public addManagerOf;

    /*
     * Mapping from TroveId to granted address for operations that "withdraw" money from the trove (withdraw collateral, borrow).
     * Useful for instance for cold/hot wallet setups.
     * If its value is zero address, only owner is allowed to do those operations.
     * Otherwise, only the address in this mapping (and the trove owner) will be allowed.
     * Therefore, by default this permission is restricted to no one.
     * Trove owner be set in this mapping is equivalent to zero address.
     */
    mapping(uint256 => address) public removeManagerOf;

    // Same as removeManagerOf, but the manager instead of the owner would receive the funds.
    mapping(uint256 => address) public receiveManagerOf;

    event TroveManagerAddressChanged(address _newTroveManagerAddress);

    constructor(ITroveManager _troveManager) {
        troveManager = _troveManager;
        emit TroveManagerAddressChanged(address(_troveManager));
    }

    function setAddManager(uint256 _troveId, address _manager) external {
        _requireSenderIsOwner(troveManager, _troveId);
        addManagerOf[_troveId] = _manager;
    }

    function setRemoveManager(uint256 _troveId, address _manager) external {
        _requireSenderIsOwner(troveManager, _troveId);
        removeManagerOf[_troveId] = _manager;
    }

    function setReceiveManager(uint256 _troveId, address _manager) external {
        _requireSenderIsOwner(troveManager, _troveId);
        receiveManagerOf[_troveId] = _manager;
    }

    function _requireSenderIsOwner(ITroveManager _troveManager, uint256 _troveId) internal view {
        require(_troveManager.ownerOf(_troveId) == msg.sender, "BorrowerOps: sender is not Trove owner");
    }

    function _requireSenderIsOwnerOrAddManager(uint256 _troveId, address _owner) internal view {
        address addManager = addManagerOf[_troveId];
        require(
            msg.sender == _owner || addManager == address(0) || msg.sender == addManager,
            "BorrowerOps: sender is neither Trove owner nor add-manager"
        );
    }

    function _requireSenderIsOwnerOrRemoveManager(uint256 _troveId, address _owner) internal view returns(address) {
        if (msg.sender == receiveManagerOf[_troveId]) {
            return msg.sender;
        }
        require(
            msg.sender == _owner || msg.sender == removeManagerOf[_troveId],
            "BorrowerOps: sender is neither Trove owner nor remove-manager"
        );
        return _owner;
    }
}
