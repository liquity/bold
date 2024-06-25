pragma solidity 0.8.18;

import "./MainnetPriceFeedBase.sol";
// import "forge-std/console2.sol";

contract WETHPriceFeed is MainnetPriceFeedBase {
    constructor(address _priceAggregatorAddress, uint256 _ethUsdStalenessThreshold) 
        MainnetPriceFeedBase(_priceAggregatorAddress, _ethUsdStalenessThreshold) {
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
}