// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC4626Oracle} from "./ERC4626Oracle.sol";

contract SusdsOracle is ERC4626Oracle {

    uint256 private constant _CL_DAI_USD_HEARTBEAT = _1_HOUR;

    address private constant _CL_DAI_USD_PRICE_FEED = 0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9;
    address private constant _SUSDS = 0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD;

    constructor()
        ERC4626Oracle(
            "sUSDS / USD", // description
            _CL_DAI_USD_HEARTBEAT, // heartbeat
            _SUSDS, // token
            _CL_DAI_USD_PRICE_FEED, // primary
            address(0) // fallback
        ) {}
}