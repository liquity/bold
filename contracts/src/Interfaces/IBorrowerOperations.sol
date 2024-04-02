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

    function openTrove(uint _maxFee, uint256 _ETHAmount, uint _boldAmount, address _upperHint, address _lowerHint, uint256 _annualInterestRate) external;

    function addColl(uint256 _ETHAmount) external;

    function moveETHGainToTrove(address _user, uint256 _ETHAmount) external;

    function withdrawColl(uint _amount) external;

    function withdrawBold(uint _maxFee, uint _amount) external;

    function repayBold(uint _amount) external;

    function closeTrove() external;

    function adjustTrove(uint _maxFee, uint _collChange, bool _isCollIncrease, uint _debtChange, bool isDebtIncrease) external;

    function claimCollateral() external;

    function getCompositeDebt(uint _debt) external pure returns (uint);

    function adjustTroveInterestRate(uint _newAnnualInterestRate, address _upperHint, address _lowerHint) external;
}
