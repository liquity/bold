// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AggregatorV3Interface, BaseOracle} from "./BaseOracle.sol";

interface ISfrxETHDualOracle {
    function getPrices() external view returns (bool _isBadData, uint256 _priceLow, uint256 _priceHigh);
}

contract SfrxEthOracle is BaseOracle {

    uint256 private constant _MAX_ORACLE_DEVIATION = 5e3; // 5%
    uint256 private constant _DEVIATION_PRECISION = 1e5;

    uint256 private constant _CL_ETH_USD_HEARTBEAT = _1_HOUR;

    AggregatorV3Interface public immutable FALLBACK_ORACLE;

    AggregatorV3Interface public constant CL_ETH_USD_PRICE_FEED = AggregatorV3Interface(0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419);

    ISfrxETHDualOracle public constant SFRX_ETH_ORACLE = ISfrxETHDualOracle(0x584902BCe4282003E420Cf5b7ae5063D6C1c182a);

    constructor(address _fallback) BaseOracle("sfrxETH / USD") {
        FALLBACK_ORACLE = AggregatorV3Interface(_fallback);
    }

    function latestRoundData()
        external
        view
        override
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        (roundId, answer, startedAt, updatedAt, answeredInRound) = getSfrxEthPriceFromDualOracle();
        if (answer == 0 && address(FALLBACK_ORACLE) != address(0)) {
            (roundId, answer, startedAt, updatedAt, answeredInRound) = FALLBACK_ORACLE.latestRoundData();
        }
        return (roundId, answer, startedAt, updatedAt, answeredInRound);
    }

    function getSfrxEthPriceFromDualOracle()
    public
    view
    returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        (bool isBadData, uint256 sfrxEthEthPriceLow, uint256 sfrxEthEthPriceHigh) = SFRX_ETH_ORACLE.getPrices();
        bool isDeviationTooHigh =
            (_DEVIATION_PRECISION * (sfrxEthEthPriceHigh - sfrxEthEthPriceLow)) / sfrxEthEthPriceHigh > _MAX_ORACLE_DEVIATION;
        if (isBadData || isDeviationTooHigh) return (0, 0, 0, 0, 0);

        (
            uint80 ethUsdRoundId,
            int256 ethUsdPrice,
            uint256 ethUsdStartedAt,
            uint256 ethUsdUpdatedAt,
            uint80 ethUsdAnsweredInRound
        ) = CL_ETH_USD_PRICE_FEED.latestRoundData();
        if (_isStale(ethUsdPrice, ethUsdUpdatedAt, _CL_ETH_USD_HEARTBEAT)) return (0, 0, 0, 0, 0);

        int256 sfrxEthUsdPrice = int256(sfrxEthEthPriceHigh) * ethUsdPrice / int256(_WAD);

        return (ethUsdRoundId, sfrxEthUsdPrice, ethUsdStartedAt, ethUsdUpdatedAt, ethUsdAnsweredInRound);
    }
}
