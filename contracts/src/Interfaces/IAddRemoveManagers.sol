// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "./ITroveManager.sol";


interface IAddRemoveManagers {
    function troveManager() external view returns (ITroveManager);

    function setAddManager(uint256 _troveId, address _manager) external;
    function setRemoveManager(uint256 _troveId, address _manager) external;
    function setReceiveManager(uint256 _troveId, address _manager) external;
    function addManagerOf(uint256 _troveId) external view returns (address);
    function removeManagerOf(uint256 _troveId) external view returns (address);

}
