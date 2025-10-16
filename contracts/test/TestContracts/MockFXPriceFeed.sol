// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "./Interfaces/IMockFXPriceFeed.sol";

/*
* Mock FXPriceFeed contract for testing purposes.
* The price is simply set manually and saved in a state variable.
*/
contract MockFXPriceFeed is IMockFXPriceFeed {

    string private _revertMsg = "MockFXPriceFeed: no valid price";
    uint256 private _price = 200 * 1e18;
    bool private _hasValidPrice = true;

    function getPrice() external view override returns (uint256) {
        return _price;
    }

    function setValidPrice(bool valid) external {
        _hasValidPrice = valid;
    }

    function setPrice(uint256 price) external {
        _price = price;
    }

    function fetchPrice() external view override returns (uint256) {
        require(_hasValidPrice, _revertMsg);

        return _price;
    }

    function REVERT_MSG() external view override returns (string memory) {
        return _revertMsg;
    }
}
