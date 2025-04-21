// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import "../../../Interfaces/IWETH.sol";
// Curve
import "./Curve/ICurveStableswapNGPool.sol";
// UniV3
import "./UniswapV3/IQuoterV2.sol";

import "../../Interfaces/IExchangeHelpers.sol";

contract HybridCurveUniV3ExchangeHelpers is IExchangeHelpers {
    uint256 private constant DECIMAL_PRECISION = 1e18;

    //HybridCurveUniV3Exchange public immutable exchange;

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

    /*
    constructor(HybridCurveUniV3Exchange _exchange) {
        exchange = _exchange;

        USDC = _exchange.USDC();
        WETH = _exchange.WETH();

        curvePool = _exchange.curvePool();
        USDC_INDEX = _exchange.USDC_INDEX();
        BOLD_TOKEN_INDEX = _exchange.BOLD_INDEX();

        // Uniswap
        feeUsdcWeth = _exchange.feeUsdcWeth();
        feeWethColl = _exchange.feeWethColl();
        uniV3Quoter = _exchange.uniV3Quoter();
    }
    */

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

    function getCollFromBold(uint256 _boldAmount, IERC20 _collToken, uint256 _desiredCollAmount)
        external /* view */
        returns (uint256 collAmount, uint256 deviation)
    {
        // BOLD -> USDC
        uint256 curveUsdcAmount = curvePool.get_dy(int128(BOLD_TOKEN_INDEX), int128(USDC_INDEX), _boldAmount);

        // USDC -> Coll
        bytes memory path;
        if (address(WETH) == address(_collToken)) {
            path = abi.encodePacked(USDC, feeUsdcWeth, WETH);
        } else {
            path = abi.encodePacked(USDC, feeUsdcWeth, WETH, feeWethColl, _collToken);
        }

        (collAmount,,,) = uniV3Quoter.quoteExactInput(path, curveUsdcAmount);

        if (_desiredCollAmount > 0 && collAmount <= _desiredCollAmount) {
            deviation = DECIMAL_PRECISION - collAmount * DECIMAL_PRECISION / _desiredCollAmount;
        }

        return (collAmount, deviation);
    }
}
