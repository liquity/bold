// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "src/Interfaces/IPriceFeed.sol";

interface IMockFXPriceFeed is IPriceFeed {
    function REVERT_MSG() external view returns (string memory);
    function setPrice(uint256 _price) external;
    function getPrice() external view returns (uint256);
    function setValidPrice(bool valid) external;
}
