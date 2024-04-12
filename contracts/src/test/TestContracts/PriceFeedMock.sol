pragma solidity 0.8.18;

import "./Interfaces/IPriceFeedMock.sol";
import "../../PriceFeed.sol";

contract PriceFeedMock is IPriceFeedMock {
    uint256 private PRICE;

    function setPrice(uint256 _price) external {
        PRICE = _price;
    }

    function getPrice() external view returns (uint256 _price) {
        return PRICE;
    }

    function fetchPrice() external view returns (uint256) {
        return PRICE;
    }
}
