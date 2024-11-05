// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "openzeppelin-contracts/contracts/utils/math/Math.sol";

import {DECIMAL_PRECISION} from "../../../../Dependencies/Constants.sol";

contract UniPriceConverter {
    function priceToSqrtPriceX96(uint256 _price) public pure returns (uint160 sqrtPriceX96) {
        // overflow vs precision
        if (_price > (1 << 64)) {
            // ~18.4e18
            sqrtPriceX96 = uint160(Math.sqrt(_price / DECIMAL_PRECISION) << 96);
        } else {
            sqrtPriceX96 = uint160(Math.sqrt((_price << 192) / DECIMAL_PRECISION));
        }
    }

    function sqrtPriceX96ToPrice(uint160 _sqrtPriceX96) public pure returns (uint256 price) {
        //price = uint256(_sqrtPriceX96) * uint256(_sqrtPriceX96) * DECIMAL_PRECISION / (1 << 192);
        uint256 squaredPrice = uint256(_sqrtPriceX96) * uint256(_sqrtPriceX96);
        // overflow vs precision
        if (squaredPrice > 115e57) {
            // max uint256 / 1e18
            price = ((squaredPrice >> 96) * DECIMAL_PRECISION) >> 96;
        } else {
            price = (squaredPrice * DECIMAL_PRECISION) >> 192;
        }
    }
}
