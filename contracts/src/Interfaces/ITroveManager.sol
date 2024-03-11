// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "./ILiquityBase.sol";
import "./IStabilityPool.sol";
import "./IBoldToken.sol";
import "./ISortedTroves.sol";

// Common interface for the Trove Manager.
interface ITroveManager is ILiquityBase {
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

    function stabilityPool() external view returns (IStabilityPool);
    function boldToken() external view returns (IBoldToken);
    function sortedTroves() external view returns(ISortedTroves);
    function borrowerOperationsAddress() external view returns (address);

    function BOOTSTRAP_PERIOD() external view returns (uint256);
    
    function getTroveOwnersCount() external view returns (uint);

    function getTroveFromTroveOwnersArray(uint _index) external view returns (address);

    function getNominalICR(uint256 _troveId) external view returns (uint);
    function getCurrentICR(uint256 _troveId, uint _price) external view returns (uint);

    function liquidate(uint256 _troveId) external;

    function batchLiquidateTroves(uint256[] calldata _troveArray) external;

    function redeemCollateral(
        uint _boldAmount,
        address _firstRedemptionHint,
        address _upperPartialRedemptionHint,
        address _lowerPartialRedemptionHint,
        uint _partialRedemptionHintNICR,
        uint _maxIterations,
        uint _maxFee
    ) external; 

    function updateStakeAndTotalStakes(uint256 _troveId) external returns (uint);

    function addTroveOwnerToArray(uint256 _troveId) external returns (uint index);

    function applyPendingRewards(uint256 _troveId) external;

    function appyInterestToTroves(uint256[] calldata _troveIds) external;

    function getPendingETHReward(uint256 _troveId) external view returns (uint);

    function getPendingBoldDebtReward(uint256 _troveId) external view returns (uint);

     function hasPendingRewards(uint256 _troveId) external view returns (bool);

    function getEntireDebtAndColl(uint256 _troveId) external view returns (
        uint debt, 
        uint coll, 
        uint pendingBoldDebtReward, 
        uint pendingETHReward
    );

    function closeTrove(uint256 _troveId) external;

    function removeStake(uint256 _troveId) external;

    function getRedemptionRate() external view returns (uint);
    function getRedemptionRateWithDecay() external view returns (uint);

    function getRedemptionFeeWithDecay(uint _ETHDrawn) external view returns (uint);

    function getTroveStatus(uint256 _troveId) external view returns (uint);
    
    function getTroveStake(uint256 _troveId) external view returns (uint);

    function getTroveDebt(uint256 _troveId) external view returns (uint);

    function getTroveColl(uint256 _troveId) external view returns (uint);

    function getTroveAnnualInterestRate(uint256 _troveId) external view returns (uint);

    function setTrovePropertiesOnOpen(uint256 _troveId, uint256 _coll, uint256 _debt, uint256 _annualInterestRate) external returns (uint256);

    function increaseTroveColl(uint256 _troveId, uint _collIncrease) external returns (uint);

    function decreaseTroveColl(uint256 _troveId, uint _collDecrease) external returns (uint);

    function increaseTroveDebt(uint256 _troveId, uint _debtIncrease) external returns (uint);

    function decreaseTroveDebt(uint256 _troveId, uint _collDecrease) external returns (uint);

    function changeAnnualInterestRate(uint256 _troveId, uint256 _newAnnualInterestRate) external;

    function getTCR(uint _price) external view returns (uint);

    function checkRecoveryMode(uint _price) external view returns (bool);
}
