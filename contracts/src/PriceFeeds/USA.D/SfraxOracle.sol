// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC4626Oracle} from "./ERC4626Oracle.sol";

contract SfraxOracle is ERC4626Oracle {

    uint256 private constant CL_FRAX_USD_HEARTBEAT = _1_HOUR;

    address private constant CL_FRAX_USD_PRICE_FEED = 0xB9E1E3A9feFf48998E45Fa90847ed4D467E8BcfD;
    address private constant SFRAX = 0xA663B02CF0a4b149d2aD41910CB81e23e1c41c32;

    constructor(address _fallback)
        ERC4626Oracle(
            "sFRAX / USD", // description
            CL_FRAX_USD_HEARTBEAT, // heartbeat
            SFRAX, // token
            CL_FRAX_USD_PRICE_FEED, // primary
            _fallback // fallback
        ) {}
}