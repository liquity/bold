// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

/**
 * @title IOracleAdapter
 * @notice Interface for the Oracle Adapter contract that provides FX rate data
 */
interface IOracleAdapter {
    /**
     * @notice Returns the exchange rate for a given rate feed ID
     * with 18 decimals of precision if considered valid, based on
     * FX market hours, trading mode, and recent rate, otherwise reverts
     * @param rateFeedID The address of the rate feed
     * @return numerator The numerator of the rate
     * @return denominator The denominator of the rate
     */
    function getFXRateIfValid(address rateFeedID) external view returns (uint256 numerator, uint256 denominator);
}
