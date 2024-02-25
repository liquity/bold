// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "openzeppelin-contracts/contracts/token/ERC721/IERC721.sol";

import "./ILiquityBase.sol";
import "./IStabilityPool.sol";
import "./IBoldToken.sol";
import "./ISortedTroves.sol";

// Common interface for the Trove Manager.
interface ITroveManager is IERC721, ILiquityBase {
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

    function getTroveIdsCount() external view returns (uint);

    function getTroveFromTroveIdsArray(uint _index) external view returns (uint256);

    function getCurrentICR(uint256 _troveId, uint _price) external view returns (uint);

    function liquidate(uint256 _troveId) external;

    function batchLiquidateTroves(uint256[] calldata _troveArray) external;

    function redeemCollateral(
        uint _boldAmount,
        uint _maxIterations,
        uint _maxFee
    ) external;

    function updateStakeAndTotalStakes(uint256 _troveId) external returns (uint);

    function addTroveIdToArray(uint256 _troveId) external returns (uint index);

    function getPendingETHReward(uint256 _troveId) external view returns (uint);

    function getPendingBoldDebtReward(uint256 _troveId) external view returns (uint);

     function hasRedistributionGains(address _borrower) external view returns (bool);

    function getEntireDebtAndColl(uint256 _troveId) external view returns (
        uint entireDebt,
        uint entireColl,
        uint pendingBoldDebtReward,
        uint pendingETHReward,
        uint pendingBoldInterest
    );

    function getAndApplyRedistributionGains(address _borrower) external returns (uint256, uint256);

    function closeTrove(uint256 _troveId, uint256 _weightedRecordedTroveDebt) external;

    function removeStake(uint256 _troveId) external;

    function getRedemptionRate() external view returns (uint);
    function getRedemptionRateWithDecay() external view returns (uint);

    function getRedemptionFeeWithDecay(uint _ETHDrawn) external view returns (uint);

    function getTroveStatus(uint256 _troveId) external view returns (uint);

    function getTroveStake(uint256 _troveId) external view returns (uint);

    function getTroveDebt(uint256 _troveId) external view returns (uint);

    function getTroveWeightedRecordedDebt(address _borrower) external returns (uint256);

    function getTroveColl(uint256 _troveId) external view returns (uint);

    function calcPendingTroveInterest(uint256 _troveId) external view returns (uint256);
    function getTroveAnnualInterestRate(uint256 _troveId) external view returns (uint);

    function calcTroveAccruedInterest(address _borrower) external view returns (uint256);

    function TroveAddManagers(uint256 _troveId) external view returns (address);
    function TroveRemoveManagers(uint256 _troveId) external view returns (address);

    function getTroveLastDebtUpdateTime(uint256 _troveId) external view returns (uint);

    function setTrovePropertiesOnOpen(address _owner, uint256 _troveId, uint256 _coll, uint256 _debt, uint256 _annualInterestRate) external returns (uint256);

    function increaseTroveColl(address _sender, uint256 _troveId, uint _collIncrease) external returns (uint);

    function decreaseTroveColl(address _sender, uint256 _troveId, uint _collDecrease) external returns (uint);

    function increaseTroveDebt(address _sender, uint256 _troveId, uint _debtIncrease) external returns (uint);

    function decreaseTroveDebt(address _sender, uint256 _troveId, uint _collDecrease) external returns (uint);

    function changeAnnualInterestRate(uint256 _troveId, uint256 _newAnnualInterestRate) external;

    function updateTroveDebtAndInterest(uint256 _troveId, uint256 _entireTroveDebt, uint256 _newAnnualInterestRate) external;

    function updateTroveDebt(uint256 _troveId, uint256 _entireTroveDebt) external;

    function setAddManager(address _sender, uint256 _troveId, address _manager) external;
    function setRemoveManager(address _sender, uint256 _troveId, address _manager) external;

    function getTCR(uint _price) external view returns (uint);

    function checkRecoveryMode(uint _price) external view returns (bool);

    function checkTroveIsActive(uint256 _troveId) external view returns (bool);
}
