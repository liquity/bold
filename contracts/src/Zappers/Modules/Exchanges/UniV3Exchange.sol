// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import "openzeppelin-contracts/contracts/utils/math/Math.sol";

import "../../LeftoversSweep.sol";
import "../../../Interfaces/IBoldToken.sol";
import "./UniswapV3/ISwapRouter.sol";
import "./UniswapV3/IQuoterV2.sol";
import "../../Interfaces/IExchange.sol";
import {DECIMAL_PRECISION} from "../../../Dependencies/Constants.sol";

// import "forge-std/console2.sol";

contract UniV3Exchange is LeftoversSweep, IExchange {
    using SafeERC20 for IERC20;

    IERC20 public immutable collToken;
    IBoldToken public immutable boldToken;
    uint24 public immutable fee;
    ISwapRouter public immutable uniV3Router;
    IQuoterV2 public immutable uniV3Quoter;

    constructor(
        IERC20 _collToken,
        IBoldToken _boldToken,
        uint24 _fee,
        ISwapRouter _uniV3Router,
        IQuoterV2 _uniV3Quoter
    ) {
        collToken = _collToken;
        boldToken = _boldToken;
        fee = _fee;
        uniV3Router = _uniV3Router;
        uniV3Quoter = _uniV3Quoter;
    }

    // See: https://docs.uniswap.org/contracts/v3/reference/periphery/interfaces/IQuoterV2
    // These functions are not marked view because they rely on calling non-view functions and reverting to compute the result.
    // They are also not gas efficient and should not be called on-chain.
    function getBoldAmountToSwap(uint256, /*_boldAmount*/ uint256 _maxBoldAmount, uint256 _minCollAmount)
        external /* view */
        returns (uint256)
    {
        IQuoterV2.QuoteExactOutputSingleParams memory params = IQuoterV2.QuoteExactOutputSingleParams({
            tokenIn: address(boldToken),
            tokenOut: address(collToken),
            amount: _minCollAmount,
            fee: fee,
            sqrtPriceLimitX96: 0
        });
        (uint256 amountIn,,,) = uniV3Quoter.quoteExactOutputSingle(params);
        require(amountIn <= _maxBoldAmount, "Price too high");

        return amountIn;
    }

    function swapFromBold(uint256 _boldAmount, uint256 _minCollAmount) external returns (uint256) {
        ISwapRouter uniV3RouterCached = uniV3Router;

        // Set initial balances to make sure there are not lefovers
        InitialBalances memory initialBalances;
        _setInitialBalances(collToken, boldToken, initialBalances);

        boldToken.transferFrom(msg.sender, address(this), _boldAmount);
        boldToken.approve(address(uniV3RouterCached), _boldAmount);

        ISwapRouter.ExactOutputSingleParams memory params = ISwapRouter.ExactOutputSingleParams({
            tokenIn: address(boldToken),
            tokenOut: address(collToken),
            fee: fee,
            recipient: msg.sender,
            deadline: block.timestamp,
            amountOut: _minCollAmount,
            amountInMaximum: _boldAmount,
            sqrtPriceLimitX96: 0 // See: https://ethereum.stackexchange.com/a/156018/9205
        });

        uint256 amountIn = uniV3RouterCached.exactOutputSingle(params);

        // return leftovers to user
        _returnLeftovers(collToken, boldToken, initialBalances);

        return amountIn;
    }

    function swapToBold(uint256 _collAmount, uint256 _minBoldAmount) external returns (uint256) {
        ISwapRouter uniV3RouterCached = uniV3Router;

        // Set initial balances to make sure there are not lefovers
        InitialBalances memory initialBalances;
        _setInitialBalances(collToken, boldToken, initialBalances);

        collToken.safeTransferFrom(msg.sender, address(this), _collAmount);
        collToken.approve(address(uniV3RouterCached), _collAmount);

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: address(collToken),
            tokenOut: address(boldToken),
            fee: fee,
            recipient: msg.sender,
            deadline: block.timestamp,
            amountIn: _collAmount,
            amountOutMinimum: _minBoldAmount,
            sqrtPriceLimitX96: 0 // See: https://ethereum.stackexchange.com/a/156018/9205
        });

        uint256 amountOut = uniV3RouterCached.exactInputSingle(params);

        // return leftovers to user
        _returnLeftovers(collToken, boldToken, initialBalances);

        return amountOut;
    }

    function priceToSqrtPrice(IBoldToken _boldToken, IERC20 _collToken, uint256 _price) public pure returns (uint160) {
        // inverse price if Bold goes first
        uint256 price = _zeroForOne(_boldToken, _collToken) ? DECIMAL_PRECISION * DECIMAL_PRECISION / _price : _price;
        return uint160(Math.sqrt((price << 192) / DECIMAL_PRECISION));
    }

    // See: https://github.com/Uniswap/v3-periphery/blob/main/contracts/lens/QuoterV2.sol#L207C9-L207C60
    function _zeroForOne(IBoldToken _boldToken, IERC20 _collToken) internal pure returns (bool) {
        return address(_boldToken) < address(_collToken);
    }
}
