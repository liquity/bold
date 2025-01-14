// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import "./Balancer/vault/IVault.sol";
import "./Balancer/vault/IFlashLoanRecipient.sol";

import "../../Interfaces/ILeverageZapper.sol";
import "../../Interfaces/IFlashLoanReceiver.sol";
import "../../Interfaces/IFlashLoanProvider.sol";

contract BalancerFlashLoan is IFlashLoanRecipient, IFlashLoanProvider {
    using SafeERC20 for IERC20;

    IVault private constant vault = IVault(0xBA12222222228d8Ba445958a75a0704d566BF2C8);
    IFlashLoanReceiver public receiver;

    function makeFlashLoan(IERC20 _token, uint256 _amount, Operation _operation, bytes calldata _params) external {
        IERC20[] memory tokens = new IERC20[](1);
        tokens[0] = _token;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = _amount;

        // Data for the callback receiveFlashLoan
        bytes memory userData;
        if (_operation == Operation.OpenTrove) {
            ILeverageZapper.OpenLeveragedTroveParams memory openTroveParams =
                abi.decode(_params, (ILeverageZapper.OpenLeveragedTroveParams));
            userData = abi.encode(_operation, openTroveParams);
        } else if (_operation == Operation.LeverUpTrove) {
            ILeverageZapper.LeverUpTroveParams memory leverUpTroveParams =
                abi.decode(_params, (ILeverageZapper.LeverUpTroveParams));
            userData = abi.encode(_operation, leverUpTroveParams);
        } else if (_operation == Operation.LeverDownTrove) {
            ILeverageZapper.LeverDownTroveParams memory leverDownTroveParams =
                abi.decode(_params, (ILeverageZapper.LeverDownTroveParams));
            userData = abi.encode(_operation, leverDownTroveParams);
        } else if (_operation == Operation.CloseTrove) {
            IZapper.CloseTroveParams memory closeTroveParams = abi.decode(_params, (IZapper.CloseTroveParams));
            userData = abi.encode(_operation, closeTroveParams);
        } else {
            revert("LZ: Wrong Operation");
        }

        // This will be used by the callback below no
        receiver = IFlashLoanReceiver(msg.sender);

        vault.flashLoan(this, tokens, amounts, userData);
    }

    function receiveFlashLoan(
        IERC20[] calldata tokens,
        uint256[] calldata amounts,
        uint256[] calldata feeAmounts,
        bytes calldata userData
    ) external override {
        require(msg.sender == address(vault), "Caller is not Vault");
        require(address(receiver) != address(0), "Flash loan not properly initiated");

        // Cache and reset receiver, to comply with CEI pattern, as some callbacks in zappers do raw calls
        // It’s not necessary, as Balancer flash loans are protected against re-entrancy
        // But it’s safer, specially if someone tries to reuse this code, and more gas efficient
        IFlashLoanReceiver receiverCached = receiver;
        receiver = IFlashLoanReceiver(address(0));

        // decode and operation
        Operation operation = abi.decode(userData[0:32], (Operation));

        if (operation == Operation.OpenTrove) {
            // Open
            // decode params
            ILeverageZapper.OpenLeveragedTroveParams memory openTroveParams =
                abi.decode(userData[32:], (ILeverageZapper.OpenLeveragedTroveParams));
            // Flash loan minus fees
            uint256 effectiveFlashLoanAmount = amounts[0] - feeAmounts[0];
            // We send only effective flash loan, keeping fees here
            tokens[0].safeTransfer(address(receiverCached), effectiveFlashLoanAmount);
            // Zapper callback
            receiverCached.receiveFlashLoanOnOpenLeveragedTrove(openTroveParams, effectiveFlashLoanAmount);
        } else if (operation == Operation.LeverUpTrove) {
            // Lever up
            // decode params
            ILeverageZapper.LeverUpTroveParams memory leverUpTroveParams =
                abi.decode(userData[32:], (ILeverageZapper.LeverUpTroveParams));
            // Flash loan minus fees
            uint256 effectiveFlashLoanAmount = amounts[0] - feeAmounts[0];
            // We send only effective flash loan, keeping fees here
            tokens[0].safeTransfer(address(receiverCached), effectiveFlashLoanAmount);
            // Zapper callback
            receiverCached.receiveFlashLoanOnLeverUpTrove(leverUpTroveParams, effectiveFlashLoanAmount);
        } else if (operation == Operation.LeverDownTrove) {
            // Lever down
            // decode params
            ILeverageZapper.LeverDownTroveParams memory leverDownTroveParams =
                abi.decode(userData[32:], (ILeverageZapper.LeverDownTroveParams));
            // Flash loan minus fees
            uint256 effectiveFlashLoanAmount = amounts[0] - feeAmounts[0];
            // We send only effective flash loan, keeping fees here
            tokens[0].safeTransfer(address(receiverCached), effectiveFlashLoanAmount);
            // Zapper callback
            receiverCached.receiveFlashLoanOnLeverDownTrove(leverDownTroveParams, effectiveFlashLoanAmount);
        } else if (operation == Operation.CloseTrove) {
            // Close trove
            // decode params
            IZapper.CloseTroveParams memory closeTroveParams = abi.decode(userData[32:], (IZapper.CloseTroveParams));
            // Flash loan minus fees
            uint256 effectiveFlashLoanAmount = amounts[0] - feeAmounts[0];
            // We send only effective flash loan, keeping fees here
            tokens[0].safeTransfer(address(receiverCached), effectiveFlashLoanAmount);
            // Zapper callback
            receiverCached.receiveFlashLoanOnCloseTroveFromCollateral(closeTroveParams, effectiveFlashLoanAmount);
        } else {
            revert("LZ: Wrong Operation");
        }

        // Return flash loan
        tokens[0].safeTransfer(address(vault), amounts[0] + feeAmounts[0]);
    }
}
