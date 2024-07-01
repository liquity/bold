pragma solidity 0.8.18;

import "./MainnetPriceFeedBase.sol";
import "../Interfaces/ICompositePriceFeed.sol";

import "forge-std/console2.sol";

// Composite PriceFeed: outputs an LST-USD price derived from two external price Oracles: LST-ETH, and ETH-USD.
// Used where the LST token is non-rebasing (as per rETH, osETH, ETHx, etc).
contract CompositePriceFeed is MainnetPriceFeedBase, ICompositePriceFeed {
    Oracle public lstEthOracle;
    Oracle public ethUsdOracle;
    constructor(
        address _ethUsdOracleAddress, 
        address _lstEthOracleAddress, 
        uint256 _ethUsdStalenessThreshold,
        uint256 _lstEthStalenessThreshold
    ) 
        MainnetPriceFeedBase() 
    {
        // Store ETH-USD oracle
        ethUsdOracle.aggregator = AggregatorV3Interface(_ethUsdOracleAddress);
        ethUsdOracle.stalenessThreshold = _ethUsdStalenessThreshold;
        ethUsdOracle.decimals = ethUsdOracle.aggregator.decimals();
        assert(ethUsdOracle.decimals == 8);

        // Store LST-ETH oracle
        lstEthOracle.aggregator = AggregatorV3Interface(_lstEthOracleAddress);
        lstEthOracle.stalenessThreshold = _lstEthStalenessThreshold;
        lstEthOracle.decimals = lstEthOracle.aggregator.decimals();
    
        fetchPrice();

        // Check the oracle didn't already fail
        assert(shutdownFlag == false);
    }

    function fetchPrice() public returns (uint256) {
        (uint256 ethUsdPrice, bool ethUsdDown) = _fetchPrice(ethUsdOracle);
        (uint256 lstEthPrice, bool lstEthDown) = _fetchPrice(lstEthOracle);

        console2.log("ethUsdDown", ethUsdDown);
        console2.log("lstEthDown", lstEthDown);
        console2.log("ethUsdOracle addr", address(ethUsdOracle.aggregator));
        console2.log("lstEthOracle addr", address(lstEthOracle.aggregator));

        // If the branch was already shut down or if one of Chainlink's responses was invalid in this transaction,
        // Return the last good ETH-USD price calculated
        if (shutdownFlag || ethUsdDown || lstEthDown) {return lastGoodPrice;}
        
        // Calculate LST-USD price: USD_per_LST = USD_per_ETH * ETH_per_LST
        uint256 lstUsdPrice = ethUsdPrice * lstEthPrice / 1e18;

        lastGoodPrice = lstUsdPrice;
    
        return lstUsdPrice;
    }

    function getLstEthStalenessThreshold() external view returns (uint256) {
        return lstEthOracle.stalenessThreshold;
    }

    function getEthUsdStalenessThreshold() external view returns (uint256) {
        return ethUsdOracle.stalenessThreshold;
    }
}