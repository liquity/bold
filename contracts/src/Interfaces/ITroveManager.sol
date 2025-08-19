// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./ILiquityBase.sol";
import "./ITroveNFT.sol";
import "./IBorrowerOperations.sol";
import "./IStabilityPool.sol";
import "./IBoldToken.sol";
import "./ISortedTroves.sol";
import "./IAddressesRegistry.sol";
import "../Types/LatestTroveData.sol";
import "../Types/LatestBatchData.sol";

// Common interface for the Trove Manager.
interface ITroveManager is ILiquityBase {
    enum Status {
        nonExistent,
        active,
        closedByOwner,
        closedByLiquidation,
        zombie
    }

    function shutdownTime() external view returns (uint256);

    function branchId() external view returns (uint256);
    function isActive() external view returns (bool);

    function troveNFT() external view returns (ITroveNFT);
    function stabilityPool() external view returns (IStabilityPool);
    //function boldToken() external view returns (IBoldToken);
    function sortedTroves() external view returns (ISortedTroves);
    function borrowerOperations() external view returns (IBorrowerOperations);

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
            uint256 annualInterestRate,
            address interestBatchManager,
            uint256 batchDebtShares
        );

    function rewardSnapshots(uint256 _id) external view returns (uint256 coll, uint256 boldDebt);

    function addressesRegistry() external view returns (IAddressesRegistry);

    function getTroveIdsCount() external view returns (uint256);

    function getTroveFromTroveIdsArray(uint256 _index) external view returns (uint256);

    function getCurrentICR(uint256 _troveId, uint256 _price) external view returns (uint256);

    function lastZombieTroveId() external view returns (uint256);

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

    function getUnbackedPortionPriceAndRedeemability() external returns (uint256, uint256, bool);

    function getLatestTroveData(uint256 _troveId) external view returns (LatestTroveData memory);
    function getTroveAnnualInterestRate(uint256 _troveId) external view returns (uint256);

    function getTroveStatus(uint256 _troveId) external view returns (Status);

    function getLatestBatchData(address _batchAddress) external view returns (LatestBatchData memory);

    // -- permissioned functions called by BorrowerOperations

    function onOpenTrove(address _owner, uint256 _troveId, TroveChange memory _troveChange, uint256 _annualInterestRate)
        external;
    function onOpenTroveAndJoinBatch(
        address _owner,
        uint256 _troveId,
        TroveChange memory _troveChange,
        address _batchAddress,
        uint256 _batchColl,
        uint256 _batchDebt
    ) external;

    // Called from `adjustZombieTrove()`
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

    function onAdjustTroveInsideBatch(
        uint256 _troveId,
        uint256 _newTroveColl,
        uint256 _newTroveDebt,
        TroveChange memory _troveChange,
        address _batchAddress,
        uint256 _newBatchColl,
        uint256 _newBatchDebt
    ) external;

    function onApplyTroveInterest(
        uint256 _troveId,
        uint256 _newTroveColl,
        uint256 _newTroveDebt,
        address _batchAddress,
        uint256 _newBatchColl,
        uint256 _newBatchDebt,
        TroveChange calldata _troveChange
    ) external;

    function onCloseTrove(
        uint256 _troveId,
        TroveChange memory _troveChange, // decrease vars: entire, with interest, batch fee and redistribution
        address _batchAddress,
        uint256 _newBatchColl,
        uint256 _newBatchDebt // entire, with interest and batch fee
    ) external;

    // -- batches --
    function onRegisterBatchManager(address _batchAddress, uint256 _annualInterestRate, uint256 _annualFee) external;
    function onLowerBatchManagerAnnualFee(
        address _batchAddress,
        uint256 _newColl,
        uint256 _newDebt,
        uint256 _newAnnualManagementFee
    ) external;
    function onSetBatchManagerAnnualInterestRate(
        address _batchAddress,
        uint256 _newColl,
        uint256 _newDebt,
        uint256 _newAnnualInterestRate,
        uint256 _upfrontFee // needed by BatchUpdated event
    ) external;

    struct OnSetInterestBatchManagerParams {
        uint256 troveId;
        uint256 troveColl; // entire, with redistribution
        uint256 troveDebt; // entire, with interest, batch fee and redistribution
        TroveChange troveChange;
        address newBatchAddress;
        uint256 newBatchColl; // updated collateral for new batch manager
        uint256 newBatchDebt; // updated debt for new batch manager
    }

    function onSetInterestBatchManager(OnSetInterestBatchManagerParams calldata _params) external;
    function onRemoveFromBatch(
        uint256 _troveId,
        uint256 _newTroveColl, // entire, with redistribution
        uint256 _newTroveDebt, // entire, with interest, batch fee and redistribution
        TroveChange memory _troveChange,
        address _batchAddress,
        uint256 _newBatchColl,
        uint256 _newBatchDebt, // entire, with interest and batch fee
        uint256 _newAnnualInterestRate
    ) external;

    function setDebtLimit(uint256 _newDebtLimit) external;
    function getDebtLimit() external view returns (uint256);
    function getInitialDebtLimit() external view returns (uint256);

    // -- end of permissioned functions --
}
