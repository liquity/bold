// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AggregatorV3Interface, BaseOracle} from "./BaseOracle.sol";

contract SusdeOracle is BaseOracle {

    uint256 private constant _CL_SUSDE_USD_HEARTBEAT = _24_HOURS;

    AggregatorV3Interface public constant CL_SUSDE_USD_PRICE_FEED = AggregatorV3Interface(0xFF3BC18cCBd5999CE63E788A1c250a88626aD099);

    constructor() BaseOracle("sUSDe / USD") {}

    function latestRoundData()
        external
        view
        override
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        (roundId, answer, startedAt, updatedAt, answeredInRound) = CL_SUSDE_USD_PRICE_FEED.latestRoundData();
        return (roundId, answer, startedAt, updatedAt, answeredInRound);
    }
}