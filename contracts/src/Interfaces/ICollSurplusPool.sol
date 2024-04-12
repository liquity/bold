// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

interface ICollSurplusPool {
    function setAddresses(address _borrowerOperationsAddress, address _troveManagerAddress, address _activePoolAddress)
        external;

    function getETHBalance() external view returns (uint256);

    function getCollateral(uint256 _troveId) external view returns (uint256);

    function accountSurplus(uint256 _troveId, uint256 _amount) external;

    function claimColl(address _account, uint256 _troveId) external;
}
