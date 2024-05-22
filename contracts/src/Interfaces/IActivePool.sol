// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "./IInterestRouter.sol";
import "../Types/TroveChange.sol";

interface IActivePool {
    function stabilityPoolAddress() external view returns (address);
    function defaultPoolAddress() external view returns (address);
    function borrowerOperationsAddress() external view returns (address);
    function troveManagerAddress() external view returns (address);
    function interestRouter() external view returns (IInterestRouter);
    function setAddresses(
        address _borrowerOperationsAddress,
        address _troveManagerAddress,
        address _stabilityPoolAddress,
        address _defaultPoolAddress,
        address _boldTokenAddress,
        address _interestRouterAddress
    ) external;

    function getETHBalance() external view returns (uint256);
    function getBoldDebt() external view returns (uint256);
    function lastAggUpdateTime() external view returns (uint256);
    function aggRecordedDebt() external view returns (uint256);
    function aggWeightedDebtSum() external view returns (uint256);
    function calcPendingAggInterest() external view returns (uint256);
    function getNewApproxAvgInterestRateFromTroveChange(TroveChange calldata _troveChange)
        external
        view
        returns (uint256);

    function mintAggInterest() external;
    function mintAggInterestAndAccountForTroveChange(TroveChange calldata _troveChange) external;

    function sendETH(address _account, uint256 _amount) external;
    function sendETHToDefaultPool(uint256 _amount) external;
    function receiveETH(uint256 _amount) external;
    function accountForReceivedETH(uint256 _amount) external;
}
