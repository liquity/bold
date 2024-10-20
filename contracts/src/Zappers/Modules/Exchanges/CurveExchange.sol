// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

import "../../../Interfaces/IBoldToken.sol";
import "./Curve/ICurvePool.sol";
import "../../Interfaces/IExchange.sol";

// import "forge-std/console2.sol";

contract CurveExchange is IExchange {
    using SafeERC20 for IERC20;

    IERC20 public immutable collToken;
    IBoldToken public immutable boldToken;
    ICurvePool public immutable curvePool;
    uint256 public immutable COLL_TOKEN_INDEX;
    uint256 public immutable BOLD_TOKEN_INDEX;

    constructor(
        IERC20 _collToken,
        IBoldToken _boldToken,
        ICurvePool _curvePool,
        uint256 _collIndex,
        uint256 _boldIndex
    ) {
        collToken = _collToken;
        boldToken = _boldToken;
        curvePool = _curvePool;
        COLL_TOKEN_INDEX = _collIndex;
        BOLD_TOKEN_INDEX = _boldIndex;
    }

    // Helper to get the actual bold we need, capped by a max value, to get flash loan amount
    function getBoldAmountToSwap(uint256 _boldAmount, uint256 _maxBoldAmount, uint256 _minCollAmount)
        external
        view
        returns (uint256)
    {
        uint256 step = (_maxBoldAmount - _boldAmount) / 5; // In max 5 iterations we should reach the target, unless price is lower
        uint256 dy;
        // TODO: Optimizations: binary search, change the step depending on last dy, ...
        // Or check if there’s any helper implemented anywhere
        uint256 lastBoldAmount = _maxBoldAmount + step;
        do {
            lastBoldAmount -= step;
            dy = curvePool.get_dy(BOLD_TOKEN_INDEX, COLL_TOKEN_INDEX, lastBoldAmount);
        } while (dy > _minCollAmount && lastBoldAmount > step);

        uint256 boldAmountToSwap = dy >= _minCollAmount ? lastBoldAmount : lastBoldAmount + step;
        require(boldAmountToSwap <= _maxBoldAmount, "Bold amount required too high");

        return boldAmountToSwap;
    }

    function swapFromBold(uint256 _boldAmount, uint256 _minCollAmount) external returns (uint256) {
        ICurvePool curvePoolCached = curvePool;
        uint256 initialBoldBalance = boldToken.balanceOf(address(this));
        boldToken.transferFrom(msg.sender, address(this), _boldAmount);
        boldToken.approve(address(curvePoolCached), _boldAmount);

        // TODO: make this work
        //return curvePoolCached.exchange(BOLD_TOKEN_INDEX, COLL_TOKEN_INDEX, _boldAmount, _minCollAmount, false, msg.sender);
        uint256 output = curvePoolCached.exchange(BOLD_TOKEN_INDEX, COLL_TOKEN_INDEX, _boldAmount, _minCollAmount);
        collToken.safeTransfer(msg.sender, output);

        uint256 currentBoldBalance = boldToken.balanceOf(address(this));
        if (currentBoldBalance > initialBoldBalance) {
            boldToken.transfer(msg.sender, currentBoldBalance - initialBoldBalance);
        }

        return output;
    }

    function swapToBold(uint256 _collAmount, uint256 _minBoldAmount) external returns (uint256) {
        ICurvePool curvePoolCached = curvePool;
        uint256 initialCollBalance = collToken.balanceOf(address(this));
        collToken.safeTransferFrom(msg.sender, address(this), _collAmount);
        collToken.approve(address(curvePoolCached), _collAmount);

        //return curvePoolCached.exchange(COLL_TOKEN_INDEX, BOLD_TOKEN_INDEX, _collAmount, _minBoldAmount, false, msg.sender);
        uint256 output = curvePoolCached.exchange(COLL_TOKEN_INDEX, BOLD_TOKEN_INDEX, _collAmount, _minBoldAmount);
        boldToken.transfer(msg.sender, output);

        uint256 currentCollBalance = collToken.balanceOf(address(this));
        if (currentCollBalance > initialCollBalance) {
            collToken.transfer(msg.sender, currentCollBalance - initialCollBalance);
        }

        return output;
    }
}
