// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-contracts/contracts/access/Ownable.sol";

contract StMEMEToken is ERC20, Ownable {
    constructor(uint256 initialSupply) ERC20("Staked Meme", "stMEME") Ownable(msg.sender) {
        _mint(msg.sender, initialSupply);
    }

    // Additional functions for reward distribution might be added later,
    // for now, it's a standard Ownable ERC20.
}
