// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./IFlashLoanProvider.sol";
import "./IExchange.sol";

interface ILeverageZapper {
    struct OpenLeveragedTroveParams {
        address owner;
        uint256 ownerIndex;
        uint256 collAmount;
        uint256 flashLoanAmount;
        uint256 boldAmount;
        uint256 upperHint;
        uint256 lowerHint;
        uint256 annualInterestRate;
        uint256 maxUpfrontFee;
        address addManager;
        address removeManager;
        address receiver;
    }

    struct LeverUpTroveParams {
        uint256 troveId;
        uint256 flashLoanAmount;
        uint256 boldAmount;
        uint256 maxUpfrontFee;
    }

    struct LeverDownTroveParams {
        uint256 troveId;
        uint256 flashLoanAmount;
        uint256 minBoldAmount;
    }

    function flashLoanProvider() external view returns (IFlashLoanProvider);

    function exchange() external view returns (IExchange);

    function openLeveragedTroveWithRawETH(OpenLeveragedTroveParams calldata _params) external payable;

    function leverUpTrove(LeverUpTroveParams calldata _params) external;

    function leverDownTrove(LeverDownTroveParams calldata _params) external;

    function leverageRatioToCollateralRatio(uint256 _inputRatio) external pure returns (uint256);
}
