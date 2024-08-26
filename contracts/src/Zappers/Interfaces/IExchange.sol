// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IExchange {
    // Removing view because of Uniswap IQuoter
    function getBoldAmountToSwap(uint256 _boldAmount, uint256 _maxBoldAmount, uint256 _minCollAmount)
        external /* view */
        returns (uint256);
    function swapFromBold(uint256 _boldAmount, uint256 _minCollAmount, address _zapper) external returns (uint256);

    function swapToBold(uint256 _collAmount, uint256 _minBoldAmount, address _zapper) external returns (uint256);
}
