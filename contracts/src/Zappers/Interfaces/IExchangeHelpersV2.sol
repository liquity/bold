// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IExchangeHelpersV2 {
    function quoteExactInput(uint256 _inputAmount, bool _collToBold, address _collToken)
        external
        returns (uint256 outputAmount);

    function quoteExactOutput(uint256 _outputAmount, bool _collToBold, address _collToken)
        external
        returns (uint256 inputAmount);
}
