// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "./MainnetPriceFeedBase.sol";
import "../Interfaces/IWSTETH.sol";
import "../Interfaces/IWSTETHPriceFeed.sol";

contract WSTETHPriceFeed is MainnetPriceFeedBase, IWSTETHPriceFeed {
    Oracle public stEthUsdOracle;
    IWSTETH public wstETH;

    constructor(
        address _owner,
        address _stEthUsdOracleAddress,
        uint256 _stEthUsdStalenessThreshold,
        address _wstETHAddress
    ) MainnetPriceFeedBase(_owner) {
        stEthUsdOracle.aggregator = AggregatorV3Interface(_stEthUsdOracleAddress);
        stEthUsdOracle.stalenessThreshold = _stEthUsdStalenessThreshold;
        stEthUsdOracle.decimals = stEthUsdOracle.aggregator.decimals();

        wstETH = IWSTETH(_wstETHAddress);

        // Check the STETH-USD aggregator has the expected 8 decimals
        assert(stEthUsdOracle.decimals == 8);

        _fetchPrice();

        // Check the oracle didn't already fail
        assert(priceFeedDisabled == false);
    }

    function _fetchPrice() internal override returns (uint256, bool) {
        (uint256 stEthUsdPrice, bool stEthUsdOracleDown) = _getOracleAnswer(stEthUsdOracle);

        // If one of Chainlink's responses was invalid in this transaction, disable this PriceFeed and
        // return the last good WSTETH-USD price calculated
        if (stEthUsdOracleDown) {return (_disableFeedAndShutDown(address(stEthUsdOracle.aggregator)), true);}

        // Calculate WSTETH-USD price: USD_per_WSTETH = USD_per_STETH * STETH_per_WSTETH
        uint256 wstEthUsdPrice = stEthUsdPrice * wstETH.stEthPerToken() / 1e18;

        lastGoodPrice = wstEthUsdPrice;

        return (wstEthUsdPrice, false);
    }
}
