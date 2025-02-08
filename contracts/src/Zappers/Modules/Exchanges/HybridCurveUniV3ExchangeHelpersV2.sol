// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {IWETH} from "../../../Interfaces/IWETH.sol";
import {ICurveStableswapNGPool} from "./Curve/ICurveStableswapNGPool.sol";
import {IQuoterV2} from "./UniswapV3/IQuoterV2.sol";
import {IExchangeHelpersV2} from "../../Interfaces/IExchangeHelpersV2.sol";

contract HybridCurveUniV3ExchangeHelpersV2 is IExchangeHelpersV2 {
    IERC20 public immutable USDC;
    IWETH public immutable WETH;

    // Curve
    ICurveStableswapNGPool public immutable curvePool;
    uint128 public immutable USDC_INDEX;
    uint128 public immutable BOLD_TOKEN_INDEX;

    // Uniswap
    uint24 public immutable feeUsdcWeth;
    uint24 public immutable feeWethColl;
    IQuoterV2 public immutable uniV3Quoter;

    constructor(
        IERC20 _usdc,
        IWETH _weth,
        // Curve
        ICurveStableswapNGPool _curvePool,
        uint128 _usdcIndex,
        uint128 _boldIndex,
        // UniV3
        uint24 _feeUsdcWeth,
        uint24 _feeWethColl,
        IQuoterV2 _uniV3Quoter
    ) {
        USDC = _usdc;
        WETH = _weth;

        // Curve
        curvePool = _curvePool;
        USDC_INDEX = _usdcIndex;
        BOLD_TOKEN_INDEX = _boldIndex;

        // Uniswap
        feeUsdcWeth = _feeUsdcWeth;
        feeWethColl = _feeWethColl;
        uniV3Quoter = _uniV3Quoter;
    }

    function getDy(uint256 _dx, bool _collToBold, IERC20 _collToken) external returns (uint256 dy) {
        if (_collToBold) {
            // (Coll ->) WETH -> USDC?
            bytes memory path;
            if (address(WETH) == address(_collToken)) {
                path = abi.encodePacked(WETH, feeUsdcWeth, USDC);
            } else {
                path = abi.encodePacked(_collToken, feeWethColl, WETH, feeUsdcWeth, USDC);
            }

            (uint256 uniDy,,,) = uniV3Quoter.quoteExactInput(path, _dx);

            // USDC -> BOLD?
            dy = curvePool.get_dy(int128(USDC_INDEX), int128(BOLD_TOKEN_INDEX), uniDy);
        } else {
            // BOLD -> USDC?
            uint256 curveDy = curvePool.get_dy(int128(BOLD_TOKEN_INDEX), int128(USDC_INDEX), _dx);

            // USDC -> WETH (-> Coll)?
            bytes memory path;
            if (address(WETH) == address(_collToken)) {
                path = abi.encodePacked(USDC, feeUsdcWeth, WETH);
            } else {
                path = abi.encodePacked(USDC, feeUsdcWeth, WETH, feeWethColl, _collToken);
            }

            (dy,,,) = uniV3Quoter.quoteExactInput(path, curveDy);
        }
    }

    function getDx(uint256 _dy, bool _collToBold, IERC20 _collToken) external returns (uint256 dx) {
        if (_collToBold) {
            // USDC? -> BOLD
            uint256 curveDx = curvePool.get_dx(int128(USDC_INDEX), int128(BOLD_TOKEN_INDEX), _dy);

            // Uniswap expects path to be reversed when quoting exact output
            // USDC <- WETH (<- Coll)?
            bytes memory path;
            if (address(WETH) == address(_collToken)) {
                path = abi.encodePacked(USDC, feeUsdcWeth, WETH);
            } else {
                path = abi.encodePacked(USDC, feeUsdcWeth, WETH, feeWethColl, _collToken);
            }

            (dx,,,) = uniV3Quoter.quoteExactOutput(path, curveDx);
        } else {
            // Uniswap expects path to be reversed when quoting exact output
            // (Coll <-) WETH <- USDC?
            bytes memory path;
            if (address(WETH) == address(_collToken)) {
                path = abi.encodePacked(WETH, feeUsdcWeth, USDC);
            } else {
                path = abi.encodePacked(_collToken, feeWethColl, WETH, feeUsdcWeth, USDC);
            }

            (uint256 uniDx,,,) = uniV3Quoter.quoteExactOutput(path, _dy);

            // BOLD? -> USDC
            dx = curvePool.get_dx(int128(BOLD_TOKEN_INDEX), int128(USDC_INDEX), uniDx);
        }
    }
}
