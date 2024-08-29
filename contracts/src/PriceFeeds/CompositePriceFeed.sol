// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "../Dependencies/LiquityMath.sol";
import "./MainnetPriceFeedBase.sol";

<<<<<<< HEAD
// Composite PriceFeed: outputs an LST-USD price derived from two external price Oracles: LST-ETH, and ETH-USD.
// Used where the LST token is non-rebasing (as per rETH, osETH, ETHx, etc).
contract CompositePriceFeed is MainnetPriceFeedBase, ICompositePriceFeed {
    Oracle public lstEthOracle;
    Oracle public ethUsdOracle;

=======
// import "forge-std/console2.sol";

// The CompositePriceFeed is used for feeds that incorporate both a market price oracle (e.g. STETH-USD, or RETH-ETH) 
// and an LST canonical rate (e.g. WSTETH:STETH, or RETH:ETH).
contract CompositePriceFeed is MainnetPriceFeedBase {
>>>>>>> 81a1a2aa (Add ETH-USD fallback logic and remove OSETH and ETHX contracts)
    address public rateProviderAddress;

    constructor(
        address _owner,
        address _ethUsdOracleAddress,
        address _rateProviderAddress,
        uint256 _ethUsdStalenessThreshold
    ) MainnetPriceFeedBase(
        _owner,
        _ethUsdOracleAddress,
        _ethUsdStalenessThreshold
    ) {
        // Store rate provider
        rateProviderAddress = _rateProviderAddress;
    }
    
    function fetchPrice() public returns (uint256, bool) {
        // If branch is live and the primary oracle setup has been working, try to use it 
        if (priceSource == PriceSource.primary) {return _fetchPrice();}

        // If branch is already shut down and using ETH-USD * canonical_rate, try to use that
        if (priceSource == PriceSource.ETHUSDxCanonical) {
                (uint256 ethUsdPrice, bool ethUsdOracleDown) = _getOracleAnswer(ethUsdOracle);
                //... but if the ETH-USD oracle *also* fails here, use the lastGoodPrice
                if(ethUsdOracleDown) {
                    // No need to shut down, since branch already is shut down
                    return (lastGoodPrice, false);
                } else {
                    return (_fetchPriceETHUSDxCanonical(ethUsdPrice), false);
                }
            }

        // Otherwise if branch is shut down and already using the lastGoodPrice, continue with it
        if (priceSource == PriceSource.lastGoodPrice) {return (lastGoodPrice, false);}
    }

    function _shutDownAndSwitchToETHUSDxCanonical(address _failedOracleAddr, uint256 _ethUsdPrice) internal returns (uint256) {
        // Shut down the branch
        borrowerOperations.shutdownFromOracleFailure(_failedOracleAddr);

        priceSource = PriceSource.ETHUSDxCanonical;
        return _fetchPriceETHUSDxCanonical(_ethUsdPrice);
    }

    // Only called if the primary LST oracle has failed, branch has shut down, 
    // and we've switched to using: ETH-USD * canonical_rate.
    function _fetchPriceETHUSDxCanonical(uint256 _ethUsdPrice) internal returns (uint256) {
        assert(priceSource == PriceSource.ETHUSDxCanonical);
        // Get the ETH_per_LST canonical rate directly from the LST contract
        // TODO: Should we also shutdown if the call to the canonical rate reverts, or returns 0?
        uint256 lstEthRate = _getCanonicalRate();

        // Calculate the canonical LST-USD price: USD_per_LST = USD_per_ETH * ETH_per_LST
        uint256 lstUsdCanonicalPrice = _ethUsdPrice * lstEthRate / 1e18;

        lastGoodPrice = lstUsdCanonicalPrice;

        return (lstUsdCanonicalPrice);
    }

    // Returns the LST exchange rate from the LST smart contract. Implementation depends on the specific LST.
    function _getCanonicalRate() internal view virtual returns (uint256) {}
}
