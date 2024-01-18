// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

contract LQTYStakingMock {
    function setAddresses
    (
        address _lqtyTokenAddress,
        address _boldTokenAddress,
        address _troveManagerAddress, 
        address _borrowerOperationsAddress,
        address _activePoolAddress
    )  external {}

    function stake(uint _LQTYamount) external {}

    function unstake(uint _LQTYamount) external {}

    function increaseF_ETH(uint _ETHFee) external {}

    function increaseF_bold(uint _LQTYFee) external {}

    function getPendingETHGain(address _user) external view returns (uint) {}

    function getPendingBoldGain(address _user) external view returns (uint) {}
}
