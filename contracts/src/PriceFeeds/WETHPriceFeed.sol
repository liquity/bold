pragma solidity 0.8.18;

import "./MainnetPriceFeedBase.sol";
import "../Interfaces/IWETHPriceFeed.sol";
// import "forge-std/console2.sol";

contract WETHPriceFeed is MainnetPriceFeedBase, IWETHPriceFeed {
    Oracle public ethUsdOracle;

    constructor(address _ethUsdOracleAddress, uint256 _ethUsdStalenessThreshold) 
        MainnetPriceFeedBase()
    {
        ethUsdOracle.aggregator = AggregatorV3Interface(_ethUsdOracleAddress);
        ethUsdOracle.stalenessThreshold = _ethUsdStalenessThreshold;
        ethUsdOracle.decimals = ethUsdOracle.aggregator.decimals();
        
        // Check ETH-USD aggregator has the expected 8 decimals
        assert(ethUsdOracle.decimals == 8);

        fetchPrice();

        // Check the oracle didn't already fail
        assert(shutdownFlag == false);
    }

    function fetchPrice() public returns (uint256) {
        (uint256 ethUsdPrice, bool ethUsdDown) = _fetchPrice(ethUsdOracle);

         // If the branch was already shut down or if the Chainlink response was invalid in this transaction,
        // Return the last good ETH-USD price calculated
        if (shutdownFlag || ethUsdDown) {return lastGoodPrice;}

        lastGoodPrice = ethUsdPrice;

        return ethUsdPrice;
    }

    function getEthUsdStalenessThreshold() external view returns (uint256) {
        return ethUsdOracle.stalenessThreshold;
    }
}