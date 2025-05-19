// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "../Dependencies/Ownable.sol";
import "../Interfaces/IPriceFeed.sol";
import "../BorrowerOperations.sol";

contract InterchangeablePriceFeed is Ownable, IPriceFeed {

    uint256 public lastGoodPrice;
    
    IBorrowerOperations public borrowerOperations;
    IPriceFeed public priceFeed;

    constructor(address _owner, address _priceFeed) Ownable(_owner) {
        priceFeed = IPriceFeed(_priceFeed);
    }

    function fetchPrice() external returns (uint256, bool) {
        return _fetchPrice();
    }

    function fetchRedemptionPrice() external returns (uint256, bool) {
        // Use same price for redemption as all other ops in WETH branch
        return _fetchPrice();
    }

    function _fetchPrice() internal returns (uint256, bool) {
        (uint256 price, bool isNewOracleFailure) = priceFeed.fetchPrice();

        if (isNewOracleFailure) {
            return (lastGoodPrice, isNewOracleFailure);
        } else {
            lastGoodPrice = price;
            return (price, isNewOracleFailure);
        }
    }

    function setAddresses(address _borrowOperationsAddress) external onlyOwner {
        borrowerOperations = IBorrowerOperations(_borrowOperationsAddress);

        _renounceOwnership();
    }

    function setPriceFeed(address _priceFeed) external onlyOwner {
        priceFeed = IPriceFeed(_priceFeed);
    }
}
