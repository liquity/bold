// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "./ILeverageZapper.sol";
import "./IFlashLoanReceiver.sol";

interface IFlashLoanProvider {
    enum Operation {
        OpenTrove,
        CloseTrove,
        LeverUpTrove,
        LeverDownTrove
    }

    function receiver() external view returns (IFlashLoanReceiver);

    function makeFlashLoan(IERC20 _token, uint256 _amount, Operation _operation, bytes calldata userData) external;
}
