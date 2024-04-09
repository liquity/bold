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

    function openTrove(address _owner, uint256 _ownerIndex, uint _maxFee, uint256 _ETHAmount, uint _boldAmount, uint256 _upperHint, uint256 _lowerHint, uint256 _annualInterestRate) external returns (uint256);

    function addColl(uint256 _troveId, uint256 _ETHAmount) external;

    function moveETHGainToTrove(address _sender, uint256 _troveId, uint256 _ETHAmount) external;

    function withdrawColl(uint256 _troveId, uint _amount) external;

    function withdrawBold(uint256 _troveId, uint _maxFee, uint _amount) external;

    function repayBold(uint256 _troveId, uint _amount) external;

    function closeTrove(uint256 _troveId) external;

    function adjustTrove(uint256 _troveId, uint _maxFee, uint _collChange, bool _isCollIncrease, uint _debtChange, bool isDebtIncrease) external;

    function claimCollateral(uint256 _troveId) external;

    function setAddManager(uint256 _troveId, address _manager) external;
    function setRemoveManager(uint256 _troveId, address _manager) external;

    // TODO: addRepayWhitelistedAddress?(see github issue #64)

    function getCompositeDebt(uint _debt) external pure returns (uint);

    function adjustTroveInterestRate(uint256 _troveId, uint _newAnnualInterestRate, uint256 _upperHint, uint256 _lowerHint) external;

    function applyTroveInterestPermissionless(uint256 _troveId) external;
}
