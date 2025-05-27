// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import "./Owned.sol";

// token wrapper with decimal scaling
contract MultiTokenWrapper is ERC20, Owned {
    mapping(address => bool) public isUnderlying;
    mapping(address => uint256) public underlyingDecimals;

    event UnderlyingAdded(address indexed underlying);
    event UnderlyingRemoved(address indexed underlying);

    constructor()
        ERC20(
            string(abi.encodePacked("BitVault BTC")),
            string(abi.encodePacked("bvBTC"))
        )
        Owned(msg.sender)
    {}

    // amount in underlying token decimals
    function deposit(uint256 amount, address underlying) external onlyOwner {
        require(msg.sender != address(this), "Wrapper can't deposit");
        require(isUnderlying[underlying], "Underlying not supported");

        SafeERC20.safeTransferFrom(
            IERC20(underlying),
            msg.sender,
            address(this),
            amount
        );

        _mint(msg.sender, amount * 10 ** (18 - underlyingDecimals[underlying]));
    }

    // amount in wrapped token decimals (18)
    function withdraw(uint256 amount, address underlying) external onlyOwner {
        require(isUnderlying[underlying], "Underlying not supported");

        _burn(msg.sender, amount);

        SafeERC20.safeTransfer(
            IERC20(underlying),
            msg.sender,
            amount / 10 ** (18 - underlyingDecimals[underlying])
        );
    }

    function addUnderlying(address underlying) external onlyOwner {
        require(!isUnderlying[underlying], "Underlying already supported");

        uint256 decimals = IERC20Metadata(underlying).decimals();
        require(decimals <= 18, "Decimals must be less than or equal to 18");

        isUnderlying[underlying] = true;
        underlyingDecimals[underlying] = decimals;

        emit UnderlyingAdded(underlying);
    }

    function removeUnderlying(address underlying) external onlyOwner {
        require(isUnderlying[underlying], "Underlying not supported");

        delete isUnderlying[underlying];
        delete underlyingDecimals[underlying];

        emit UnderlyingRemoved(underlying);
    }
}
