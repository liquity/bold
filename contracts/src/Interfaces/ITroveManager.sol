// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "openzeppelin-contracts/contracts/token/ERC721/IERC721.sol";

import "./ILiquityBase.sol";
import "./IStabilityPool.sol";
import "./IBoldToken.sol";
import "./ISortedTroves.sol";

// Common interface for the Trove Manager.
interface ITroveManager is IERC721, ILiquityBase {
    struct LatestTroveData {
        uint256 entireDebt;
        uint256 entireColl;
        uint256 redistBoldDebtGain;
        uint256 redistETHGain;
        uint256 accruedInterest;
        uint256 recordedDebt;
        uint256 annualInterestRate;
        uint256 weightedRecordedDebt;
        uint256 recordedUpfrontInterest;
        uint256 unusedUpfrontInterest;
    }

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

    // function BOLD_GAS_COMPENSATION() external view returns (uint256);

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

    function updateStakeAndTotalStakes(uint256 _troveId) external returns (uint256);

    function getPendingETHReward(uint256 _troveId) external view returns (uint256);

    function getPendingBoldDebtReward(uint256 _troveId) external view returns (uint256);

    function hasRedistributionGains(uint256 _troveId) external view returns (bool);

    function getEntireDebtAndColl(uint256 _troveId)
        external
        view
        returns (
            uint256 entireDebt,
            uint256 entireColl,
            uint256 pendingBoldDebtReward,
            uint256 pendingETHReward,
            uint256 accruedTroveInterest
        );

    function getLatestTroveData(uint256 _troveId) external view returns (LatestTroveData memory);

    function getTroveEntireDebt(uint256 _troveId) external view returns (uint256);

    function getTroveEntireColl(uint256 _troveId) external view returns (uint256);

    function getNewRecordedDebt(uint256 _troveId) external view returns (uint256);

    function getRedeemableDebt(uint256 _troveId) external view returns (uint256);

    function getUnusedUpfrontInterest(uint256 _troveId) external view returns (uint256);

    function applyRedistributionGains(uint256 _troveId, uint256 _redistBoldDebtGain, uint256 _redistETHGain) external;

    function closeTrove(uint256 _troveId) external;

    function removeStake(uint256 _troveId) external;

    function getTroveStatus(uint256 _troveId) external view returns (uint256);

    function getTroveStake(uint256 _troveId) external view returns (uint256);

    function getTroveDebt(uint256 _troveId) external view returns (uint256);

    function getTroveWeightedRecordedDebt(uint256 _troveId) external returns (uint256);

    function getTroveColl(uint256 _troveId) external view returns (uint256);

    function getTroveAnnualInterestRate(uint256 _troveId) external view returns (uint256);

    function calcTroveAccruedInterest(uint256 _troveId) external view returns (uint256);

    function TroveAddManagers(uint256 _troveId) external view returns (address);
    function TroveRemoveManagers(uint256 _troveId) external view returns (address);

    function getTroveLastDebtUpdateTime(uint256 _troveId) external view returns (uint256);

    function setTrovePropertiesOnOpen(
        address _owner,
        uint256 _troveId,
        uint256 _coll,
        uint256 _debt,
        uint256 _upfrontInterest,
        uint256 _annualInterestRate
    ) external returns (uint256 arrayIndex);

    function setTroveStatusToActive(uint256 _troveId) external;

    function setTrovePropertiesOnInterestRateAdjustment(
        uint256 _troveId,
        uint256 _coll,
        uint256 _debt,
        uint256 _upfrontInterest,
        uint256 _annualInterestRate
    ) external;

    function setTrovePropertiesOnInterestApplication(
        uint256 _troveId,
        uint256 _coll,
        uint256 _debt,
        uint256 _upfrontInterest
    ) external;

    function setTrovePropertiesOnAdjustment(
        address _sender,
        uint256 _troveId,
        uint256 _coll,
        uint256 _debt,
        uint256 _upfrontInterest,
        bool _isCollIncrease,
        bool _isCollDecrease,
        bool _isDebtIncrease,
        bool _isDebtDecrease
    ) external;

    function troveIsStale(uint256 _troveId) external view returns (bool);

    function setAddManager(address _sender, uint256 _troveId, address _manager) external;
    function setRemoveManager(address _sender, uint256 _troveId, address _manager) external;

    function getTCR(uint256 _price) external view returns (uint256);

    function checkBelowCriticalThreshold(uint256 _price) external view returns (bool);

    function checkTroveIsOpen(uint256 _troveId) external view returns (bool);

    function checkTroveIsActive(uint256 _troveId) external view returns (bool);

    function getUnbackedPortionPriceAndRedeemability() external returns (uint256, uint256, bool);
    function checkTroveIsUnredeemable(uint256 _troveId) external view returns (bool);
}
