// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IERC20Metadata} from "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";

interface ICurveStableSwapNG is IERC20Metadata {
    function add_liquidity(uint256[] memory amounts, uint256 min_mint_amount) external returns (uint256);
    function exchange(int128 i, int128 j, uint256 dx, uint256 min_dy) external returns (uint256 output);
    function get_dx(int128 i, int128 j, uint256 dy) external view returns (uint256 dx);
    function get_dy(int128 i, int128 j, uint256 dx) external view returns (uint256 dy);
    function coins(uint256 i) external view returns (address);
}
