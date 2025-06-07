// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IDEXRouter {
    /**
     * @notice Swaps an exact amount of input tokens for as many output tokens as possible.
     * @param amountIn The amount of input tokens to send.
     * @param amountOutMin The minimum amount of output tokens that must be received for the transaction not to revert.
     * @param path An array of token addresses. path[0] is the input token, path[length-1] is the output token.
     *             All intermediate addresses are tokens to trade through.
     * @param to The address to send the output tokens to.
     * @param deadline The unix timestamp after which the transaction will revert.
     * @return amounts The input token amount and all subsequent output token amounts.
     */
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    // Potentially add other functions like WETH address if the router handles ETH wrapping/unwrapping
    // function WETH() external pure returns (address);
}
