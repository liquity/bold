// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {

    uint8 _decimals = 18;

    constructor(string memory _name, string memory _symbol, uint8 decimals_) ERC20(_name, _symbol) {
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amt) external {
        _mint(to, amt);
    }
}