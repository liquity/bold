pragma solidity 0.8.18;

import "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "./ITroveManager.sol";

interface ICollateralRegistry {
    function REDEMPTION_FAILURE_PENALTY() external view returns (uint256);
    function baseRate() external view returns (uint256);
    function boldRedemptionCommitments() external view returns (uint256);

    function commitRedemption(uint256 _redemptionId, uint256 _boldAmount, uint64 _maxIterationsPerCollateral, uint64 _maxFeePercentage) external;
    function executeRedemption(uint256 _redemptionId) external;
    function withdrawRedemption(uint256 _redemptionId) external;
    // getters
    function totalCollaterals() external view returns (uint256);
    function getToken(uint256 _index) external view returns (IERC20);
    function getTroveManager(uint256 _index) external view returns (ITroveManager);

    function getRedemptionRate() external view returns (uint256);
    function getRedemptionRateWithDecay() external view returns (uint256);

    function getRedemptionFeeWithDecay(uint256 _ETHDrawn) external view returns (uint256);
    function getEffectiveRedemptionFeeInBold(uint256 _redeemAmount, uint256 _extraSeconds) external view returns (uint256);
}
