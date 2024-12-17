// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import "@pythnetwork/pyth-sdk-solidity/PythUtils.sol";

import "../Dependencies/Ownable.sol";
import "../Interfaces/IPythPriceFeed.sol";
import "../BorrowerOperations.sol";

contract PythPriceFeed is IPythPriceFeed, Ownable {
    IPyth public pythContract;
    bytes32 public priceFeedId;
    uint256 public priceAgeThreshold;
    uint256 internal _lastGoodPrice;
    IBorrowerOperations borrowerOperations;

    constructor(
        address _owner,
        address _pythContract,
        bytes32 _priceFeedId,
        uint256 _priceAgeThreshold
    ) Ownable(_owner) {
        pythContract = IPyth(_pythContract);
        priceFeedId = _priceFeedId;
        priceAgeThreshold = _priceAgeThreshold;
    }

    // Returns:
    // - The price, using the current price calculation
    // - A bool that is true if:
    // --- a) the system was not shut down prior to this call, and
    // --- b) an oracle or exchange rate contract failed during this call.
    function fetchPrice() public returns (uint256, bool) {
        return _fetchPrice();
    }

    function fetchRedemptionPrice() external returns (uint256, bool) {
        return _fetchPrice();
    }

    function lastGoodPrice() external view returns (uint256) {
        return _lastGoodPrice;
    }

    function _fetchPrice() internal returns (uint256, bool) {
        PythStructs.Price memory price = pythContract.getPriceNoOlderThan(
            priceFeedId,
            priceAgeThreshold
        );
        uint256 scaledPrice = PythUtils.convertToUint(
            price.price,
            price.expo,
            18
        );
        _lastGoodPrice = scaledPrice;
        return (scaledPrice, false);
    }

    function setAddresses(address _borrowOperationsAddress) external onlyOwner {
        borrowerOperations = IBorrowerOperations(_borrowOperationsAddress);

        _renounceOwnership();
    }
}
