// SPDX-License-Identifier: MIT
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "../Interfaces/IPriceFeed.sol";

pragma solidity ^0.8.0;

interface IPythPriceFeed is IPriceFeed {
    function pythContract() external view returns (IPyth);
    function priceFeedId() external view returns (bytes32);
    function priceAgeThreshold() external view returns (uint256);
}
