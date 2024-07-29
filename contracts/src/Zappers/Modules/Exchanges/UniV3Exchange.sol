// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

import "../../../Interfaces/IBoldToken.sol";
import "./UniswapV3/ISwapRouter.sol";
import "./UniswapV3/IQuoterV2.sol";
import "../../Interfaces/IExchange.sol";

import "forge-std/console2.sol";

contract UniV3Exchange is IExchange {
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
    function getBoldAmountToSwap(uint256 /* _boldAmount */, uint256 /* _maxBoldAmount */, uint256 _minCollAmount) external /* view */ returns (uint256) {
        IQuoterV2.QuoteExactOutputSingleParams memory params = IQuoterV2.QuoteExactOutputSingleParams({
            tokenIn: address(boldToken),
            tokenOut: address(collToken),
            amount: _minCollAmount,
            fee: fee,
            sqrtPriceLimitX96: 0 // See: https://ethereum.stackexchange.com/a/156018/9205
        });
        (uint256 amountIn,,,) = uniV3Quoter.quoteExactOutputSingle(params);

        return amountIn;
    }

    function swapFromBold(uint256 _boldAmount, uint256 _minCollAmount, address _zapper) external returns (uint256) {
        ISwapRouter uniV3RouterCached = uniV3Router;
        IBoldToken boldTokenCached = boldToken;
        boldTokenCached.transferFrom(_zapper, address(this), _boldAmount);
        boldTokenCached.approve(address(uniV3RouterCached), _boldAmount);

        ISwapRouter.ExactOutputSingleParams memory params = ISwapRouter.ExactOutputSingleParams({
            tokenIn: address(boldTokenCached),
            tokenOut: address(collToken),
            fee: fee,
            recipient: _zapper,
            deadline: block.timestamp + 3600,
            amountOut: _minCollAmount,
            amountInMaximum: _boldAmount,
            sqrtPriceLimitX96: 0 // See: https://ethereum.stackexchange.com/a/156018/9205
            });
        return uniV3RouterCached.exactOutputSingle(params);
    }

    function swapToBold(uint256 _collAmount, uint256 _minBoldAmount, address _zapper) external returns (uint256) {
        ISwapRouter uniV3RouterCached = uniV3Router;
        IERC20 collTokenCached = collToken;
        collTokenCached.safeTransferFrom(_zapper, address(this), _collAmount);
        collTokenCached.approve(address(uniV3RouterCached), _collAmount);

        ISwapRouter.ExactOutputSingleParams memory params = ISwapRouter.ExactOutputSingleParams({
            tokenIn: address(collTokenCached),
            tokenOut: address(boldToken),
            fee: fee,
            recipient: _zapper,
            deadline: block.timestamp + 3600,
            amountOut: _minBoldAmount,
            amountInMaximum: _collAmount,
            sqrtPriceLimitX96: 0 // See: https://ethereum.stackexchange.com/a/156018/9205
            });
        return uniV3RouterCached.exactOutputSingle(params);
    }
}
