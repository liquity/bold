// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20Metadata} from "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC4626} from "openzeppelin-contracts/contracts/interfaces/IERC4626.sol";
import {BoldConverter} from "../Dependencies/BoldConverter.sol";

interface ERC7540 {
    function requestRedeem(
        uint256 shares,
        address controller,
        address owner
    ) external returns (uint256 requestId);
}

contract BTCToVaultZapper {
    IERC20Metadata private immutable _underlying;
    IERC4626 private immutable _vault;
    IERC4626 private immutable _collateralVault;

    constructor(IERC20Metadata underlying, IERC4626 vault) {
        _underlying = underlying;
        _vault = vault;
        _collateralVault = vault.asset();

        require(
            address(underlying) == address(_collateralVault.asset()),
            "Underlying mismatch"
        );

        underlying.approve(address(_collateralVault), type(uint256).max);
        _collateralVault.approve(address(_vault), type(uint256).max);
    }

    function deposit(uint256 amount) external {
        SafeERC20.safeTransferFrom(
            address(_underlying),
            msg.sender,
            address(this),
            amount
        );

        _collateralVault.deposit(amount, address(this));

        _vault.deposit(amount, msg.sender);    
    }
}
