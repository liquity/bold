// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "openzeppelin-contracts/contracts/utils/math/Math.sol";

import {Logging} from "./Logging.sol";
import {StringFormatting} from "./StringFormatting.sol";
import {DECIMAL_PRECISION} from "../../Dependencies/Constants.sol";

import "forge-std/console2.sol";

contract UniPriceConverter is Logging {
    using StringFormatting for uint256;

    function priceToSqrtPrice(uint256 _price) external pure returns (uint256, uint256, uint256) {
        uint256 inversePrice = DECIMAL_PRECISION * DECIMAL_PRECISION / _price;
        uint256 sqrtPriceX96 = Math.sqrt((_price << 192) / DECIMAL_PRECISION);
        uint256 sqrtInversePriceX96 = Math.sqrt((inversePrice << 192) / DECIMAL_PRECISION);

        info("Price:              ", _price.decimal());
        info("Uni sqrt Price:     ", sqrtPriceX96.decimal());
        info("Inverse price:      ", inversePrice.decimal());
        info("Uni sqrt inv Price: ", sqrtInversePriceX96.decimal());

        console2.log("Price:              ", _price);
        console2.log("Uni sqrt Price:     ", sqrtPriceX96);
        console2.log("Inverse price:      ", inversePrice);
        console2.log("Uni sqrt inv Price: ", sqrtInversePriceX96);

        return (sqrtPriceX96, inversePrice, sqrtInversePriceX96);
    }

    function sqrtPriceToPrice(uint160 _sqrtPriceX96) external pure returns (uint256 price) {
        price = uint256(_sqrtPriceX96) * uint256(_sqrtPriceX96) * DECIMAL_PRECISION / (1 << 192);

        info("Uni sqrt Price:     ", uint256(_sqrtPriceX96).decimal());
        info("Price:              ", price.decimal());
        console2.log("Uni sqrt Price:     ", uint256(_sqrtPriceX96));
        console2.log("Price:              ", price);
    }
}
