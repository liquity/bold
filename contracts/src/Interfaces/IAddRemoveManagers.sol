// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

interface IAddRemoveManagers {
    function setAddManager(uint256 _troveId, address _manager) external;
    function setRemoveManager(uint256 _troveId, address _manager) external;
    function setRemoveManager(uint256 _troveId, address _manager, address _receiver) external;
    function addManagerOf(uint256 _troveId) external view returns (address);
    function removeManagerReceiverOf(uint256 _troveId, address _manager) external view returns (address);
}
