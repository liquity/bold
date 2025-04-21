// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "openzeppelin-contracts/contracts/utils/math/Math.sol";

import {UniPriceConverter} from "src/Zappers/Modules/Exchanges/UniswapV3/UniPriceConverter.sol";
import {Logging} from "./Logging.sol";
import {StringFormatting} from "./StringFormatting.sol";
import {DECIMAL_PRECISION} from "src/Dependencies/Constants.sol";

import "forge-std/console2.sol";

contract UniPriceConverterLog is UniPriceConverter, Logging {
    using StringFormatting for uint256;

    function priceToSqrtPrice(uint256 _price) public pure returns (uint256, uint256, uint256) {
        uint256 sqrtPriceX96 = priceToSqrtPriceX96(_price);

        uint256 inversePrice = DECIMAL_PRECISION * DECIMAL_PRECISION / _price;
        uint256 sqrtInversePriceX96 = priceToSqrtPriceX96(inversePrice);

        console2.log("");
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

    function sqrtPriceToPrice(uint160 _sqrtPriceX96) public pure returns (uint256 price) {
        price = sqrtPriceX96ToPrice(_sqrtPriceX96);

        console2.log("");
        info("Uni sqrt Price:     ", uint256(_sqrtPriceX96).decimal());
        info("Price:              ", price.decimal());
        console2.log("Uni sqrt Price:     ", uint256(_sqrtPriceX96));
        console2.log("Price:              ", price);
    }
}
