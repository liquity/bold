pragma solidity 0.8.18;

import "./MainnetPriceFeedBase.sol";
import "../Interfaces/ICompositePriceFeed.sol";

// import "forge-std/console2.sol";

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
    
        _fetchPrice();

        // Check an oracle didn't already fail
        assert(priceFeedDisabled == false);
    }

    function _fetchPrice() internal override returns (uint256) {
        (uint256 ethUsdPrice, bool ethUsdOracleDown) = _getOracleAnswer(ethUsdOracle);
        (uint256 lstEthPrice, bool lstEthOracleDown) = _getOracleAnswer(lstEthOracle);

        // If one of Chainlink's responses was invalid in this transaction, disable this PriceFeed and
        // return the last good LST-USD price calculated
        if (ethUsdOracleDown) {return _disableFeed(address(ethUsdOracle.aggregator));}
        if (ethUsdOracleDown) {return _disableFeed(address(lstEthOracle.aggregator));}
            
        // Calculate LST-USD price: USD_per_LST = USD_per_ETH * ETH_per_LST
        uint256 lstUsdPrice = ethUsdPrice * lstEthPrice / 1e18;

        lastGoodPrice = lstUsdPrice;
    
        return lstUsdPrice;
    }
}