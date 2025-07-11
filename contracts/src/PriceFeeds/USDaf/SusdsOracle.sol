// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC4626Oracle} from "./ERC4626Oracle.sol";

contract SusdsOracle is ERC4626Oracle {

    uint256 private constant _CL_USDS_USD_HEARTBEAT = _24_HOURS;

    address private constant _CL_USDS_USD_PRICE_FEED = 0xfF30586cD0F29eD462364C7e81375FC0C71219b1;
    address private constant _SUSDS = 0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD;

    constructor()
        ERC4626Oracle(
            "sUSDS / USD", // description
            _CL_USDS_USD_HEARTBEAT, // heartbeat
            _SUSDS, // token
            _CL_USDS_USD_PRICE_FEED, // primary
            address(0) // fallback
        ) {}
}