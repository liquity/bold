// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20Metadata} from "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC4626} from "openzeppelin-contracts/contracts/interfaces/IERC4626.sol";
import {BoldConverter} from "../Dependencies/BoldConverter.sol";


contract StableToVaultZapper {
    BoldConverter private immutable _boldConverter;
    IERC20Metadata private immutable _underlying;
    IERC4626 private immutable _vault;

    constructor(BoldConverter boldConverter, IERC4626 vault) {
        _boldConverter = boldConverter;
        _underlying = boldConverter.underlying();
        _vault = vault;

        require(address(_underlying) == address(_vault.asset()), "Underlying mismatch");
        _underlying.approve(address(_vault), type(uint256).max);
    }

    function deposit(uint256 amount) external {
        SafeERC20.safeTransferFrom(address(_underlying), sender, address(this), amount);

        _boldConverter.deposit(amount);

        _vault.deposit(amount, address(this));
    }
}