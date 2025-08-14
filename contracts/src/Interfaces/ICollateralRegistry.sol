// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "./IBoldToken.sol";
import "./ITroveManager.sol";

interface ICollateralRegistry {

    event CollateralAdded(address _token, address _troveManager, uint256 _index);
    event CollateralRemoved(uint256 _index, address _token, address _troveManager);

    function addCollateral(IERC20Metadata _token, ITroveManager _troveManager, uint256 _index) external;
    function removeCollateral(uint256 _index) external;

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
}
