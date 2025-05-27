// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../src/Dependencies/MultiTokenWrapper.sol";
import "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

// Mock ERC20 token for testing
contract MockERC20 is ERC20 {
    uint8 private _decimals;

    constructor(string memory name, string memory symbol, uint8 decimals_) ERC20(name, symbol) {
        _decimals = decimals_;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }
}

contract MultiTokenWrapperTest is Test {
    MultiTokenWrapper public wrapper;
    MockERC20 public token6Decimals;
    MockERC20 public token8Decimals;
    address public owner;
    address public user;

    function setUp() public {
        owner = makeAddr("owner");
        user = makeAddr("user");
        
        vm.startPrank(owner);
        wrapper = new MultiTokenWrapper();
        
        // Create mock tokens with different decimals
        token6Decimals = new MockERC20("Test Token 6", "TEST6", 6);
        token8Decimals = new MockERC20("Test Token 8", "TEST8", 8);
        
        // Add underlying tokens
        wrapper.addUnderlying(address(token6Decimals));
        wrapper.addUnderlying(address(token8Decimals));
        
        // Mint some tokens to owner
        token6Decimals.mint(owner, 1000 * 10**6);
        token8Decimals.mint(owner, 1000 * 10**8);
        vm.stopPrank();
    }

    function test_InitialState() public {
        assertEq(wrapper.name(), "BitVault BTC");
        assertEq(wrapper.symbol(), "bvBTC");
        assertEq(wrapper.decimals(), 18);
        assertTrue(wrapper.isUnderlying(address(token6Decimals)));
        assertTrue(wrapper.isUnderlying(address(token8Decimals)));
        assertEq(wrapper.underlyingDecimals(address(token6Decimals)), 6);
        assertEq(wrapper.underlyingDecimals(address(token8Decimals)), 8);
    }

    function test_DepositAndWithdraw() public {
        uint256 depositAmount = 100 * 10**6; // 100 tokens with 6 decimals
        
        vm.startPrank(owner);
        token6Decimals.approve(address(wrapper), depositAmount);
        
        uint256 balanceBefore = token6Decimals.balanceOf(owner);
        wrapper.deposit(depositAmount, address(token6Decimals));
        uint256 balanceAfter = token6Decimals.balanceOf(owner);
        
        // Check token balances
        assertEq(balanceBefore - balanceAfter, depositAmount);
        assertEq(wrapper.balanceOf(owner), depositAmount * 10**12); // 18 - 6 = 12 decimals difference
        
        // Test withdrawal
        uint256 withdrawAmount = wrapper.balanceOf(owner);
        wrapper.withdraw(withdrawAmount, address(token6Decimals));
        
        assertEq(wrapper.balanceOf(owner), 0);
        assertEq(token6Decimals.balanceOf(owner), balanceBefore);
        vm.stopPrank();
    }

    function test_AddAndRemoveUnderlying() public {
        MockERC20 newToken = new MockERC20("New Token", "NEW", 12);
        
        vm.startPrank(owner);
        wrapper.addUnderlying(address(newToken));
        assertTrue(wrapper.isUnderlying(address(newToken)));
        assertEq(wrapper.underlyingDecimals(address(newToken)), 12);
        
        wrapper.removeUnderlying(address(newToken));
        assertFalse(wrapper.isUnderlying(address(newToken)));
        vm.stopPrank();
    }

    function testFail_DepositUnsupportedToken() public {
        MockERC20 unsupportedToken = new MockERC20("Unsupported", "UNS", 18);
        
        vm.startPrank(owner);
        unsupportedToken.mint(owner, 1000 * 10**18);
        unsupportedToken.approve(address(wrapper), 100 * 10**18);
        
        wrapper.deposit(100 * 10**18, address(unsupportedToken));
        vm.stopPrank();
    }

    function testFail_WithdrawUnsupportedToken() public {
        vm.startPrank(owner);
        wrapper.withdraw(100 * 10**18, address(0));
        vm.stopPrank();
    }

    function testFail_AddExistingUnderlying() public {
        vm.startPrank(owner);
        wrapper.addUnderlying(address(token6Decimals));
        vm.stopPrank();
    }

    function testFail_RemoveNonExistentUnderlying() public {
        vm.startPrank(owner);
        wrapper.removeUnderlying(address(0));
        vm.stopPrank();
    }

    function testFail_NonOwnerAddUnderlying() public {
        vm.startPrank(user);
        wrapper.addUnderlying(address(0));
        vm.stopPrank();
    }

    function testFail_NonOwnerRemoveUnderlying() public {
        vm.startPrank(user);
        wrapper.removeUnderlying(address(token6Decimals));
        vm.stopPrank();
    }
} 