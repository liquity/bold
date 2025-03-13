// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;
 
import "./TokenPriceFeedBase.sol";

contract tBTCPriceFeed is TokenPriceFeedBase {

    //BTC feed on arbitrum.
    address public BTCOracleAddress = 0x6ce185860a4963106506C203335A2910413708e9;


    constructor(address _owner, address _tBTCUsdOracleAddress, uint256 _tBTCUsdStalenessThreshold)
        TokenPriceFeedBase(_owner, _tBTCUsdOracleAddress, _tBTCUsdStalenessThreshold)
    {
        _fetchPricePrimary();

        // Check the oracle didn't already fail
        assert(priceSource == PriceSource.primary);
    }

    function fetchPrice() public returns (uint256, bool) {
        // If branch is live and the primary oracle setup has been working, try to use it
        if (priceSource == PriceSource.primary) return _fetchPricePrimary();

        // Otherwise if branch is shut down and already using the lastGoodPrice, continue with it
        assert(priceSource == PriceSource.lastGoodPrice);
        return (lastGoodPrice, false);
    }

    function fetchRedemptionPrice() external returns (uint256, bool) {
        // Use same price for redemption as all other ops in tBTC branch

        //get the price of normal BTC. 
        int256 btcPriceInt;
        (,btcPriceInt,,,) = AggregatorV3Interface(BTCOracleAddress).latestRoundData();
        uint256 btcPrice = uint256(btcPriceInt); // Convert from int256 to uint256
        //compare tbtc price. 
        (uint256 tbtcPrice, bool resultDown) = fetchPrice();
        //if they are within 2% then there is no depeg. Use the higher one of the two to prevent value leak.
        // Instead of comparing tbtcPrice/btcPrice with fractions, cross-multiply.
        if (tbtcPrice * 100 <= btcPrice * 102 && tbtcPrice * 100 >= btcPrice * 98) {
            //no depeg. return the higher one.
            if( tbtcPrice > btcPrice) {
                return (tbtcPrice, resultDown); 
            } else {
                return (btcPrice, resultDown);
            }
        } else {
            //depeg is significant. 
            return (tbtcPrice, resultDown);
        }
    }

    //  _fetchPricePrimary returns:
    // - The price
    // - A bool indicating whether a new oracle failure was detected in the call
    function _fetchPricePrimary(bool /* _isRedemption */ ) internal virtual returns (uint256, bool) {
        return _fetchPricePrimary();
    }

    function _fetchPricePrimary() internal returns (uint256, bool) {
        assert(priceSource == PriceSource.primary);
        (uint256 tokenUsdPrice, bool tokenUsdOracleDown) = _getOracleAnswer(tokenUsdOracle);

        // If the tBTC-USD Chainlink response was invalid in this transaction, return the last good tBTC-USD price calculated
        if (tokenUsdOracleDown) return (_shutDownAndSwitchToLastGoodPrice(address(tokenUsdOracle.aggregator)), true);

        lastGoodPrice = tokenUsdPrice;
        return (tokenUsdPrice, false);
    }
}   


