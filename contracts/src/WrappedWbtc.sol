// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import "openzeppelin-contracts/contracts/token/ERC20/extensions/ERC20Wrapper.sol";

contract WrappedWbtc is ERC20Wrapper {
    using SafeERC20 for IERC20;

    uint256 private constant _DECIMALS_DIFF = 10;
    address private constant _WBTC = 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599;

    constructor() ERC20Wrapper(IERC20(_WBTC)) ERC20("Wrapped WBTC", "WBTC18") {
        require(IERC20Metadata(_WBTC).decimals() == 8, "!DECIMALS");
    }

    /**
     * @dev See {ERC20-decimals}.
     */
    function decimals() public pure override returns (uint8) {
        return 18;
    }

    /**
     * @dev See {ERC20Wrapper-depositFor}.
     */
    function depositFor(address account, uint256 amount) public override returns (bool) {
        address sender = _msgSender();
        require(sender != address(this), "ERC20Wrapper: wrapper can't deposit");
        underlying().safeTransferFrom(sender, address(this), amount);
        uint256 amountInDecimals = amount * 10 ** _DECIMALS_DIFF;
        _mint(account, amountInDecimals);
        return true;
    }

    /**
     * @dev See {ERC20Wrapper-withdrawTo}.
     */
    function withdrawTo(address account, uint256 amount) public override returns (bool) {
        _burn(_msgSender(), amount);
        uint256 amountInDecimals = amount / 10 ** _DECIMALS_DIFF;
        underlying().safeTransfer(account, amountInDecimals);
        return true;
    }
}