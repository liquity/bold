// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "./ZapperAsFuck.sol";

interface IWrapper {
    function depositFor(address account, uint256 amount) external returns (bool);
    function withdrawTo(address account, uint256 amount) external returns (bool);
}

contract CbbtcZapper is ZapperAsFuck {
    using SafeERC20 for IERC20;

    uint256 private constant _DECIMALS_DIFF = 10;

    IERC20 private constant _CBBTC = IERC20(0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf);

    constructor(IAddressesRegistry _addressesRegistry) ZapperAsFuck(_addressesRegistry) {
        // Approve unwrapped coll (cbBTC) to coll (wcbBTC)
        _CBBTC.approve(address(collToken), type(uint256).max);
    }

    function _pullColl(uint256 _amount) internal override {
        uint256 collAmountInStrangeDecimals = _amount / 10 ** _DECIMALS_DIFF;
        require(collAmountInStrangeDecimals * 10 ** _DECIMALS_DIFF == _amount, "!precision");
        _CBBTC.safeTransferFrom(msg.sender, address(this), collAmountInStrangeDecimals);
        IWrapper(collToken).depositFor(address(this), collAmountInStrangeDecimals);
    }

    function _sendColl(address _receiver, uint256 _amount) internal override {
        IWrapper(collToken).withdrawTo(_receiver, _amount);
    }
}