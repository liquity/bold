// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {BaseFallbackOracle} from "./BaseFallbackOracle.sol";

contract CrvUsdFallbackOracle is BaseFallbackOracle {

    address private constant CRVUSD_USD_AGG = 0x18672b1b0c623a30089A280Ed9256379fb0E4E62;

    constructor() BaseFallbackOracle("crvUSD / USD", CRVUSD_USD_AGG) {}
}