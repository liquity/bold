// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

import "./Dependencies/Ownable.sol";

import "./Interfaces/IInterestRouter.sol";

contract MockInterestRouter is IInterestRouter, Ownable {
    using SafeERC20 for IERC20;

    address private constant _OWNER = 0x318d0059efE546b5687FA6744aF4339391153981;

    constructor() Ownable(_OWNER) {}

    function sweep(address _token, address _to) external onlyOwner {
        uint256 _balance = IERC20(_token).balanceOf(address(this));
        require(_balance > 0, "!BALANCE");
        IERC20(_token).safeTransfer(_to, _balance);
    }
}
