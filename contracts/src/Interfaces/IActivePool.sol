// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "./IInterestRouter.sol";

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
    function getBoldDebtLowerBound() external view returns (uint256);
    function getBoldDebtUpperBound() external view returns (uint256);
    function lastAggUpdateTime() external view returns (uint256);
    function aggRecordedDebt() external view returns (uint256);
    function aggWeightedDebtSum() external view returns (uint256);
    function aggRecordedUpfrontInterest() external view returns (uint256);
    function calcPendingAggInterest() external view returns (uint256);

    function mintAggInterest() external;
    function mintAggInterestAndAccountForTroveChange(
        uint256 _appliedRedistBoldDebtGain,
        uint256 _debtIncrease,
        uint256 _debtDecrease,
        uint256 _newWeightedRecordedDebt,
        uint256 _oldWeightedRecordedDebt,
        uint256 _newRecordedUpfrontInterest,
        uint256 _oldRecordedUpfrontInterest,
        uint256 _forgoneUpfrontInterest
    ) external;

    function sendETH(address _account, uint256 _amount) external;
    function sendETHToDefaultPool(uint256 _amount) external;
    function receiveETH(uint256 _amount) external;
    function accountForReceivedETH(uint256 _amount) external;
}
