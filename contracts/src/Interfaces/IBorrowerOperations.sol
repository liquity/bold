// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "./ILiquityBase.sol";
import "./IAddRemoveManagers.sol";
import "./IPriceFeed.sol";
import "./ISortedTroves.sol";
import "./IWETH.sol";

// Common interface for the Borrower Operations.
interface IBorrowerOperations is ILiquityBase, IAddRemoveManagers {
    function sortedTroves() external view returns (ISortedTroves);
    function collToken() external view returns (IERC20);
    function boldToken() external view returns (IBoldToken);
    function WETH() external view returns (IWETH);

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
        uint256 _annualInterestRate,
        uint256 _maxUpfrontFee
    ) external returns (uint256);

    function addColl(uint256 _troveId, uint256 _ETHAmount) external;

    function withdrawColl(uint256 _troveId, uint256 _amount) external;

    function withdrawBold(uint256 _troveId, uint256 _amount, uint256 _maxUpfrontFee) external;

    function repayBold(uint256 _troveId, uint256 _amount) external;

    function closeTrove(uint256 _troveId) external returns (uint256);

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
    function shutdownFromOracleFailure(address _failedOracleAddr) external;

    function adjustTroveInterestRate(
        uint256 _troveId,
        uint256 _newAnnualInterestRate,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _maxUpfrontFee
    ) external;

    function applyTroveInterestPermissionless(uint256 _troveId) external;
}
