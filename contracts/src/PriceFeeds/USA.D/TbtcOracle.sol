// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AggregatorV3Interface, BaseOracle} from "./BaseOracle.sol";

contract TbtcOracle is BaseOracle {

    AggregatorV3Interface public immutable FALLBACK_ORACLE;

    uint256 private constant CL_TBTC_BTC_HEARTBEAT = _24_HOURS;

    AggregatorV3Interface public constant CL_TBTC_BTC_PRICE_FEED = AggregatorV3Interface(0x8350b7De6a6a2C1368E7D4Bd968190e13E354297);

    constructor(address _fallback) BaseOracle("tBTC / USD") {
        FALLBACK_ORACLE = AggregatorV3Interface(_fallback);
    }

    function latestRoundData()
        external
        view
        override
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        (roundId, answer, startedAt, updatedAt, answeredInRound) = CL_TBTC_BTC_PRICE_FEED.latestRoundData();
        if (_isStale(answer, updatedAt, CL_TBTC_BTC_HEARTBEAT) && address(FALLBACK_ORACLE) != address(0)) {
            (roundId, answer, startedAt, updatedAt, answeredInRound) = FALLBACK_ORACLE.latestRoundData();
        }
        return (roundId, answer, startedAt, updatedAt, answeredInRound);
    }
}
