// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

import "./Interfaces/IBorrowerOperations.sol";
import "./Interfaces/ITroveManager.sol";
import "./Dependencies/Ownable.sol";

/**
 * The purpose of this contract is to hold WETH tokens for gas compensation:
 * https://github.com/liquity/dev#gas-compensation
 * When a borrower opens a trove, an additional amount of WETH is pulled,
 * and sent to this contract.
 * When a borrower closes their active trove, this gas compensation is refunded
 * When a trove is liquidated, this gas compensation is paid to liquidator
 */
contract GasPool is Ownable {
    function setAllowance(IWETH _weth, IBorrowerOperations _borrowerOperations, ITroveManager _troveManager)
        external
        onlyOwner
    {
        // Allow BorrowerOperations to refund gas compensation
        _weth.approve(address(_borrowerOperations), type(uint256).max);
        // Allow TroveManager to pay gas compensation to liquidator
        _weth.approve(address(_troveManager), type(uint256).max);

        _renounceOwnership();
    }
}
