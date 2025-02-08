// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import {ICurveStableswapNGPool} from "./Curve/ICurveStableswapNGPool.sol";
import {IQuoterV2} from "./UniswapV3/IQuoterV2.sol";
import {IExchangeHelpersV2} from "../../Interfaces/IExchangeHelpersV2.sol";

contract HybridCurveUniV3ExchangeHelpersV2 is IExchangeHelpersV2 {
    address public immutable USDC;
    address public immutable WETH;

    // Curve
    ICurveStableswapNGPool public immutable curvePool;
    int128 public immutable USDC_INDEX;
    int128 public immutable BOLD_TOKEN_INDEX;

    // Uniswap
    uint24 public immutable feeUsdcWeth;
    uint24 public immutable feeWethColl;
    IQuoterV2 public immutable uniV3Quoter;

    constructor(
        address _usdc,
        address _weth,
        // Curve
        ICurveStableswapNGPool _curvePool,
        int128 _usdcIndex,
        int128 _boldIndex,
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

    function getDy(uint256 _dx, bool _collToBold, address _collToken) external returns (uint256 dy) {
        if (_collToBold) {
            // (Coll ->) WETH -> USDC?
            bytes memory path;
            if (WETH == _collToken) {
                path = abi.encodePacked(WETH, feeUsdcWeth, USDC);
            } else {
                path = abi.encodePacked(_collToken, feeWethColl, WETH, feeUsdcWeth, USDC);
            }

            (uint256 uniDy,,,) = uniV3Quoter.quoteExactInput(path, _dx);

            // USDC -> BOLD?
            dy = curvePool.get_dy(USDC_INDEX, BOLD_TOKEN_INDEX, uniDy);
        } else {
            // BOLD -> USDC?
            uint256 curveDy = curvePool.get_dy(BOLD_TOKEN_INDEX, USDC_INDEX, _dx);

            // USDC -> WETH (-> Coll)?
            bytes memory path;
            if (WETH == _collToken) {
                path = abi.encodePacked(USDC, feeUsdcWeth, WETH);
            } else {
                path = abi.encodePacked(USDC, feeUsdcWeth, WETH, feeWethColl, _collToken);
            }

            (dy,,,) = uniV3Quoter.quoteExactInput(path, curveDy);
        }
    }

    function getDx(uint256 _dy, bool _collToBold, address _collToken) external returns (uint256 dx) {
        if (_collToBold) {
            // USDC? -> BOLD
            uint256 curveDx = curvePool.get_dx(USDC_INDEX, BOLD_TOKEN_INDEX, _dy);

            // Uniswap expects path to be reversed when quoting exact output
            // USDC <- WETH (<- Coll)?
            bytes memory path;
            if (WETH == _collToken) {
                path = abi.encodePacked(USDC, feeUsdcWeth, WETH);
            } else {
                path = abi.encodePacked(USDC, feeUsdcWeth, WETH, feeWethColl, _collToken);
            }

            (dx,,,) = uniV3Quoter.quoteExactOutput(path, curveDx);
        } else {
            // Uniswap expects path to be reversed when quoting exact output
            // (Coll <-) WETH <- USDC?
            bytes memory path;
            if (WETH == _collToken) {
                path = abi.encodePacked(WETH, feeUsdcWeth, USDC);
            } else {
                path = abi.encodePacked(_collToken, feeWethColl, WETH, feeUsdcWeth, USDC);
            }

            (uint256 uniDx,,,) = uniV3Quoter.quoteExactOutput(path, _dy);

            // BOLD? -> USDC
            dx = curvePool.get_dx(BOLD_TOKEN_INDEX, USDC_INDEX, uniDx);
        }
    }
}
