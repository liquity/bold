// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "openzeppelin-contracts/contracts/token/ERC721/IERC721.sol";

import "./ILiquityBase.sol";
import "./IStabilityPool.sol";
import "./IBoldToken.sol";
import "./ISortedTroves.sol";
import "../Types/LatestTroveData.sol";

// Common interface for the Trove Manager.
interface ITroveManager is IERC721, ILiquityBase {
    enum Status {
        nonExistent,
        active,
        closedByOwner,
        closedByLiquidation,
        unredeemable
    }

    function MCR() external view returns (uint256);
    function SCR() external view returns (uint256);
    function LIQUIDATION_PENALTY_SP() external view returns (uint256);
    function LIQUIDATION_PENALTY_REDISTRIBUTION() external view returns (uint256);

    function shutdownTime() external view returns (uint256);

    function setAddresses(
        address _borrowerOperationsAddress,
        address _activePoolAddress,
        address _defaultPoolAddress,
        address _stabilityPoolAddress,
        address _gasPoolAddress,
        address _collSurplusPoolAddress,
        address _priceFeedAddress,
        address _boldTokenAddress,
        address _sortedTrovesAddress
    ) external;
    function setCollateralRegistry(address _collateralRegistryAddress) external;

    function stabilityPool() external view returns (IStabilityPool);
    function boldToken() external view returns (IBoldToken);
    function sortedTroves() external view returns (ISortedTroves);
    function borrowerOperationsAddress() external view returns (address);

    function Troves(uint256 _id)
        external
        view
        returns (
            uint256 debt,
            uint256 coll,
            uint256 stake,
            Status status,
            uint64 arrayIndex,
            uint64 lastDebtUpdateTime,
            uint64 lastInterestRateAdjTime,
            uint256 annualInterestRate
        );

    function rewardSnapshots(uint256 _id) external view returns (uint256 coll, uint256 boldDebt);

    function getTroveIdsCount() external view returns (uint256);

    function getTroveFromTroveIdsArray(uint256 _index) external view returns (uint256);

    function getCurrentICR(uint256 _troveId, uint256 _price) external view returns (uint256);

    function liquidate(uint256 _troveId) external;

    function batchLiquidateTroves(uint256[] calldata _troveArray) external;

    function redeemCollateral(
        address _sender,
        uint256 _boldAmount,
        uint256 _price,
        uint256 _redemptionRate,
        uint256 _maxIterations
    ) external returns (uint256 _redemeedAmount);

    function shutdown() external;
    function urgentRedemption(uint256 _boldAmount, uint256[] calldata _troveIds, uint256 _minCollateral) external;

    function getPendingCollReward(uint256 _troveId) external view returns (uint256);

    function getPendingBoldDebtReward(uint256 _troveId) external view returns (uint256);

    function hasRedistributionGains(uint256 _troveId) external view returns (bool);

    function getEntireDebtAndColl(uint256 _troveId)
        external
        view
        returns (
            uint256 entireDebt,
            uint256 entireColl,
            uint256 pendingBoldDebtReward,
            uint256 pendingCollReward,
            uint256 accruedTroveInterest
        );

    function getLatestTroveData(uint256 _troveId) external view returns (LatestTroveData memory);

    function getTroveEntireDebt(uint256 _troveId) external view returns (uint256);

    function getTroveEntireColl(uint256 _troveId) external view returns (uint256);

    function getTroveStatus(uint256 _troveId) external view returns (Status);

    function getTroveStake(uint256 _troveId) external view returns (uint256);

    function getTroveDebt(uint256 _troveId) external view returns (uint256);

    function getTroveWeightedRecordedDebt(uint256 _troveId) external returns (uint256);

    function getTroveColl(uint256 _troveId) external view returns (uint256);

    function getTroveAnnualInterestRate(uint256 _troveId) external view returns (uint256);

    function calcTroveAccruedInterest(uint256 _troveId) external view returns (uint256);

    function getTroveLastDebtUpdateTime(uint256 _troveId) external view returns (uint256);

    // -- permissioned functions called by BorrowerOperations

    function onOpenTrove(
        address _owner,
        uint256 _troveId,
        uint256 _coll,
        uint256 _debt,
        uint256 _annualInterestRate,
        uint256 _upfrontFee
    ) external;

    // Called from `adjustUnredeemableTrove()`
    function setTroveStatusToActive(uint256 _troveId) external;

    function onAdjustTroveInterestRate(
        uint256 _troveId,
        uint256 _newColl,
        uint256 _newDebt,
        uint256 _newAnnualInterestRate,
        TroveChange calldata _troveChange
    ) external;

    function onAdjustTrove(uint256 _troveId, uint256 _newColl, uint256 _newDebt, TroveChange calldata _troveChange)
        external;

    function onApplyTroveInterest(
        uint256 _troveId,
        uint256 _newColl,
        uint256 _newDebt,
        TroveChange calldata _troveChange
    ) external;

    function onCloseTrove(uint256 _troveId, TroveChange calldata _troveChange) external;

    // -- end of permissioned functions --

    function getTCR(uint256 _price) external view returns (uint256);

    function checkBelowCriticalThreshold(uint256 _price) external view returns (bool);

    function checkTroveIsOpen(uint256 _troveId) external view returns (bool);

    function checkTroveIsActive(uint256 _troveId) external view returns (bool);

    function getUnbackedPortionPriceAndRedeemability() external returns (uint256, uint256, bool);
    function checkTroveIsUnredeemable(uint256 _troveId) external view returns (bool);
}
