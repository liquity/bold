// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "./IActivePool.sol";
import "./IDefaultPool.sol";
import "./IPriceFeed.sol";

interface ILiquityBase {
    function activePool() external view returns (IActivePool);
    function defaultPool() external view returns (IDefaultPool);
    function priceFeed() external view returns (IPriceFeed);
    function BOLD_GAS_COMPENSATION() external view returns (uint256);
    function MIN_NET_DEBT() external view returns (uint256);
    function MIN_DEBT() external view returns (uint256);
    function UPFRONT_INTEREST_PERIOD() external view returns (uint256);
    function INTEREST_RATE_ADJ_COOLDOWN() external view returns (uint256);
    function STALE_TROVE_DURATION() external view returns (uint256);
    function getEntireSystemDebt() external view returns (uint256);
}
