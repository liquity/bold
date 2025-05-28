// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "src/PriceFeeds/WSTETHPriceFeed.sol";
import "src/PriceFeeds/MainnetPriceFeedBase.sol";
import "src/PriceFeeds/RETHPriceFeed.sol";
import "src/PriceFeeds/WETHPriceFeed.sol";

import "./TestContracts/Accounts.sol";
import "./TestContracts/ChainlinkOracleMock.sol";
import "./TestContracts/GasGuzzlerOracle.sol";
import "./TestContracts/GasGuzzlerToken.sol";
import "./TestContracts/RETHTokenMock.sol";
import "./TestContracts/WSTETHTokenMock.sol";
import "./TestContracts/Deployment.t.sol";

import "src/Dependencies/AggregatorV3Interface.sol";
import "src/PriceFeeds/RETHPriceFeed.sol";
import "src/Interfaces/IWSTETHPriceFeed.sol";
import "src/PriceFeeds/WSTETHPriceFeed.sol";
import "src/PriceFeeds/RSETHPriceFeed.sol";

import "src/Interfaces/IRETHToken.sol";
import "src/Interfaces/IWSTETH.sol";

import "forge-std/Test.sol";
import "forge-std/console2.sol";

contract ArbitrumOracles is Test {
    RSETHPriceFeed public rsETHPriceFeed;
    WSTETHPriceFeed public wstethPriceFeed;
    RETHPriceFeed public rEthPriceFeed;

    // chainlink addresses
    address public WSTETH_ADDRESS = 0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0;
    address public RETH_ADDRESS = 0xEC70Dcb4A1EFa46b8F2D97C310C9c4790ba5ffA8;
    address public ETH_ORACLE_ADDRESS = 0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612;
    address public RSETH_ORACLE_ADDRESS = 0x8fE61e9D74ab69cE9185F365dfc21FC168c4B56c;
    address public RETH_ORACLE_ADDRESS = 0xD6aB2298946840262FcC278fF31516D39fF611eF;
    address public STETH_ORACLE_ADDRESS = 0x07C5b924399cc23c24a95c8743DE4006a32b7f2a;
    address public WSTETH_STETH_ORACLE_ADDRESS = 0xB1552C5e96B312d0Bf8b554186F846C40614a540;
    address public WSTETH_ETH_ORACLE_ADDRESS = 0xb523AE262D20A936BC152e6023996e46FDC2A95D;

    function setUp() public {
        string memory arbitrumRpcUrl = vm.envString("ARBITRUM_RPC_URL");
        vm.createSelectFork(arbitrumRpcUrl);
        rEthPriceFeed = _deployRETH();
        wstethPriceFeed = _deployWSTETH();
        rsETHPriceFeed = _deployRsETH();
    }

    function _deployRsETH() internal returns (RSETHPriceFeed _rsETHPriceFeed) {
        _rsETHPriceFeed =
            new RSETHPriceFeed(address(this), ETH_ORACLE_ADDRESS, RSETH_ORACLE_ADDRESS, 24 hours, 24 hours);
        vm.label(address(_rsETHPriceFeed), "RSETHPriceFeed");
    }

    function _deployWSTETH() internal returns (WSTETHPriceFeed _wstethPriceFeed) {
        _wstethPriceFeed = new WSTETHPriceFeed(
            address(this), WSTETH_STETH_ORACLE_ADDRESS, WSTETH_ETH_ORACLE_ADDRESS, 0x5979D7b546E38E414F7E9822514be443A4800529, 24 hours, 24 hours
        );
        vm.label(address(_wstethPriceFeed), "WSTETHPriceFeed");
    }

    function _deployRETH() internal returns (RETHPriceFeed _rEthPriceFeed) {
        _rEthPriceFeed = new RETHPriceFeed(address(this), ETH_ORACLE_ADDRESS, RETH_ORACLE_ADDRESS, RETH_ADDRESS, 24 hours, 24 hours);
        //address _owner, address _ethUsdOracleAddress, address _rEthEthOracleAddress, address _rEthTokenAddress, uint256 _ethUsdStalenessThreshold, uint256 _rEthEthStalenessThreshold
        vm.label(address(_rEthPriceFeed), "RETHPriceFeed");
    }

    function test_rsETHPriceFeed() public {
        (uint256 price, bool oracleDown) = rsETHPriceFeed.fetchPrice();

        assertGt(price, 0, "rsEth Price must not be zero");
        assertFalse(oracleDown, "rsEth oracle must not be down");
    }

    function test_wstethPriceFeed() public {
        (uint256 price, bool oracleDown) = wstethPriceFeed.fetchPrice();

        assertGt(price, 0, "wstEth Price must not be zero");
        assertFalse(oracleDown, "wstEth oracle must not be down");
    }

    function test_rEthPriceFeed() public {
        (uint256 price, bool oracleDown) = rEthPriceFeed.fetchPrice();

        assertGt(price, 0, "rEth Price must not be zero");
        assertFalse(oracleDown, "rEth oracle must not be down");
    }
}