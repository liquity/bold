// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface ILQTYStaking {
    function setAddresses(
        address _lqtyTokenAddress,
        address _boldTokenAddress,
        address _troveManagerAddress,
        address _borrowerOperationsAddress,
        address _activePoolAddress
    ) external;

    function stake(uint256 _LQTYamount) external;

    function unstake(uint256 _LQTYamount) external;

    function increaseF_ETH(uint256 _ETHFee) external;

    function increaseF_bold(uint256 _LQTYFee) external;

    function getPendingETHGain(address _user) external view returns (uint256);

    function getPendingBoldGain(address _user) external view returns (uint256);
}
