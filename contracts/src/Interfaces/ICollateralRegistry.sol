pragma solidity 0.8.18;

import "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "./ITroveManager.sol";

interface ICollateralRegistry {
    function baseRate() external view returns (uint256);

    function redeemCollateral(uint256 _boldamount, uint256 _maxIterations, uint256 _maxFeePercentage) external;
    // getters
    function totalCollaterals() external view returns (uint256);
    function getToken(uint256 _index) external view returns (IERC20);
    function getTroveManager(uint256 _index) external view returns (ITroveManager);

    function getRedemptionRate() external view returns (uint256);
    function getRedemptionRateWithDecay() external view returns (uint256);

    function getRedemptionFeeWithDecay(uint256 _ETHDrawn) external view returns (uint256);
    function getEffectiveRedemptionFee(uint256 _redeemAmount, uint256 _price) external view returns (uint256);
    function getEffectiveRedemptionFeeInBold(uint256 _redeemAmount) external view returns (uint256);
}
