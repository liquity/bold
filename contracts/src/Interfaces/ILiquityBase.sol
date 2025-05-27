// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./IActivePool.sol";
import "./IDefaultPool.sol";
import "./IPriceFeed.sol";

interface ILiquityBase {
    function activePool() external view returns (IActivePool);
    function getEntireBranchDebt() external view returns (uint256);
    function getEntireBranchColl() external view returns (uint256);
}
