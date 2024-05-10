// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "./IInterestRouter.sol";
import "./IStabilityPool.sol";

interface IActivePool {
    function defaultPoolAddress() external view returns (address);
    function borrowerOperationsAddress() external view returns (address);
    function troveManagerAddress() external view returns (address);
    function interestRouter() external view returns (IInterestRouter);
    function stabilityPool() external view returns (IStabilityPool);
    function setAddresses(
        address _borrowerOperationsAddress,
        address _troveManagerAddress,
        address _stabilityPoolAddress,
        address _defaultPoolAddress,
        address _boldTokenAddress,
        address _interestRouterAddress
    ) external;

    function SP_YIELD_SPLIT() external view returns (uint256);
    function getETHBalance() external view returns (uint256);
    function getTotalActiveDebt() external view returns (uint256);
    function lastAggUpdateTime() external view returns (uint256);
    function aggRecordedDebt() external view returns (uint256);
    function aggWeightedDebtSum() external view returns (uint256);
    function calcPendingAggInterest() external view returns (uint256);

    function mintAggInterest() external;
    function mintAggInterestAndAccountForTroveChange(
        uint256 _troveDebtIncrease,
        uint256 _troveDebtDecrease,
        uint256 _newWeightedRecordedTroveDebt,
        uint256 _oldWeightedRecordedTroveDebt
    ) external;

    function sendETH(address _account, uint256 _amount) external;
    function sendETHToDefaultPool(uint256 _amount) external;
    function receiveETH(uint256 _amount) external;
    function accountForReceivedETH(uint256 _amount) external;
}
