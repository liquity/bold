// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./IFlashLoanProvider.sol";
import "./IExchange.sol";

interface IZapper {
    struct OpenTroveParams {
        address owner;
        uint256 ownerIndex;
        uint256 collAmount;
        uint256 boldAmount;
        uint256 upperHint;
        uint256 lowerHint;
        uint256 annualInterestRate;
        address batchManager;
        uint256 maxUpfrontFee;
        address addManager;
        address removeManager;
        address receiver;
    }

    struct CloseTroveParams {
        uint256 troveId;
        uint256 flashLoanAmount;
        uint256 minExpectedCollateral;
        address receiver;
    }

    function flashLoanProvider() external view returns (IFlashLoanProvider);

    function exchange() external view returns (IExchange);

    function openTroveWithRawETH(OpenTroveParams calldata _params) external payable returns (uint256);

    function closeTroveFromCollateral(uint256 _troveId, uint256 _flashLoanAmount, uint256 _minExpectedCollateral)
        external;
}
