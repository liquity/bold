// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

import "../Interfaces/IBoldToken.sol";

contract LeftoversSweep {
    struct InitialBalances {
        uint256 boldBalance;
        uint256 collBalance;
        address sender;
    }

    function _setInitialBalances(IERC20 _collToken, IBoldToken _boldToken, InitialBalances memory initialBalances)
        internal
        view
    {
        initialBalances.boldBalance = _boldToken.balanceOf(address(this));
        initialBalances.collBalance = _collToken.balanceOf(address(this));
        initialBalances.sender = msg.sender;
    }

    function _returnLeftovers(IERC20 _collToken, IBoldToken _boldToken, InitialBalances memory initialBalances)
        internal
    {
        uint256 currentCollBalance = _collToken.balanceOf(address(this));
        if (currentCollBalance > initialBalances.collBalance) {
            _collToken.transfer(initialBalances.sender, currentCollBalance - initialBalances.collBalance);
        }
        uint256 currentBoldBalance = _boldToken.balanceOf(address(this));
        if (currentBoldBalance > initialBalances.boldBalance) {
            _boldToken.transfer(initialBalances.sender, currentBoldBalance - initialBalances.boldBalance);
        }
    }
}
