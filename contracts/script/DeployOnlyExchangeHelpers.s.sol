// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

import {Script} from "forge-std/Script.sol";

import "src/Zappers/Modules/Exchanges/HybridCurveUniV3ExchangeHelpers.sol";
import "src/Zappers/Modules/Exchanges/Curve/ICurveStableswapNGPool.sol";
import "src/Zappers/Modules/Exchanges/UniswapV3/IQuoterV2.sol";

import "forge-std/console2.sol";

contract DeployOnlyExchangeHelpers is Script {
    IERC20 constant USDC = IERC20(0xc4f4dE29be4d05EA0644dfebb44a87a48E3BfcCE);
    IWETH constant WETH = IWETH(0xbCDdC15adbe087A75526C0b7273Fcdd27bE9dD18);
    ICurveStableswapNGPool constant usdcCurvePool = ICurveStableswapNGPool(0xdCD2D012C1A4fc509763657ED24b83c8Fe6cf756);

    uint128 constant BOLD_TOKEN_INDEX = 0;
    uint128 constant USDC_INDEX = 1;

    uint24 constant UNIV3_FEE_USDC_WETH = 500; // 0.05%
    uint24 constant UNIV3_FEE_WETH_COLL = 100; // 0.01%
    IQuoterV2 constant uniV3QuoterSepolia = IQuoterV2(0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3);

    address deployer;

    function run() external {
        if (vm.envBytes("DEPLOYER").length == 20) {
            // address
            deployer = vm.envAddress("DEPLOYER");
            vm.startBroadcast(deployer);
        } else {
            // private key
            uint256 privateKey = vm.envUint("DEPLOYER");
            deployer = vm.addr(privateKey);
            vm.startBroadcast(privateKey);
        }

        console2.log(deployer, "deployer");
        console2.log(deployer.balance, "deployer balance");

        IExchangeHelpers exchangeHelpers = new HybridCurveUniV3ExchangeHelpers(
            USDC,
            WETH,
            usdcCurvePool,
            USDC_INDEX, // USDC Curve pool index
            BOLD_TOKEN_INDEX, // BOLD Curve pool index
            UNIV3_FEE_USDC_WETH,
            UNIV3_FEE_WETH_COLL,
            uniV3QuoterSepolia
        );
        console2.log(address(exchangeHelpers), "exchangeHelpers");
    }
}
