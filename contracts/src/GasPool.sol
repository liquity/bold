// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

import "./Interfaces/IAddressesRegistry.sol";
import "./Interfaces/IBorrowerOperations.sol";
import "./Interfaces/ITroveManager.sol";

/**
 * The purpose of this contract is to hold WETH tokens for gas compensation:
 * https://github.com/liquity/bold/?tab=readme-ov-file#liquidation-gas-compensation
 * When a borrower opens a trove, an additional amount of WETH is pulled,
 * and sent to this contract.
 * When a borrower closes their active trove, this gas compensation is refunded
 * When a trove is liquidated, this gas compensation is paid to liquidator
 */
contract GasPool {
    constructor(IAddressesRegistry _addressesRegistry) {
        IWETH WETH = _addressesRegistry.WETH();
        IBorrowerOperations borrowerOperations = _addressesRegistry.borrowerOperations();
        ITroveManager troveManager = _addressesRegistry.troveManager();

        // Allow BorrowerOperations to refund gas compensation
        WETH.approve(address(borrowerOperations), type(uint256).max);
        // Allow TroveManager to pay gas compensation to liquidator
        WETH.approve(address(troveManager), type(uint256).max);
    }
}
