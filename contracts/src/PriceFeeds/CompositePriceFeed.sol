// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "../Dependencies/LiquityMath.sol";
import "./MainnetPriceFeedBase.sol";
import "../Interfaces/ICompositePriceFeed.sol";

// import "forge-std/console2.sol";

// Composite PriceFeed: outputs an LST-USD price derived from two external price Oracles: LST-ETH, and ETH-USD.
// Used where the LST token is non-rebasing (as per rETH, osETH, ETHx, etc).
contract CompositePriceFeed is MainnetPriceFeedBase, ICompositePriceFeed {
    Oracle public lstEthOracle;
    Oracle public ethUsdOracle;

    address public rateProviderAddress;

    constructor(
        address _owner,
        address _ethUsdOracleAddress,
        address _lstEthOracleAddress,
        address _rateProviderAddress,
        uint256 _ethUsdStalenessThreshold,
        uint256 _lstEthStalenessThreshold
    ) MainnetPriceFeedBase(_owner) {
        // Store ETH-USD oracle
        ethUsdOracle.aggregator = AggregatorV3Interface(_ethUsdOracleAddress);
        ethUsdOracle.stalenessThreshold = _ethUsdStalenessThreshold;
        ethUsdOracle.decimals = ethUsdOracle.aggregator.decimals();
        assert(ethUsdOracle.decimals == 8);

        // Store LST-ETH oracle
        lstEthOracle.aggregator = AggregatorV3Interface(_lstEthOracleAddress);
        lstEthOracle.stalenessThreshold = _lstEthStalenessThreshold;
        lstEthOracle.decimals = lstEthOracle.aggregator.decimals();

        // Store rate provider
        rateProviderAddress = _rateProviderAddress;

        _fetchPrice();

        // Check an oracle didn't already fail
        assert(priceFeedDisabled == false);
    }

    function _fetchPrice() internal override returns (uint256, bool) {
        (uint256 ethUsdPrice, bool ethUsdOracleDown) = _getOracleAnswer(ethUsdOracle);
        (uint256 lstEthPrice, bool lstEthOracleDown) = _getOracleAnswer(lstEthOracle);

        // If one of Chainlink's responses was invalid in this transaction, disable this PriceFeed and
        // return the last good LST-USD price calculated
        if (ethUsdOracleDown) {return (_disableFeedAndShutDown(address(ethUsdOracle.aggregator)), true);}
        if (lstEthOracleDown) {return (_disableFeedAndShutDown(address(lstEthOracle.aggregator)), true);}

        // Calculate the market LST-USD price: USD_per_LST = USD_per_ETH * ETH_per_LST
        uint256 lstUsdMarketPrice = ethUsdPrice * lstEthPrice / 1e18;

        // Get the ETH_per_LST canonical rate directly from the LST contract
        // TODO: Should we also shutdown if the call to the canonical rate reverts, or returns 0?
        uint256 lstEthRate = _getCanonicalRate();

        // Calculate the canonical LST-USD price: USD_per_LST = USD_per_ETH * ETH_per_LST
        uint256 lstUsdCanonicalPrice = ethUsdPrice * lstEthRate / 1e18;

        // Take the minimum of (market, canonical) in order to mitigate against upward market price manipulation
        uint256 lstUsdPrice = LiquityMath._min(lstUsdMarketPrice, lstUsdCanonicalPrice);

        lastGoodPrice = lstUsdPrice;

        return (lstUsdPrice, false);
    }

    // Returns the ETH_per_LST as from the LST smart contract. Implementation depends on the specific LST.
    function _getCanonicalRate() internal view virtual returns (uint256) {}
}
