// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "../Dependencies/Ownable.sol";

contract PushPriceFeed is Ownable{
    
    uint256 public lastGoodPrice;

    constructor(address _owner) Ownable(_owner) {
    }

    function fetchPrice() external returns (uint256, bool) {
        return (lastGoodPrice, true);
    }

    function setPrice(uint256 _price) external onlyOwner {
        lastGoodPrice = _price;
    }
}
