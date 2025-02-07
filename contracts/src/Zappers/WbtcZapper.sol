// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "./USAZapper.sol";

interface IWrapper {
    function depositFor(address account, uint256 amount) external returns (bool);
    function withdrawTo(address account, uint256 amount) external returns (bool);
}

contract WbtcZapper is USAZapper {
    using SafeERC20 for IERC20;

    uint256 private constant _DECIMALS_DIFF = 10;

    IERC20 private constant _WBTC = IERC20(0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599);

    constructor(IAddressesRegistry _addressesRegistry) USAZapper(_addressesRegistry) {
        // Approve unwrapped coll (WBTC) to coll (WWBTC)
        _WBTC.approve(address(collToken), type(uint256).max);
    }

    function _pullColl(uint256 _amount) internal override {
        uint256 collAmountInStrangeDecimals = _amount / 10 ** _DECIMALS_DIFF;
        require(collAmountInStrangeDecimals * 10 ** _DECIMALS_DIFF == _amount, "!precision");
        _WBTC.safeTransferFrom(msg.sender, address(this), collAmountInStrangeDecimals);
        IWrapper(collToken).depositFor(address(this), collAmountInStrangeDecimals);
    }

    function _sendColl(address _receiver, uint256 _amount) internal override {
        IWrapper(collToken).withdrawTo(_receiver, _amount);
    }
}