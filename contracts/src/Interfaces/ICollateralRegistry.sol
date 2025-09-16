// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "./IBoldToken.sol";
import "./ITroveManager.sol";

interface ICollateralRegistry {

    event CollateralAdded(uint256 _branchId, address _token, address _troveManager);
    event CollateralRemoved(uint256 _branchId, address _token, address _troveManager);
    event CollateralDeletedForever(uint256 _branchId);

    function allTroveManagerAddresses(uint256 _branchId) external view returns (ITroveManager);
    function isActiveCollateral(uint256 _branchId) external view returns (bool);
    function addCollateral(IERC20Metadata _token, ITroveManager _troveManager) external;
    function removeCollateral(uint256 _index) external;
    function cleanRemovedCollaterals(uint256 _index) external;

    function baseRate() external view returns (uint256);
    function lastFeeOperationTime() external view returns (uint256);

    function redeemCollateral(uint256 _boldamount, uint256 _maxIterations, uint256 _maxFeePercentage) external;
    // getters
    function totalCollaterals() external view returns (uint256);
    function getToken(uint256 _index) external view returns (IERC20Metadata);
    function getTroveManager(uint256 _index) external view returns (ITroveManager);
    function boldToken() external view returns (IBoldToken);

    function getRedemptionRate() external view returns (uint256);
    function getRedemptionRateWithDecay() external view returns (uint256);
    function getRedemptionRateForRedeemedAmount(uint256 _redeemAmount) external view returns (uint256);

    function getRedemptionFeeWithDecay(uint256 _ETHDrawn) external view returns (uint256);
    function getEffectiveRedemptionFeeInBold(uint256 _redeemAmount) external view returns (uint256);

    function updateDebtLimit(uint256 _indexTroveManager, uint256 _newDebtLimit) external;
    function getDebtLimit(uint256 _indexTroveManager) external view returns (uint256); 

    function updateCCR(uint256 _collIndex, uint256 _newCCR) external;
    function updateMCR(uint256 _collIndex, uint256 _newMCR) external;
    function updateBCR(uint256 _collIndex, uint256 _newBCR) external;
    function updateSCR(uint256 _collIndex, uint256 _newSCR) external;

    function governor() external view returns (address);
}
