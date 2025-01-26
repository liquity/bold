// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC4626Oracle} from "./ERC4626Oracle.sol";

contract SdaiOracle is ERC4626Oracle {

    uint256 private constant _CL_DAI_USD_HEARTBEAT = _1_HOUR;

    address private constant _CL_DAI_USD_PRICE_FEED = 0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9;
    address private constant _SDAI = 0x83F20F44975D03b1b09e64809B757c47f942BEeA;

    constructor()
        ERC4626Oracle(
            "sDAI / USD", // description
            _CL_DAI_USD_HEARTBEAT, // heartbeat
            _SDAI, // token
            _CL_DAI_USD_PRICE_FEED, // primary
            address(0) // fallback
        ) {}
}