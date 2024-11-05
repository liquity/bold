// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "../../Interfaces/IWSTETH.sol";

contract WSTETHTokenMock is IWSTETH{

    function stEthPerToken() external view returns (uint256) {return 0;}
    function wrap(uint256 _stETHAmount) external returns (uint256) {return 0;}
    function unwrap(uint256 _wstETHAmount) external returns (uint256)  {return 0;}
    function getWstETHByStETH(uint256 _stETHAmount) external view returns (uint256) {return 0;}
    function getStETHByWstETH(uint256 _wstETHAmount) external view returns (uint256) {return 0;}
    function tokensPerStEth() external view returns (uint256) {return 0;}
}