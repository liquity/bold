// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "./MainnetPriceFeedBase.sol";

contract XVSPriceFeed is MainnetPriceFeedBase {
    constructor(
        address _owner, 
        address _ethUsdOracleAddress, 
        uint256 _ethUsdStalenessThreshold
        ) MainnetPriceFeedBase(
            _owner, 
            _ethUsdOracleAddress, 
            _ethUsdStalenessThreshold) 
        {
            
        }
}   

