// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {BaseFallbackOracle} from "./BaseFallbackOracle.sol";

contract CbbtcFallbackOracle is BaseFallbackOracle {

    address private constant _CBBTC_USD_AGG = 0x4710A77a0E0f4c7b0E11CDeB74acB042e62B8d22;

    constructor() BaseFallbackOracle("cbBTC / USD", _CBBTC_USD_AGG) {}
}