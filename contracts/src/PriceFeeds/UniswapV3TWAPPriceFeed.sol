// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "../Interfaces/IPriceFeed.sol";
import "../Interfaces/IBorrowerOperations.sol"; // For shutdownFromOracleFailure
import {IUniswapV3Pool} from "lib/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {OracleLibrary} from "lib/v3-periphery/contracts/libraries/OracleLibrary.sol";
import {TickMath} from "lib/v3-core/contracts/libraries/TickMath.sol";
import {FixedPointMathLib} from "lib/solady/src/utils/FixedPointMathLib.sol";

// Error if Uniswap V3 interfaces/libraries are not found at these paths.
// Common paths:
// "lib/v3-core/contracts/interfaces/IUniswapV3Pool.sol" or "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol"
// "lib/v3-periphery/contracts/libraries/OracleLibrary.sol" or "@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol"
// "lib/v3-core/contracts/libraries/TickMath.sol" or "@uniswap/v3-core/contracts/libraries/TickMath.sol"
// "lib/solady/src/utils/FixedPointMathLib.sol" or "solady/utils/FixedPointMathLib.sol"

contract UniswapV3TWAPPriceFeed is IPriceFeed {
    uint256 public immutable PRICE_PRECISION = 1e18; // Standard price precision

    IUniswapV3Pool public immutable pool;
    address public immutable tokenA; // Typically the memecoin
    address public immutable tokenB; // Typically the stablecoin (e.g., USDC, USDT)
    bool public immutable tokenAIsToken0;
    uint32 public immutable twapInterval;

    uint256 public lastGoodPrice;
    uint256 public lastFetchTime;

    IBorrowerOperations internal borrowerOperations; // To trigger shutdown on oracle failure

    // How old can a TWAP reading be before we consider it stale
    uint256 public constant MAX_TWAP_AGE = 3 hours; // Example: 3 hours, adjust as needed

    event PriceUpdated(uint256 price, uint256 lastGoodPrice, uint256 timestamp);
    event OracleFailureHandled(string reason);

    constructor(
        address _poolAddress,
        address _tokenA, // Memecoin
        address _tokenB, // USD Stablecoin
        uint32 _twapIntervalSeconds,
        address _borrowerOperationsAddress
    ) {
        require(_poolAddress != address(0), "Pool address cannot be zero");
        require(_tokenA != address(0), "Token A address cannot be zero");
        require(_tokenB != address(0), "Token B address cannot be zero");
        require(_twapIntervalSeconds > 0, "TWAP interval must be positive");
        require(_borrowerOperationsAddress != address(0), "Borrower ops cannot be zero");

        pool = IUniswapV3Pool(_poolAddress);
        tokenA = _tokenA;
        tokenB = _tokenB;
        twapInterval = _twapIntervalSeconds;
        borrowerOperations = IBorrowerOperations(_borrowerOperationsAddress);

        address token0InPool = pool.token0(); // Renamed to avoid conflict with contract member
        if (_tokenA == token0InPool) {
            require(_tokenB == pool.token1(), "Token B mismatch");
            tokenAIsToken0 = true;
        } else {
            require(_tokenA == pool.token1(), "Token A not in pool");
            require(_tokenB == token0InPool, "Token B mismatch");
            tokenAIsToken0 = false;
        }
        // Initial lastGoodPrice could be set via an initial fetch or left to first successful fetch
    }

    function fetchPrice() external override returns (uint256 price, bool oracleFailureDetected) {
        return _fetchPriceInternal();
    }

    function fetchRedemptionPrice() external override returns (uint256 price, bool oracleFailureDetected) {
        return _fetchPriceInternal();
    }

    function _fetchPriceInternal() internal returns (uint256 price, bool oracleFailureDetected) {
        try pool.observe(new uint32[](twapInterval)) returns (int56[] memory tickCumulatives, ) {
            // Using OracleLibrary.consult for simplicity
            int24 timeWeightedAverageTick = OracleLibrary.consult(address(pool), twapInterval);
            uint160 sqrtPriceX96 = TickMath.getSqrtRatioAtTick(timeWeightedAverageTick);

            uint256 numerator;
            uint256 denominator;

            if (tokenAIsToken0) { // Price of token0 (memecoin) in terms of token1 (stablecoin)
                numerator = FixedPointMathLib.Q192 * PRICE_PRECISION; // (2^96)^2 * 1e18
                denominator = uint256(sqrtPriceX96) * uint256(sqrtPriceX96);
            } else { // Price of token1 (memecoin) in terms of token0 (stablecoin)
                numerator = uint256(sqrtPriceX96) * uint256(sqrtPriceX96) * PRICE_PRECISION;
                denominator = FixedPointMathLib.Q192; // (2^96)^2
            }

            if (denominator == 0) {
                oracleFailureDetected = true;
                emit OracleFailureHandled("Denominator is zero in price calculation");
                // borrowerOperations.shutdownFromOracleFailure(); // Requires permission
                return (lastGoodPrice, true);
            }

            price = numerator / denominator;

            if (price == 0) {
                 oracleFailureDetected = true;
                 emit OracleFailureHandled("Calculated price is zero");
                 return (lastGoodPrice, true);
            }

            lastGoodPrice = price;
            lastFetchTime = block.timestamp;
            oracleFailureDetected = false;
            emit PriceUpdated(price, lastGoodPrice, block.timestamp);
            return (price, false);

        } catch Error(string memory reason) {
            oracleFailureDetected = true;
            emit OracleFailureHandled(reason);
            // borrowerOperations.shutdownFromOracleFailure();
            return (lastGoodPrice, true);
        } catch {
            oracleFailureDetected = true;
            emit OracleFailureHandled("Unknown error during price fetch");
            // borrowerOperations.shutdownFromOracleFailure();
            return (lastGoodPrice, true);
        }
    }

    function lastGoodPrice() external view override returns (uint256) {
        return lastGoodPrice;
    }
}
