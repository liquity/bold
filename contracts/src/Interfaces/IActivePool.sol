// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "./IPool.sol";
import "./IInterestRouter.sol";

interface IActivePool is IPool {
    function stabilityPoolAddress() external view returns (address);
    function defaultPoolAddress() external view returns (address);
    function borrowerOperationsAddress() external view returns (address);
    function troveManagerAddress() external view returns (address);
    function interestRouter() external view returns (IInterestRouter);

    function getTotalActiveDebt() external view returns (uint256);
    function lastAggUpdateTime() external view returns (uint256);
    function aggRecordedDebt() external view returns (uint256);
    function aggWeightedDebtSum() external view returns (uint256);
    function calcPendingAggInterest() external view returns (uint256);
    

    function mintAggInterest(int256 _troveDebtChange) external;
    function increaseAggWeightedDebtSum(uint256 _debt, uint256 _annualInterestRate) external;
    function decreaseAggWeightedDebtSum(uint256 _weightedRecordedTroveDebt) external;
    function sendETH(address _account, uint _amount) external;
    function sendETHToDefaultPool(uint _amount) external;
    function setAddresses(
        address _borrowerOperationsAddress,
        address _troveManagerAddress,
        address _stabilityPoolAddress,
        address _defaultPoolAddress,
        address _boldTokenAddress,
        address _interestRouterAddress
    ) external;
}
