// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import "./Balancer/vault/IVault.sol";
import "./Balancer/vault/IFlashLoanRecipient.sol";

import "../../Interfaces/ILeverageZapper.sol";
import "../../Interfaces/IFlashLoanReceiver.sol";
import "../../Interfaces/IFlashLoanProvider.sol";

// import "forge-std/console2.sol";

contract BalancerFlashLoan is IFlashLoanRecipient, IFlashLoanProvider {
    using SafeERC20 for IERC20;

    IVault private constant vault = IVault(0xBA12222222228d8Ba445958a75a0704d566BF2C8);

    function makeFlashLoan(
        IERC20 _token,
        uint256 _amount,
        IFlashLoanReceiver _caller, // TODO: should it always be msg.sender?
        Operation _operation,
        bytes calldata _params
    ) external {
        IERC20[] memory tokens = new IERC20[](1);
        tokens[0] = _token;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = _amount;

        // Data for the callback receiveFlashLoan
        bytes memory userData;
        if (_operation == Operation.OpenTrove) {
            ILeverageZapper.OpenLeveragedTroveParams memory openTroveParams =
                abi.decode(_params, (ILeverageZapper.OpenLeveragedTroveParams));
            userData = abi.encode(_caller, _operation, openTroveParams);
        } else if (_operation == Operation.LeverUpTrove) {
            ILeverageZapper.LeverUpTroveParams memory leverUpTroveParams =
                abi.decode(_params, (ILeverageZapper.LeverUpTroveParams));
            userData = abi.encode(_caller, _operation, leverUpTroveParams);
        } else if (_operation == Operation.LeverDownTrove) {
            ILeverageZapper.LeverDownTroveParams memory leverDownTroveParams =
                abi.decode(_params, (ILeverageZapper.LeverDownTroveParams));
            userData = abi.encode(_caller, _operation, leverDownTroveParams);
        } else {
            revert("LZ: Wrong Operation");
        }

        vault.flashLoan(this, tokens, amounts, userData);
    }

    function receiveFlashLoan(
        IERC20[] calldata tokens,
        uint256[] calldata amounts,
        uint256[] calldata feeAmounts,
        bytes calldata userData
    ) external override {
        require(msg.sender == address(vault), "Caller is not Vault");

        // decode receiver and operation
        IFlashLoanReceiver receiver = IFlashLoanReceiver(abi.decode(userData[0:32], (address)));
        Operation operation = abi.decode(userData[32:64], (Operation));

        if (operation == Operation.OpenTrove) {
            // Open
            // decode params
            ILeverageZapper.OpenLeveragedTroveParams memory openTroveParams =
                abi.decode(userData[64:], (ILeverageZapper.OpenLeveragedTroveParams));
            // Flash loan minus fees
            uint256 effectiveFlashLoanAmount = amounts[0] - feeAmounts[0];
            // We send only effective flash loan, keeping fees here
            tokens[0].safeTransfer(address(receiver), effectiveFlashLoanAmount);
            // Zapper callback
            receiver.receiveFlashLoanOnOpenLeveragedTrove(openTroveParams, effectiveFlashLoanAmount);
        } else if (operation == Operation.LeverUpTrove) {
            // Lever up
            // decode params
            ILeverageZapper.LeverUpTroveParams memory leverUpTroveParams =
                abi.decode(userData[64:], (ILeverageZapper.LeverUpTroveParams));
            // Flash loan minus fees
            uint256 effectiveFlashLoanAmount = amounts[0] - feeAmounts[0];
            // We send only effective flash loan, keeping fees here
            tokens[0].safeTransfer(address(receiver), effectiveFlashLoanAmount);
            // Zapper callback
            receiver.receiveFlashLoanOnLeverUpTrove(leverUpTroveParams, effectiveFlashLoanAmount);
        } else if (operation == Operation.LeverDownTrove) {
            // Lever down
            // decode params
            ILeverageZapper.LeverDownTroveParams memory leverDownTroveParams =
                abi.decode(userData[64:], (ILeverageZapper.LeverDownTroveParams));
            // Flash loan minus fees
            uint256 effectiveFlashLoanAmount = amounts[0] - feeAmounts[0];
            // We send only effective flash loan, keeping fees here
            tokens[0].safeTransfer(address(receiver), effectiveFlashLoanAmount);
            // Zapper callback
            receiver.receiveFlashLoanOnLeverDownTrove(leverDownTroveParams, effectiveFlashLoanAmount);
        } else {
            revert("LZ: Wrong Operation");
        }

        // Return flash loan
        tokens[0].safeTransfer(address(vault), amounts[0] + feeAmounts[0]);
    }
}
