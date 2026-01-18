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

    /**
     * @notice Returns true if the L2 sequencer has been up and operational for at least the specified duration.
     * @param since The minimum number of seconds the L2 sequencer must have been up (e.g., 1 hours = 3600).
     * @return up True if the sequencer has been up for at least `since` seconds, false otherwise
     */
    function isL2SequencerUp(uint256 since) external view returns (bool up);
}
