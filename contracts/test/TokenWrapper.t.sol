// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {TokenWrapper} from "src/Dependencies/TokenWrapper.sol";

import "forge-std/Test.sol";

contract TestToken is ERC20 {
    uint8 internal _decimals;

    constructor(uint8 dec, string memory name, string memory symbol) ERC20(name, symbol) {
        _decimals = dec;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }
}

contract TokenWrapperTest is Test {
    IERC20Metadata public token18Decimals;
    IERC20Metadata public token8Decimals;
    TokenWrapper public wrapper18Decimals;
    TokenWrapper public wrapper8Decimals;

    function setUp() public {
        token18Decimals = IERC20Metadata(new ERC20("Ethereum", "ETH"));
        token8Decimals = IERC20Metadata(new TestToken(8, "Bitcoin", "BTC"));

        wrapper18Decimals = new TokenWrapper(token18Decimals);
        wrapper8Decimals = new TokenWrapper(token8Decimals);
    }

    function test_name_symbol() public {
        assertEq(IERC20Metadata(address(wrapper18Decimals)).name(), "Wrapped Ethereum");
        assertEq(IERC20Metadata(address(wrapper18Decimals)).symbol(), "wETH");

        assertEq(IERC20Metadata(address(wrapper8Decimals)).name(), "Wrapped Bitcoin");
        assertEq(IERC20Metadata(address(wrapper8Decimals)).symbol(), "wBTC");
    }

    function test_wrap_unwrap_18_decimals_token() public {
        address user = address(1234);
        uint256 amount = 10e18;

        deal(address(token18Decimals), user, amount);

        vm.startPrank(user);

        token18Decimals.approve(address(wrapper18Decimals), type(uint256).max);

        // wrap
        wrapper18Decimals.deposit(amount);

        assertEq(token18Decimals.balanceOf(user), 0);
        assertEq(wrapper18Decimals.balanceOf(user), amount);

        // unwrap
        wrapper18Decimals.withdraw(amount);

        assertEq(token18Decimals.balanceOf(user), amount);
        assertEq(wrapper18Decimals.balanceOf(user), 0);

        vm.stopPrank();
    }

    function test_wrap_unwrap_8_decimals_token() public {
        address user = address(1234);
        uint256 tokenAmount = 10e18;
        uint256 wrappedAmount = 10e18 * 10 ** 10;

        deal(address(token8Decimals), user, tokenAmount);

        vm.startPrank(user);

        token8Decimals.approve(address(wrapper8Decimals), type(uint256).max);

        // wrap
        wrapper8Decimals.deposit(tokenAmount);

        assertEq(token8Decimals.balanceOf(user), 0);
        assertEq(wrapper8Decimals.balanceOf(user), wrappedAmount);

        // unwrap
        wrapper8Decimals.withdraw(wrappedAmount);

        assertEq(token8Decimals.balanceOf(user), tokenAmount);
        assertEq(wrapper8Decimals.balanceOf(user), 0);

        vm.stopPrank();
    }

    function test_revert_max_18_decimals_underlying() public {
        IERC20Metadata token30Decimals = IERC20Metadata(new TestToken(30, "test", "test"));

        vm.expectRevert("Max 18 underlying decimals");
        new TokenWrapper(token30Decimals);
    }
}
