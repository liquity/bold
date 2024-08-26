// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface ICurvePool {
    function add_liquidity(uint256[2] memory coins, uint256 min_mint_amount) external returns (uint256);
    //function exchange(uint256 i, uint256 j, uint256 dx, uint256 min_dy, bool use_eth, address receiver) external returns (uint256 output);
    function exchange(uint256 i, uint256 j, uint256 dx, uint256 min_dy) external returns (uint256 output);
    function get_dy(uint256 i, uint256 j, uint256 dx) external view returns (uint256 dy);
}
