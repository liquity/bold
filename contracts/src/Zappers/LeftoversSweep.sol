// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

import "../Interfaces/IBoldToken.sol";

contract LeftoversSweep {
    struct InitialBalances {
        uint256 boldBalance;
        uint256 collBalance;
        address receiver;
    }

    function _setInitialBalances(IERC20 _collToken, IBoldToken _boldToken, InitialBalances memory _initialBalances)
        internal
        view
    {
        _setInitialBalancesAndReceiver(_collToken, _boldToken, _initialBalances, msg.sender);
    }

    function _setInitialBalancesAndReceiver(IERC20 _collToken, IBoldToken _boldToken, InitialBalances memory _initialBalances, address _receiver)
        internal
        view
    {
        _initialBalances.boldBalance = _boldToken.balanceOf(address(this));
        _initialBalances.collBalance = _collToken.balanceOf(address(this));
        _initialBalances.receiver = _receiver;
    }

    function _returnLeftovers(IERC20 _collToken, IBoldToken _boldToken, InitialBalances memory _initialBalances)
        internal
    {
        uint256 currentCollBalance = _collToken.balanceOf(address(this));
        if (currentCollBalance > _initialBalances.collBalance) {
            _collToken.transfer(_initialBalances.receiver, currentCollBalance - _initialBalances.collBalance);
        }
        uint256 currentBoldBalance = _boldToken.balanceOf(address(this));
        if (currentBoldBalance > _initialBalances.boldBalance) {
            _boldToken.transfer(_initialBalances.receiver, currentBoldBalance - _initialBalances.boldBalance);
        }
    }
}
