// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {BaseFallbackOracle} from "./BaseFallbackOracle.sol";

contract TbtcFallbackOracle is BaseFallbackOracle {

    address private constant TBTC_USD_AGG = 0xbeF434E2aCF0FBaD1f0579d2376fED0d1CfC4217;

    constructor() BaseFallbackOracle("tBTC / USD", TBTC_USD_AGG) {}
}