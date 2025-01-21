// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {BaseFallbackOracle} from "./BaseFallbackOracle.sol";

contract WbtcFallbackOracle is BaseFallbackOracle {

    address private constant WBTC_USD_AGG = 0xBe83fD842DB4937C0C3d15B2aBA6AF7E854f8dcb;

    constructor() BaseFallbackOracle("WBTC / USD", WBTC_USD_AGG) {}
}