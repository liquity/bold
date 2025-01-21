// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC4626Oracle} from "./ERC4626Oracle.sol";

contract ScrvUsdOracle is ERC4626Oracle {

    uint256 private constant CL_CRVUSD_USD_HEARTBEAT = _24_HOURS;

    address private constant CL_CRVUSD_USD_PRICE_FEED = 0xEEf0C605546958c1f899b6fB336C20671f9cD49F;
    address private constant SCRVUSD = 0x0655977FEb2f289A4aB78af67BAB0d17aAb84367;

    constructor(address _fallback)
        ERC4626Oracle(
            "scrvUSD / USD", // description
            CL_CRVUSD_USD_HEARTBEAT, // heartbeat
            SCRVUSD, // token
            CL_CRVUSD_USD_PRICE_FEED, // primary
            _fallback // fallback
        ) {}
}
