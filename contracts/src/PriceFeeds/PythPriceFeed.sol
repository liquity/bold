// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "./PythPriceFeedBase.sol";

contract PythPriceFeed is PythPriceFeedBase {
    constructor(
        address _owner,
        address _pythContract,
        bytes32 _priceFeedId,
        uint256 _priceAgeThreshold
    )
        PythPriceFeedBase(
            _owner,
            _pythContract,
            _priceFeedId,
            _priceAgeThreshold
        )
    {
        _fetchPrice();
        assert(priceSource == PriceSource.primary);
    }

    // Returns:
    // - The price, using the current price calculation
    // - A bool that is true if:
    // --- a) the system was not shut down prior to this call, and
    // --- b) an oracle or exchange rate contract failed during this call.
    function fetchPrice() public returns (uint256, bool) {
        if (priceSource == PriceSource.primary) {
            return _fetchPrice();
        }

        assert(priceSource == PriceSource.lastGoodPrice);
        return (lastGoodPrice, false);
    }

    function fetchRedemptionPrice() external returns (uint256, bool) {
        return fetchPrice();
    }

    function _fetchPrice() internal returns (uint256, bool) {
        assert(priceSource == PriceSource.primary);
        (uint256 price, bool oracleDown) = _getOracleAnswer(pyth);
        if (oracleDown) {
            return (
                _shutDownAndSwitchToLastGoodPrice(
                    address(pyth.pythContract),
                    pyth.feedId
                ),
                true
            );
        }
        lastGoodPrice = price;
        return (price, false);
    }
}
