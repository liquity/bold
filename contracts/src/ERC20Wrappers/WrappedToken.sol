// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.23;

import "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-contracts/contracts/token/ERC20/extensions/ERC20Wrapper.sol";
import "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract WrappedToken is ERC20Wrapper {
    using SafeERC20 for IERC20;

    uint8 internal immutable _decimalDiff;

    constructor(IERC20Metadata underlyingToken) 
    ERC20Wrapper(underlyingToken) 
    ERC20(string.concat("Wrapped ", underlyingToken.name()), string.concat("w", underlyingToken.symbol()))
    {
        _decimalDiff = decimals() - underlyingToken.decimals();
    }

    /**
     * @dev See {ERC20-decimals}.
     */
    function decimals() public view virtual override returns (uint8) {
        return 18;
    }

    /**
     * @dev Allow a user to deposit underlying tokens and mint the corresponding number of wrapped tokens.
     */
    function depositFor(address account, uint256 amount) public virtual override returns (bool) {
        address sender = _msgSender();
        require(sender != address(this), "ERC20Wrapper: wrapper can't deposit");
        underlying().safeTransferFrom(sender, address(this), amount);
        _mint(account, amount * 10**_decimalDiff);
        return true;
    }

    /**
     * @dev Allow a user to burn a number of wrapped tokens and withdraw the corresponding number of underlying tokens.
     */
    function withdrawTo(address account, uint256 amount) public virtual override returns (bool) {
        _burn(_msgSender(), amount);
        underlying().safeTransfer(account, amount / 10**_decimalDiff);
        return true;
    }
}