// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "../Dependencies/LiquityMath.sol";
import "./MainnetPriceFeedBase.sol";

// import "forge-std/console2.sol";

// The CompositePriceFeed is used for feeds that incorporate both a market price oracle (e.g. STETH-USD, or RETH-ETH)
// and an LST canonical rate (e.g. WSTETH:STETH, or RETH:ETH).
abstract contract CompositePriceFeed is MainnetPriceFeedBase {
    address public rateProviderAddress;

    constructor(
        address _ethUsdOracleAddress,
        address _rateProviderAddress,
        uint256 _ethUsdStalenessThreshold,
        address _borrowerOperationsAddress
    ) MainnetPriceFeedBase(_ethUsdOracleAddress, _ethUsdStalenessThreshold, _borrowerOperationsAddress) {
        // Store rate provider
        rateProviderAddress = _rateProviderAddress;
    }

    // Returns:
    // - The price, using the current price calculation
    // - A bool that is true if:
    // --- a) the system was not shut down prior to this call, and
    // --- b) an oracle or exchange rate contract failed during this call.
    function fetchPrice() public returns (uint256, bool) {
        // If branch is live and the primary oracle setup has been working, try to use it
        if (priceSource == PriceSource.primary) return _fetchPricePrimary(false);

        return _fetchPriceDuringShutdown();
    }

    function fetchRedemptionPrice() external returns (uint256, bool) {
        // If branch is live and the primary oracle setup has been working, try to use it
        if (priceSource == PriceSource.primary) return _fetchPricePrimary(true);

        return _fetchPriceDuringShutdown();
    }

    function _shutDownAndSwitchToETHUSDxCanonical(address _failedOracleAddr, uint256 _ethUsdPrice)
        internal
        returns (uint256)
    {
        // Shut down the branch
        borrowerOperations.shutdownFromOracleFailure();

        priceSource = PriceSource.ETHUSDxCanonical;

        emit ShutDownFromOracleFailure(_failedOracleAddr);
        return _fetchPriceETHUSDxCanonical(_ethUsdPrice);
    }

    function _fetchPriceDuringShutdown() internal returns (uint256, bool) {
        // When branch is already shut down and using ETH-USD * canonical_rate, try to use that
        if (priceSource == PriceSource.ETHUSDxCanonical) {
            (uint256 ethUsdPrice, bool ethUsdOracleDown) = _getOracleAnswer(ethUsdOracle);
            //... but if the ETH-USD oracle *also* fails here, switch to using the lastGoodPrice
            if (ethUsdOracleDown) {
                // No need to shut down, since branch already is shut down
                priceSource = PriceSource.lastGoodPrice;
                return (lastGoodPrice, false);
            } else {
                return (_fetchPriceETHUSDxCanonical(ethUsdPrice), false);
            }
        }

        // Otherwise when branch is shut down and already using the lastGoodPrice, continue with it
        assert(priceSource == PriceSource.lastGoodPrice);
        return (lastGoodPrice, false);
    }

    // Only called if the primary LST oracle has failed, branch has shut down,
    // and we've switched to using: ETH-USD * canonical_rate.
    function _fetchPriceETHUSDxCanonical(uint256 _ethUsdPrice) internal returns (uint256) {
        assert(priceSource == PriceSource.ETHUSDxCanonical);
        // Get the underlying_per_LST canonical rate directly from the LST contract
        (uint256 lstRate, bool exchangeRateIsDown) = _getCanonicalRate();

        // If the exchange rate contract is down, switch to (and return) lastGoodPrice.
        if (exchangeRateIsDown) {
            priceSource = PriceSource.lastGoodPrice;
            return lastGoodPrice;
        }

        // Calculate the canonical LST-USD price: USD_per_LST = USD_per_ETH * underlying_per_LST
        uint256 lstUsdCanonicalPrice = _ethUsdPrice * lstRate / 1e18;

        uint256 bestPrice = LiquityMath._min(lstUsdCanonicalPrice, lastGoodPrice);

        lastGoodPrice = bestPrice;

        return bestPrice;
    }

    function _withinDeviationThreshold(uint256 _priceToCheck, uint256 _referencePrice, uint256 _deviationThreshold)
        internal
        pure
        returns (bool)
    {
        // Calculate the price deviation of the oracle market price relative to the canonical price
        uint256 max = _referencePrice * (DECIMAL_PRECISION + _deviationThreshold) / 1e18;
        uint256 min = _referencePrice * (DECIMAL_PRECISION - _deviationThreshold) / 1e18;

        return _priceToCheck >= min && _priceToCheck <= max;
    }

    // An individual Pricefeed instance implements _fetchPricePrimary according to the data sources it uses. Returns:
    // - The price
    // - A bool indicating whether a new oracle failure or exchange rate failure was detected in the call
    function _fetchPricePrimary(bool _isRedemption) internal virtual returns (uint256, bool);

    // Returns the LST exchange rate and a bool indicating whether the exchange rate failed to return a valid rate.
    // Implementation depends on the specific LST.
    function _getCanonicalRate() internal view virtual returns (uint256, bool);
}
