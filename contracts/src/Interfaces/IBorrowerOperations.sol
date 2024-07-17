// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "./ILiquityBase.sol";
import "./ITroveManager.sol";
import "./IPriceFeed.sol";
import "./ISortedTroves.sol";

// Common interface for the Trove Manager.
interface IBorrowerOperations is ILiquityBase {
    function MCR() external view returns (uint256);
    function SCR() external view returns (uint256);
    function troveManager() external view returns (ITroveManager);
    function sortedTroves() external view returns (ISortedTroves);

    function setAddresses(
        address _troveManagerAddress,
        address _activePoolAddress,
        address _defaultPoolAddress,
        address _gasPoolAddress,
        address _collSurplusPoolAddress,
        address _priceFeedAddress,
        address _sortedTrovesAddress,
        address _boldTokenAddress
    ) external;

    function openTrove(
        address _owner,
        uint256 _ownerIndex,
        uint256 _ETHAmount,
        uint256 _boldAmount,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _annualInterestRate,
        uint256 _maxUpfrontFee
    ) external returns (uint256);

    function openTroveAndJoinInterestBatchManager(
        address _owner,
        uint256 _ownerIndex,
        uint256 _ETHAmount,
        uint256 _boldAmount,
        uint256 _upperHint,
        uint256 _lowerHint,
        address _interestBatchManager,
        uint256 _maxUpfrontFee
    ) external returns (uint256);

    function addColl(uint256 _troveId, uint256 _ETHAmount) external;

    function withdrawColl(uint256 _troveId, uint256 _amount) external;

    function withdrawBold(uint256 _troveId, uint256 _amount, uint256 _maxUpfrontFee) external;

    function repayBold(uint256 _troveId, uint256 _amount) external;

    function closeTrove(uint256 _troveId) external;

    function adjustTrove(
        uint256 _troveId,
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _debtChange,
        bool isDebtIncrease,
        uint256 _maxUpfrontFee
    ) external;

    function adjustUnredeemableTrove(
        uint256 _troveId,
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _boldChange,
        bool _isDebtIncrease,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _maxUpfrontFee
    ) external;

    function claimCollateral() external;

    function hasBeenShutDown() external view returns (bool);
    function shutdown() external;

    function setAddManager(uint256 _troveId, address _manager) external;
    function setRemoveManager(uint256 _troveId, address _manager) external;
    function addManagerOf(uint256 _troveId) external view returns (address);
    function removeManagerOf(uint256 _troveId) external view returns (address);

    function checkBatchManagerExists(address _batchMananger) external view returns (bool);

    // -- individual delegation --
    struct InterestIndividualDelegate {
        address account;
        uint128 minInterestRate; // TODO: If we change decimal precision for interest across all codebase, we can switch to uint48 and save 1 storage slot
        uint128 maxInterestRate;
    }

    function getInterestIndividualDelegateOf(uint256 _troveId)
        external
        view
        returns (InterestIndividualDelegate memory);
    function setInterestIndividualDelegate(
        uint256 _troveId,
        address _delegate,
        uint128 _minInterestRate,
        uint128 _maxInterestRate,
        // only needed if trove was previously in a batch:
        uint256 _newAnnualInterestRate,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _maxUpfrontFee
    ) external;
    function removeInterestIndividualDelegate(uint256 _troveId) external;

    // -- batches --
    struct InterestBatchManager {
        uint128 minInterestRate;
        uint128 maxInterestRate;
        uint256 minInterestRateChangePeriod;
    }

    function registerBatchManager(
        uint128 minInterestRate,
        uint128 maxInterestRate,
        uint128 currentInterestRate,
        uint128 fee,
        uint128 minInterestRateChangePeriod
    ) external;
    function lowerBatchManagementFee(uint256 _newAnnualFee) external;
    function setBatchManagerAnnualInterestRate(
        uint128 _newAnnualInterestRate,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _maxUpfrontFee
    ) external;
    function interestBatchManagerOf(uint256 _troveId) external view returns (address);
    function getInterestBatchManager(address _account) external view returns (InterestBatchManager memory);
    function setInterestBatchManager(
        uint256 _troveId,
        address _newBatchManager,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _maxUpfrontFee
    ) external;
    function removeFromBatch(
        uint256 _troveId,
        uint256 _newAnnualInterestRate,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _maxUpfrontFee
    ) external;
    function applyBatchInterestAndFeePermissionless(address _batchAddress) external;
    function adjustTroveInterestRate(
        uint256 _troveId,
        uint256 _newAnnualInterestRate,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _maxUpfrontFee
    ) external;

    function applyTroveInterestPermissionless(uint256 _troveId) external;
}
