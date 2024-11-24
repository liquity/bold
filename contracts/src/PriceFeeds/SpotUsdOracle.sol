// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import {IUniswapV3Factory} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import {OracleLibrary} from "@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol";

import "../Dependencies/AggregatorV3Interface.sol";

contract SpotUsdOracle is AggregatorV3Interface {
    address public immutable token0; // usdc
    address public immutable token1; // spot
    address public immutable pool;

    AggregatorV3Interface public immutable usdcUsdOracle;

    int256 public constant UNIT = 1e8;
    int256 private constant TOKEN0_DECIMALS = 1e6;
    uint128 private constant TOKEN1_DECIMALS = 1e9;

    constructor(address _usdcUsdOracle, address _factory, address _token0, address _token1, uint24 _fee) {
        usdcUsdOracle = AggregatorV3Interface(_usdcUsdOracle);
        if (usdcUsdOracle.decimals() != 8) revert("!ORACLE");

        token0 = _token0;
        token1 = _token1;

        address _pool = IUniswapV3Factory(_factory).getPool(_token0, _token1, _fee);
        if (_pool == address(0)) revert("!POOL");
        pool = _pool;
    }

    function decimals() external pure override returns (uint8) {
        return 8;
    }

    function latestRoundData()
        external
        view
        override
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        return (0, _calcPrice(), 0, block.timestamp, 0);
    }

    function _calcPrice() private view returns (int256) {
        (int24 _tick,) = OracleLibrary.consult(
            pool,
            300 // secondsAgo
        );
        (, int256 _usdcUsdOracle,,,) = usdcUsdOracle.latestRoundData();
        return int256(OracleLibrary.getQuoteAtTick(_tick, TOKEN1_DECIMALS, token1, token0)) * (UNIT / TOKEN0_DECIMALS)
            * _usdcUsdOracle / UNIT;
    }
}
