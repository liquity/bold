pragma solidity 0.8.18;

import "./MainnetPriceFeedBase.sol";
import "../Interfaces/IWSTETH.sol";
import "../Interfaces/IWSTETHPriceFeed.sol";

/*
* PriceFeed placeholder for testnet and development. The price is simply set manually and saved in a state 
* variable. The contract does not connect to a live Chainlink price feed. 
*/
contract WSTETHPriceFeed is MainnetPriceFeedBase, IWSTETHPriceFeed {
    Oracle public stEthEthOracle;
    IWSTETH public wstETH;

    constructor(
        address _ethUsdOracleAddress, 
        address _stEthEthOracleAddress, 
        uint256 _ethUsdStalenessThreshold,
        uint256 _stEthEthStalenessThreshold,
        address _wstETHAddress
    ) 
        MainnetPriceFeedBase(_ethUsdOracleAddress, _ethUsdStalenessThreshold) 
    {
        stEthEthOracle.aggregator = AggregatorV3Interface(_stEthEthOracleAddress);
        stEthEthOracle.stalenessThreshold = _stEthEthStalenessThreshold;
        stEthEthOracle.decimals = stEthEthOracle.aggregator.decimals();
        
        wstETH = IWSTETH(_wstETHAddress);

        // Check aggregator has the expected 18 decimals
        assert(stEthEthOracle.decimals == 18);

        fetchPrice();

        // Check the oracle didn't already fail
        assert(shutdownFlag == false);
    }
    
    function fetchPrice() public returns (uint256) {
        // Fetch latest prices
        (uint256 ethUsdPrice, bool ethUsdDown) = _fetchPrice(ethUsdOracle);
        (uint256 stEthEthPrice, bool stEthEthDown) = _fetchPrice(stEthEthOracle);

        // If the branch was already shut down or if one of Chainlink's responses was invalid in this transaction,
        // Return the last good WSTETH-USD price calculated
        if (shutdownFlag || ethUsdDown || stEthEthDown) {return lastGoodPrice;}
        
        // Calculate WSTETH-USD price: USD_per_WSTETH = USD_per_ETH * ETH_per_stETH * stETH_per_WSTETH
        uint256 wstEthUsdPrice = ethUsdPrice * stEthEthPrice * wstETH.stEthPerToken() / 1e36;
        
        lastGoodPrice = wstEthUsdPrice;

        return wstEthUsdPrice;
    }

    function getStEthEthStalenessThreshold() external view returns (uint256) {
        return stEthEthOracle.stalenessThreshold;
    }
}
