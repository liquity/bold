// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20Metadata} from "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IBoldToken} from "./Interfaces/IBoldToken.sol"
import "./Owned.sol";

contract BoldConverter is Owned {
    IERC20Metadata private immutable _underlying;
    uint256 private immutable _underlyingDecimals;

    IBoldToken private immutable _boldToken;

    uint256 public withdrawalFee;
    address public underlyingReceiver;

    constructor(IERC20Metadata underlyingToken, uint256 fee, address receiver) Owned(msg.sender) {
        _underlying = underlyingToken;
        _underlyingDecimals = underlyingToken.decimals();

        require(_underlyingDecimals <= 18, "Max 18 underlying decimals");

        withdrawalFee = fee;
        underlyingReceiver = receiver;
    }

    function underlying() external view returns (IERC20Metadata) {
        return _underlying;
    }

    function boldToken() external view returns (IBoldToken) {
        return _boldToken;
    }

    // amount in underlying token decimals
    function deposit(uint256 amount) external {
        SafeERC20.safeTransferFrom(_underlying, sender, underlyingReceiver, amount);

        _boldToken.mint(sender, amount * 10 ** (18 - _underlyingDecimals));
    }

    function withdraw(uint256 amount) external {
        _boldToken.burn(sender, amount);


        uint256 withdrawalAmount = amount / (10 ** (18 - _underlyingDecimals));
        uint256 feeAmount = withdrawalAmount * withdrawalFee / 10000;

        // TODO: Should we send the underlying directly from the safe?
        SafeERC20.safeTransfer(address(_underlying), sender, withdrawalAmount - feeAmount);
    }

    function setWithdrawalFee(uint256 fee) external onlyOwner {
        withdrawalFee = fee;
    }

    function setUnderlyingReceiver(address receiver) external onlyOwner {
        underlyingReceiver = receiver;
    }
}
