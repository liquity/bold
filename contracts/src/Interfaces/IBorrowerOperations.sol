// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "./ILiquityBase.sol";
import "./ITroveManager.sol";
import "./IPriceFeed.sol";
import "./ISortedTroves.sol";

// Common interface for the Trove Manager.
interface IBorrowerOperations is ILiquityBase {
    function troveManager() external view returns (ITroveManager);
    function sortedTroves() external view returns (ISortedTroves);

    function setAddresses(
        address _troveManagerAddress,
        address _activePoolAddress,
        address _defaultPoolAddress,
        address _stabilityPoolAddress,
        address _gasPoolAddress,
        address _collSurplusPoolAddress,
        address _priceFeedAddress,
        address _sortedTrovesAddress,
        address _boldTokenAddress
    ) external;

    function openTrove(uint _maxFee, uint _boldAmount, address _upperHint, address _lowerHint, uint256 _annualInterestRate) external payable;

    function addColl() external payable;

    function moveETHGainToTrove(address _user) external payable;

    function withdrawColl(uint _amount) external;

    function withdrawBold(uint _maxFee, uint _amount) external;

    function repayBold(uint _amount) external;

    function closeTrove() external;

    function adjustTrove(uint _maxFee, uint _collWithdrawal, uint _debtChange, bool isDebtIncrease) external payable;

    function claimCollateral() external;

    function getCompositeDebt(uint _debt) external pure returns (uint);

    function adjustTroveInterestRate(uint _newAnnualInterestRate, address _upperHint, address _lowerHint) external;
}
