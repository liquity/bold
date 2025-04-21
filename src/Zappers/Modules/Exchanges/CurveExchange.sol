// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

import "../../../Interfaces/IBoldToken.sol";
import "./Curve/ICurvePool.sol";
import "../../Interfaces/IExchange.sol";

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

    function swapFromBold(uint256 _boldAmount, uint256 _minCollAmount) external {
        ICurvePool curvePoolCached = curvePool;
        uint256 initialBoldBalance = boldToken.balanceOf(address(this));
        boldToken.transferFrom(msg.sender, address(this), _boldAmount);
        boldToken.approve(address(curvePoolCached), _boldAmount);

        uint256 output = curvePoolCached.exchange(BOLD_TOKEN_INDEX, COLL_TOKEN_INDEX, _boldAmount, _minCollAmount);
        collToken.safeTransfer(msg.sender, output);

        uint256 currentBoldBalance = boldToken.balanceOf(address(this));
        if (currentBoldBalance > initialBoldBalance) {
            boldToken.transfer(msg.sender, currentBoldBalance - initialBoldBalance);
        }
    }

    function swapToBold(uint256 _collAmount, uint256 _minBoldAmount) external returns (uint256) {
        ICurvePool curvePoolCached = curvePool;
        uint256 initialCollBalance = collToken.balanceOf(address(this));
        collToken.safeTransferFrom(msg.sender, address(this), _collAmount);
        collToken.approve(address(curvePoolCached), _collAmount);

        uint256 output = curvePoolCached.exchange(COLL_TOKEN_INDEX, BOLD_TOKEN_INDEX, _collAmount, _minBoldAmount);
        boldToken.transfer(msg.sender, output);

        uint256 currentCollBalance = collToken.balanceOf(address(this));
        if (currentCollBalance > initialCollBalance) {
            collToken.safeTransfer(msg.sender, currentCollBalance - initialCollBalance);
        }

        return output;
    }
}
