// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "./CompositePriceFeed.sol";
import "../Dependencies/IStaderOracle.sol";

// import "forge-std/console2.sol";

contract ETHXPriceFeed is CompositePriceFeed {
    constructor(
        address _owner,
        address _ethUsdOracleAddress,
        address _lstEthOracleAddress,
        address _rateProviderAddress,
        uint256 _ethUsdStalenessThreshold,
        uint256 _lstEthStalenessThreshold
    )
        CompositePriceFeed(
            _owner,
            _ethUsdOracleAddress,
            _lstEthOracleAddress,
            _rateProviderAddress,
            _ethUsdStalenessThreshold,
            _lstEthStalenessThreshold
        )
    {}

    function _getCanonicalRate() internal view override returns (uint256) {
        // StaderOracle returns ETH balance and ETHX supply each with 18 digit decimal precision

        (
            , // uint256 reportingBlockNumber
            uint256 ethBalance,
            uint256 ethXSupply
        ) = IStaderOracle(rateProviderAddress).exchangeRate();

        return ethBalance * 1e18 / ethXSupply;
    }
}
