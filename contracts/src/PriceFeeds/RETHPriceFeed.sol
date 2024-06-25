pragma solidity 0.8.18;

import "./MainnetPriceFeedBase.sol";
import "../Interfaces/IRETHPriceFeed.sol";

// import "forge-std/console2.sol";

contract RETHPriceFeed is MainnetPriceFeedBase, IRETHPriceFeed {
    Oracle public rEthEthOracle;
    
    constructor(
        address _ethUsdOracleAddress, 
        address _rEthEthOracleAddress, 
        uint256 _ethUsdStalenessThreshold,
        uint256 _rEthEthStalenessThreshold
    ) 
        MainnetPriceFeedBase(_ethUsdOracleAddress, _ethUsdStalenessThreshold) 
    {
        rEthEthOracle.aggregator = AggregatorV3Interface(_rEthEthOracleAddress);
        rEthEthOracle.stalenessThreshold = _rEthEthStalenessThreshold;
        rEthEthOracle.decimals = rEthEthOracle.aggregator.decimals();
    
        // Check aggregator has the expected 18 decimals
        assert(rEthEthOracle.decimals == 18);

        fetchPrice();

        // Check the oracle didn't already fail
        assert(shutdownFlag == false);
    }

    function fetchPrice() public returns (uint256) {
        (uint256 ethUsdPrice, bool ethUsdDown) = _fetchPrice(ethUsdOracle);
        (uint256 rEthEthPrice, bool rEthEthDown) = _fetchPrice(rEthEthOracle);

        // If the branch was already shut down or if one of Chainlink's responses was invalid in this transaction,
        // Return the last good ETH-USD price calculated
        if (shutdownFlag || ethUsdDown || rEthEthDown) {return lastGoodPrice;}
        
        // Calculate RETH-USD price: USD_per_RETH = USD_per_ETH * ETH_per_RETH
        uint256 rEthUsdPrice = ethUsdPrice * rEthEthPrice / 1e18;

        lastGoodPrice = rEthUsdPrice;
    
        return rEthUsdPrice;
    }

    function getREthEthStalenessThreshold() external view returns (uint256) {
        return rEthEthOracle.stalenessThreshold;
    }
}