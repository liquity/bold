pragma solidity 0.8.18;

import "./MainnetPriceFeedBase.sol";
import "../Interfaces/IWSTETH.sol";
import "../Interfaces/IWSTETHPriceFeed.sol";

contract WSTETHPriceFeed is MainnetPriceFeedBase, IWSTETHPriceFeed {
    Oracle public stEthUsdOracle;
    IWSTETH public wstETH;

    constructor( 
        address _stEthUsdOracleAddress, 
        uint256 _stEthUsdStalenessThreshold,
        address _wstETHAddress
    ) 
        MainnetPriceFeedBase() 
    {
        stEthUsdOracle.aggregator = AggregatorV3Interface(_stEthUsdOracleAddress);
        stEthUsdOracle.stalenessThreshold = _stEthUsdStalenessThreshold;
        stEthUsdOracle.decimals = stEthUsdOracle.aggregator.decimals();
        
        wstETH = IWSTETH(_wstETHAddress);

        // Check the STETH-USD aggregator has the expected 8 decimals
        assert(stEthUsdOracle.decimals == 8);

        fetchPrice();

        // Check the oracle didn't already fail
        assert(shutdownFlag == false);
    }
    
    function fetchPrice() public returns (uint256) {
        // Fetch latest prices
        (uint256 stEthUsdPrice, bool stEthUsdDown) = _fetchPrice(stEthUsdOracle);

        // If the branch was already shut down or if one of Chainlink's responses was invalid in this transaction,
        // Return the last good WSTETH-USD price calculated
        if (shutdownFlag || stEthUsdDown) {return lastGoodPrice;}
        
        // Calculate WSTETH-USD price: USD_per_WSTETH = USD_per_STETH * STETH_per_WSTETH
        uint256 wstEthUsdPrice = stEthUsdPrice * wstETH.stEthPerToken() / 1e18;
        
        lastGoodPrice = wstEthUsdPrice;

        return wstEthUsdPrice;
    }

    function getStEthUsdStalenessThreshold() external view returns (uint256) {
        return stEthUsdOracle.stalenessThreshold;
    }
}
