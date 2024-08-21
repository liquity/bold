// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./IInterestRouter.sol";
import "./IBoldRewardsReceiver.sol";
import "../Types/TroveChange.sol";

interface IActivePool {
    function defaultPoolAddress() external view returns (address);
    function borrowerOperationsAddress() external view returns (address);
    function troveManagerAddress() external view returns (address);
    function interestRouter() external view returns (IInterestRouter);
    // We avoid IStabilityPool here in order to prevent creating a dependency cycle that would break flattening
    function stabilityPool() external view returns (IBoldRewardsReceiver);

    function getCollBalance() external view returns (uint256);
    function getBoldDebt() external view returns (uint256);
    function lastAggUpdateTime() external view returns (uint256);
    function aggRecordedDebt() external view returns (uint256);
    function aggWeightedDebtSum() external view returns (uint256);
    function aggBatchManagementFees() external view returns (uint256);
    function aggWeightedBatchManagementFeeSum() external view returns (uint256);
    function calcPendingAggInterest() external view returns (uint256);
    function calcPendingSPYield() external view returns (uint256);
    function calcPendingAggBatchManagementFee() external view returns (uint256);
    function getNewApproxAvgInterestRateFromTroveChange(TroveChange calldata _troveChange)
        external
        view
        returns (uint256);

    function mintAggInterest() external;
    function mintAggInterestAndAccountForTroveChange(TroveChange calldata _troveChange, address _batchManager)
        external;
    function mintBatchManagementFeeAndAccountForChange(TroveChange calldata _troveChange, address _batchAddress)
        external;

    function setShutdownFlag() external;
    function hasBeenShutDown() external view returns (bool);
    function shutdownTime() external view returns (uint256);

    function sendColl(address _account, uint256 _amount) external;
    function sendCollToDefaultPool(uint256 _amount) external;
    function receiveColl(uint256 _amount) external;
    function accountForReceivedColl(uint256 _amount) external;
}
