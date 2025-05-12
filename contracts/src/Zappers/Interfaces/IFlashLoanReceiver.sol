// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./IZapper.sol";
import "./ILeverageZapper.sol";

interface IFlashLoanReceiver {
    function receiveFlashLoanOnOpenLeveragedTrove(
        ILeverageZapper.OpenLeveragedTroveParams calldata _params,
        uint256 _effectiveFlashLoanAmount
    ) external;
    function receiveFlashLoanOnLeverUpTrove(
        ILeverageZapper.LeverUpTroveParams calldata _params,
        uint256 _effectiveFlashLoanAmount
    ) external;
    function receiveFlashLoanOnLeverDownTrove(
        ILeverageZapper.LeverDownTroveParams calldata _params,
        uint256 _effectiveFlashLoanAmount
    ) external;
    function receiveFlashLoanOnCloseTroveFromCollateral(
        IZapper.CloseTroveParams calldata _params,
        uint256 _effectiveFlashLoanAmount
    ) external;
}
