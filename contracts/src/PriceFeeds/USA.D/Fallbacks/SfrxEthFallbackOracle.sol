// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {BaseFallbackOracle} from "./BaseFallbackOracle.sol";

contract SfrxEthFallbackOracle is BaseFallbackOracle {

    address private constant _SFRX_ETH_USD_AGG = 0x28d7880B5b67fB4a0B1c6Ed6c33c33f365113C29;

    constructor() BaseFallbackOracle("sfrxETH / USD", _SFRX_ETH_USD_AGG) {}
}