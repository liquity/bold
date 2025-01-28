// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "./CompositePriceFeed.sol";
import "../Interfaces/IEZETH.sol";
import "../Interfaces/IEZETHPriceFeed.sol";

contract EZETHPriceFeed is CompositePriceFeed, IEZETHPriceFeed {
    Oracle public ezethEthOracle;

    uint256 public constant EZETH_ETH_DEVIATION_THRESHOLD = 1e16; // 1%

    constructor(
        address _owner,
        address _ethUsdOracleAddress,
        address _ezethEthOracleAddress,
        address _ezethTokenAddress,
        uint256 _ethUsdStalenessThreshold,
        uint256 _ezethEthStalenessThreshold
    ) CompositePriceFeed(_owner, _ethUsdOracleAddress, _ezethTokenAddress, _ethUsdStalenessThreshold) {
        ezethEthOracle.aggregator = AggregatorV3Interface(_ezethEthOracleAddress);
        ezethEthOracle.stalenessThreshold = _ezethEthStalenessThreshold;
        ezethEthOracle.decimals = ezethEthOracle.aggregator.decimals();

        _fetchPricePrimary(false);

        // Check the oracle didn't already fail
        assert(priceSource == PriceSource.primary);
    }

    function _getCanonicalRate() internal view override returns (uint256, bool) {
        uint256 gasBefore = gasleft();

        try IEZETH(rateProviderAddress).getExchangeRate() returns (uint256 ethPerEzeth) {
            if (ethPerEzeth == 0) return (0, true);
            return (ethPerEzeth, false);
        } catch {
            if (gasleft() <= gasBefore / 64) revert InsufficientGasForExternalCall();
            return (0, true);
        }
    }
} 