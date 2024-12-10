// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "./ChainlinkPriceFeedBase.sol";
import "../Interfaces/ICompositeChainlinkPriceFeed.sol";

// import "forge-std/console2.sol";

contract CompositeChainlinkPriceFeed is
    ChainlinkPriceFeedBase,
    ICompositeChainlinkPriceFeed
{
    constructor(
        address _owner,
        address _ethUsdOracleAddress,
        address _tokenEthOracleAddress,
        uint256 _ethUsdStalenessThreshold,
        uint256 _tokenEthStalenessThreshold
    )
        ChainlinkPriceFeedBase(
            _owner,
            _ethUsdOracleAddress,
            _ethUsdStalenessThreshold
        )
    {
        // Store token-ETH oracle
        tokenEthOracle.aggregator = AggregatorV3Interface(
            _tokenEthOracleAddress
        );
        tokenEthOracle.stalenessThreshold = _tokenEthStalenessThreshold;
        tokenEthOracle.decimals = tokenEthOracle.aggregator.decimals();

        _fetchPricePrimary();

        // Check the oracle didn't already fail
        assert(priceSource == PriceSource.primary);
    }

    Oracle public tokenEthOracle;

    function _fetchPricePrimary() internal returns (uint256, bool) {
        assert(priceSource == PriceSource.primary);
        (uint256 ethUsdPrice, bool ethUsdOracleDown) = _getOracleAnswer(
            usdOracle
        );
        (uint256 tokenEthPrice, bool tokenEthOracleDown) = _getOracleAnswer(
            tokenEthOracle
        );

        if (ethUsdOracleDown) {
            return (
                _shutDownAndSwitchToLastGoodPrice(
                    address(usdOracle.aggregator)
                ),
                true
            );
        }
        if (tokenEthOracleDown) {
            return (
                _shutDownAndSwitchToLastGoodPrice(
                    address(tokenEthOracle.aggregator)
                ),
                true
            );
        }

        uint256 tokenUsdPrice = (ethUsdPrice * tokenEthPrice) / 1e18;
        lastGoodPrice = tokenUsdPrice;

        return (tokenUsdPrice, false);
    }

    // Returns:
    // - The price, using the current price calculation
    // - A bool that is true if:
    // --- a) the system was not shut down prior to this call, and
    // --- b) an oracle or exchange rate contract failed during this call.
    function fetchPrice() public returns (uint256, bool) {
        // If branch is live and the primary oracle setup has been working, try to use it
        if (priceSource == PriceSource.primary) return _fetchPricePrimary();

        assert(priceSource == PriceSource.lastGoodPrice);
        return (lastGoodPrice, false);
    }

    function fetchRedemptionPrice() external returns (uint256, bool) {
        // Use same price for redemption as all other ops in branch
        return fetchPrice();
    }
}
