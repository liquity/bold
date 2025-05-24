// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC4626Oracle} from "./ERC4626Oracle.sol";

contract SfrxUsdOracle is ERC4626Oracle {

    uint256 private constant _CL_SFRXUSD_USD_HEARTBEAT = _24_HOURS;

    address private constant _CL_SFRXUSD_USD_PRICE_FEED = 0x9B4a96210bc8D9D55b1908B465D8B0de68B7fF83;
    address private constant _SFRXUSD = 0xcf62F905562626CfcDD2261162a51fd02Fc9c5b6;

    constructor()
        ERC4626Oracle(
            "sfrxUSD / USD", // description
            _CL_SFRXUSD_USD_HEARTBEAT, // heartbeat
            _SFRXUSD, // token
            _CL_SFRXUSD_USD_PRICE_FEED, // primary
            address(0) // fallback
        ) {}
}