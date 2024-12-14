// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "src/Interfaces/IWSTETH.sol";

contract WSTETHTokenMock is IWSTETH {
    function stEthPerToken() external pure returns (uint256) {
        return 0;
    }

    function wrap(uint256 _stETHAmount) external pure returns (uint256) {
        return _stETHAmount;
    }

    function unwrap(uint256 _wstETHAmount) external pure returns (uint256) {
        return _wstETHAmount;
    }

    function getWstETHByStETH(uint256 _stETHAmount) external pure returns (uint256) {
        return _stETHAmount;
    }

    function getStETHByWstETH(uint256 _wstETHAmount) external pure returns (uint256) {
        return _wstETHAmount;
    }

    function tokensPerStEth() external pure returns (uint256) {
        return 0;
    }
}
