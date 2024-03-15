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

    // function BOLD_GAS_COMPENSATION() external view returns (uint256);
    
    function getTroveOwnersCount() external view returns (uint);

    function getTroveFromTroveOwnersArray(uint _index) external view returns (address);

    function getNominalICR(address _borrower) external view returns (uint);
    function getCurrentICR(address _borrower, uint _price) external view returns (uint);

    function liquidate(address _borrower) external;

    function batchLiquidateTroves(address[] calldata _troveArray) external;

    function redeemCollateral(
        uint _boldAmount,
        address _firstRedemptionHint,
        address _upperPartialRedemptionHint,
        address _lowerPartialRedemptionHint,
        uint _partialRedemptionHintNICR,
        uint _maxIterations,
        uint _maxFee
    ) external; 

    function updateStakeAndTotalStakes(address _borrower) external returns (uint);

    function addTroveOwnerToArray(address _borrower) external returns (uint index);

    function getPendingETHReward(address _borrower) external view returns (uint);

    function getPendingBoldDebtReward(address _borrower) external view returns (uint);

     function hasRedistributionGains(address _borrower) external view returns (bool);

    function getEntireDebtAndColl(address _borrower) external view returns (
        uint entireDebt, 
        uint entireColl, 
        uint pendingBoldDebtReward, 
        uint pendingETHReward,
        uint pendingBoldInterest
    );

    function getTroveEntireDebt(address _borrower) external view returns (uint256);

    function getTroveEntireColl(address _borrower) external view returns (uint256);

    function getAndApplyRedistributionGains(address _borrower) external returns (uint256, uint256);

    function closeTrove(address _borrower) external;

    function removeStake(address _borrower) external;

    function getRedemptionRate() external view returns (uint);
    function getRedemptionRateWithDecay() external view returns (uint);

    function getRedemptionFeeWithDecay(uint _ETHDrawn) external view returns (uint);

    function getTroveStatus(address _borrower) external view returns (uint);
    
    function getTroveStake(address _borrower) external view returns (uint);

    function getTroveDebt(address _borrower) external view returns (uint);

    function getTroveWeightedRecordedDebt(address _borrower) external returns (uint256);

    function getTroveColl(address _borrower) external view returns (uint);

    function calcTroveAccruedInterest(address _borrower) external view returns (uint256);

    function getTroveAnnualInterestRate(address _borrower) external view returns (uint);

    function getTroveLastDebtUpdateTime(address _borrower) external view returns (uint);

    function troveIsStale(address _borrower) external view returns (bool);

    function setTrovePropertiesOnOpen(address _borrower, uint256 _coll, uint256 _debt, uint256 _annualInterestRate) external returns (uint256);

    function increaseTroveColl(address _borrower, uint _collIncrease) external returns (uint);

    function decreaseTroveColl(address _borrower, uint _collDecrease) external returns (uint); 

    function increaseTroveDebt(address _borrower, uint _debtIncrease) external returns (uint); 

    function decreaseTroveDebt(address _borrower, uint _collDecrease) external returns (uint); 

    function updateTroveDebtAndInterest(address _borrower, uint256 _entireTroveDebt, uint256 _newAnnualInterestRate) external;

    function updateTroveDebt(address _borrower, uint256 _entireTroveDebt) external;

    function getTCR(uint _price) external view returns (uint);

    function checkRecoveryMode(uint _price) external view returns (bool);
}
