// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

interface ILockupContractFactory {
    function setLQTYTokenAddress(address _lqtyTokenAddress) external;

    function deployLockupContract(address _beneficiary, uint256 _unlockTime) external;

    function isRegisteredLockup(address _addr) external view returns (bool);
}
