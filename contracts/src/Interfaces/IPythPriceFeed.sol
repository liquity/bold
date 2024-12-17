// SPDX-License-Identifier: MIT
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "../Interfaces/IPriceFeed.sol";

pragma solidity ^0.8.0;

interface IPythPriceFeed is IPriceFeed {
    enum PriceSource {
        primary,
        lastGoodPrice
    }

    function pyth() external view returns (IPyth, bytes32, uint256);
}
