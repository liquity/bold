// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "./CompositePriceFeed.sol";
import "../Interfaces/IWEETH.sol";
import "../Interfaces/IWEETHPriceFeed.sol";

contract WEETHPriceFeed is CompositePriceFeed, IWEETHPriceFeed {
    Oracle public weethEthOracle;

    uint256 public constant WEETH_ETH_DEVIATION_THRESHOLD = 1e16; // 1%

    constructor(
        address _owner,
        address _ethUsdOracleAddress,
        address _weethEthOracleAddress,
        address _weethTokenAddress,
        uint256 _ethUsdStalenessThreshold,
        uint256 _weethEthStalenessThreshold
    ) CompositePriceFeed(_owner, _ethUsdOracleAddress, _weethTokenAddress, _ethUsdStalenessThreshold) {
        weethEthOracle.aggregator = AggregatorV3Interface(_weethEthOracleAddress);
        weethEthOracle.stalenessThreshold = _weethEthStalenessThreshold;
        weethEthOracle.decimals = weethEthOracle.aggregator.decimals();

        _fetchPricePrimary(false);

        // Check the oracle didn't already fail
        assert(priceSource == PriceSource.primary);
    }

    function _getCanonicalRate() internal view override returns (uint256, bool) {
        uint256 gasBefore = gasleft();

        try IWEETH(rateProviderAddress).getExchangeRate() returns (uint256 ethPerWeeth) {
            if (ethPerWeeth == 0) return (0, true);
            return (ethPerWeeth, false);
        } catch {
            if (gasleft() <= gasBefore / 64) revert InsufficientGasForExternalCall();
            return (0, true);
        }
    }
} 