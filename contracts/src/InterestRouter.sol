// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

import "./Dependencies/Ownable.sol";

import "./Interfaces/IInterestRouter.sol";

contract InterestRouter is IInterestRouter, Ownable {
    using SafeERC20 for IERC20;

    event Swept(address indexed token, address indexed to, uint256 amount);

    address private constant _OWNER = 0xce352181C0f0350F1687e1a44c45BC9D96ee738B;

    constructor() Ownable(_OWNER) {}

    function sweep(address _token, address _to) external onlyOwner {
        uint256 _balance = IERC20(_token).balanceOf(address(this));
        require(_balance > 0, "!BALANCE");
        IERC20(_token).safeTransfer(_to, _balance);
        emit Swept(_token, _to, _balance);
    }
}