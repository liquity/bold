// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AggregatorV3Interface, BaseFallbackOracle} from "./BaseFallbackOracle.sol";

contract FraxFallbackOracle is BaseFallbackOracle {

    uint256 private constant CL_FRAX_ETH_HEARTBEAT = _24_HOURS;
    uint256 private constant CL_ETH_USD_HEARTBEAT = _1_HOUR;

    AggregatorV3Interface public constant CL_FRAX_ETH_PRICE_FEED = AggregatorV3Interface(0x14d04Fff8D21bd62987a5cE9ce543d2F1edF5D3E);
    AggregatorV3Interface public constant CL_ETH_USD_PRICE_FEED = AggregatorV3Interface(0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419);

    constructor() BaseFallbackOracle("FRAX / USD", address(0)) {
        require(CL_FRAX_ETH_PRICE_FEED.decimals() == 18, "!frax_eth");
        require(CL_ETH_USD_PRICE_FEED.decimals() == 8, "!eth_usd");
    }

    function latestRoundData()
        public
        view
        override
        returns (uint80, int256, uint256, uint256, uint80)
    {
        if (!useFallback) return (0, 0, 0, 0, 0);

        (
            uint80 ethUsdRoundId,
            int256 ethUsdPrice,
            uint256 ethUsdStartedAt,
            uint256 ethUsdUpdatedAt,
            uint80 ethUsdAnsweredInRound
        ) = CL_ETH_USD_PRICE_FEED.latestRoundData();
        if (_isStale(ethUsdPrice, ethUsdUpdatedAt, CL_ETH_USD_HEARTBEAT)) {
            return (0, 0, 0, 0, 0);
        }

        (
            uint80 fraxEthRoundId,
            int256 fraxEthPrice,
            uint256 fraxEthStartedAt,
            uint256 fraxEthUpdatedAt,
            uint80 fraxEthAnsweredInRound
        ) = CL_FRAX_ETH_PRICE_FEED.latestRoundData();
        if (_isStale(fraxEthPrice, fraxEthUpdatedAt, CL_FRAX_ETH_HEARTBEAT)) {
            return (0, 0, 0, 0, 0);
        }

        int256 fraxUsdPrice = ethUsdPrice * fraxEthPrice / int256(WAD);

        return
            fraxEthUpdatedAt < ethUsdUpdatedAt ?
                (fraxEthRoundId, fraxUsdPrice, fraxEthStartedAt, fraxEthUpdatedAt, fraxEthAnsweredInRound) :
                (ethUsdRoundId, fraxUsdPrice, ethUsdStartedAt, ethUsdUpdatedAt, ethUsdAnsweredInRound);
    }
}