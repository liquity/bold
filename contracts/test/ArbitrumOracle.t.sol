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
import "src/PriceFeeds/rsETHPriceFeed.sol";
import "src/PriceFeeds/treeETHPriceFeed.sol";
import "src/PriceFeeds/WeETHPriceFeed.sol";

import "src/Interfaces/IRETHToken.sol";
import "src/Interfaces/IWSTETH.sol";

import "forge-std/Test.sol";
import "forge-std/console2.sol";

contract ArbitrumOracles is Test {
    RSETHPriceFeed public rsETHPriceFeed;
    WSTETHPriceFeed public wstethPriceFeed;
    RETHPriceFeed public rEthPriceFeed;
    TreeETHPriceFeed public treeETHPriceFeed;
    WeETHPriceFeed public weETHPriceFeed;
    
    address public WSTETH_ADDRESS = 0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0;
    address public RETH_ADDRESS = 0xEC70Dcb4A1EFa46b8F2D97C310C9c4790ba5ffA8;
    address public TETH_ADDRESS = 0xd09ACb80C1E8f2291862c4978A008791c9167003;
    address public WEETH_ADDRESS = 0x35751007a407ca6FEFfE80b3cB397736D2cf4dbe;

    address public TREEETH_PROVIDER_ADDRESS = 0x353230eF3b5916B280dBAbb720d7b8dB61485615;
    // chainlink rate provider address
    address public WSTETH_RATE_PROVIDER_ADDRESS = 0xf7c5c26B574063e7b098ed74fAd6779e65E3F836;

    // api3 oracle addresses
    address public ETH_ORACLE_ADDRESS = 0x4DF393Fa84e4a0CFdF14ce52f2a4E0c3d1AB0668;
    address public RSETH_ORACLE_ADDRESS = 0x8fE61e9D74ab69cE9185F365dfc21FC168c4B56c;
    address public RETH_ORACLE_ADDRESS = 0xA99a7c32c68Ec86127C0Cff875eE10B9C87fA12d;
    address public WSTETH_STETH_ORACLE_ADDRESS = 0xAC7d5c56eBADdcBd97F9Efe586875F61410a54B4;
    address public WEETH_ETH_ORACLE_ADDRESS = 0xabB160Db40515B77998289afCD16DC06Ae71d12E;
    

    // chainlink oracle addresses
    address public TETH_WSTETH_ORACLE_ADDRESS = 0x98a977Ba31C72aeF2e15B950Eb5Ae3158863D856;
    address public STETH_ORACLE_ADDRESS = 0x07C5b924399cc23c24a95c8743DE4006a32b7f2a;
    

    function setUp() public {
        string memory arbitrumRpcUrl = vm.envString("ARBITRUM_RPC_URL");
        vm.createSelectFork(arbitrumRpcUrl);
        wstethPriceFeed = _deployWSTETHPriceFeed();
        rEthPriceFeed = _deployRETHPriceFeed();
        rsETHPriceFeed = _deployRsETHPriceFeed();
        treeETHPriceFeed = _deployTreeETHPriceFeed();
        weETHPriceFeed = _deployWeETHPriceFeed();
    }

    function _deployRsETHPriceFeed() internal returns (RSETHPriceFeed _rsETHPriceFeed) {
        _rsETHPriceFeed =
            new RSETHPriceFeed(address(this), ETH_ORACLE_ADDRESS, RSETH_ORACLE_ADDRESS, 24 hours, 24 hours);
        vm.label(address(_rsETHPriceFeed), "RSETHPriceFeed");
    }

    function _deployWSTETHPriceFeed() internal returns (WSTETHPriceFeed _wstethPriceFeed) {
        _wstethPriceFeed = new WSTETHPriceFeed(
            address(this), ETH_ORACLE_ADDRESS, STETH_ORACLE_ADDRESS, WSTETH_RATE_PROVIDER_ADDRESS, 24 hours, 24 hours
        );
        vm.label(address(_wstethPriceFeed), "WSTETHPriceFeed");
    }

    function _deployRETHPriceFeed() internal returns (RETHPriceFeed _rEthPriceFeed) {
        _rEthPriceFeed = new RETHPriceFeed(address(this), ETH_ORACLE_ADDRESS, RETH_ORACLE_ADDRESS, RETH_ADDRESS, 24 hours, 24 hours);
        vm.label(address(_rEthPriceFeed), "RETHPriceFeed");
    }

    function _deployTreeETHPriceFeed() internal returns (TreeETHPriceFeed _treeETHPriceFeed) {
        _treeETHPriceFeed = new TreeETHPriceFeed(address(this), ETH_ORACLE_ADDRESS, TETH_WSTETH_ORACLE_ADDRESS, TREEETH_PROVIDER_ADDRESS, 24 hours, 24 hours);
        vm.label(address(_treeETHPriceFeed), "TreeETHPriceFeed");
    }

    function _deployWeETHPriceFeed() internal returns (WeETHPriceFeed _weETHPriceFeed) {
        _weETHPriceFeed = new WeETHPriceFeed(address(this), ETH_ORACLE_ADDRESS, WEETH_ETH_ORACLE_ADDRESS, WEETH_ADDRESS, 24 hours, 24 hours);
        vm.label(address(_weETHPriceFeed), "WeETHPriceFeed");
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

    function test_weETHPriceFeed() public {
        (uint256 price, bool oracleDown) = weETHPriceFeed.fetchPrice();

        assertGt(price, 0, "weEth Price must not be zero");
        assertFalse(oracleDown, "weEth oracle must not be down");
    }

    function test_treeETHPriceFeed() public {
        (uint256 price, bool oracleDown) = treeETHPriceFeed.fetchPrice();

        assertGt(price, 0, "treeEth Price must not be zero");
        assertFalse(oracleDown, "treeEth oracle must not be down");
    }
}
