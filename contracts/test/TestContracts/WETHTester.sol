// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import {ERC20Faucet} from "./ERC20Faucet.sol";
import "src/Interfaces/IWETH.sol";

contract WETHTester is ERC20Faucet, IWETH {
    event Deposit(address indexed dst, uint256 wad);
    event Withdrawal(address indexed src, uint256 wad);

    mapping (address => bool) public whitelisted;

    constructor(uint256 _tapAmount, uint256 _tapPeriod)
        ERC20Faucet("Wrapped Ether Tester", "WETH", _tapAmount, _tapPeriod)
    {}

    receive() external payable {
        deposit();
    }

    function whitelist(address _account) external onlyOwner {
        whitelisted[_account] = true;
    }

    function deposit() public payable {
        _requireWhitelisted();

        _mint(msg.sender, msg.value);
        emit Deposit(msg.sender, msg.value);
    }

    function withdraw(uint256 wad) public {
        _requireWhitelisted();

        require(balanceOf(msg.sender) >= wad);
        _burn(msg.sender, wad);
        payable(msg.sender).transfer(wad);
        emit Withdrawal(msg.sender, wad);
    }

    function _requireWhitelisted() internal view {
        require(whitelisted[msg.sender], "Not whitelisted");
    }
}
