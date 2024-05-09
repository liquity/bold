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
        uint256 _annualInterestRate
    ) external returns (uint256);

    function addColl(uint256 _troveId, uint256 _ETHAmount) external;

    function withdrawColl(uint256 _troveId, uint256 _amount) external;

    function withdrawBold(uint256 _troveId, uint256 _amount) external;

    function repayBold(uint256 _troveId, uint256 _amount) external;

    function closeTrove(uint256 _troveId) external;

    function adjustTrove(
        uint256 _troveId,
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _debtChange,
        bool isDebtIncrease
    ) external;

    function adjustUnredeemableTrove(
        uint256 _troveId,
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _boldChange,
        bool _isDebtIncrease,
        uint256 _upperHint,
        uint256 _lowerHint
    ) external;

    function claimCollateral() external;

    function setAddManager(uint256 _troveId, address _manager) external;
    function setRemoveManager(uint256 _troveId, address _manager) external;

    // TODO: addRepayWhitelistedAddress?(see github issue #64)

    function getCompositeDebt(uint256 _debt) external pure returns (uint256);

    function adjustTroveInterestRate(
        uint256 _troveId,
        uint256 _newAnnualInterestRate,
        uint256 _upperHint,
        uint256 _lowerHint
    ) external;

    function applyTroveInterestPermissionless(uint256 _troveId) external;
}
