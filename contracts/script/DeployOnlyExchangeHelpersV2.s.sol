// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import {console} from "forge-std/console.sol";
import {Script} from "forge-std/Script.sol";
import {Strings} from "openzeppelin-contracts/contracts/utils/Strings.sol";
import {ICurveStableswapNGPool} from "../src/Zappers/Modules/Exchanges/Curve/ICurveStableswapNGPool.sol";
import {IQuoterV2} from "../src/Zappers/Modules/Exchanges/UniswapV3/IQuoterV2.sol";
import {HybridCurveUniV3ExchangeHelpersV2} from "../src/Zappers/Modules/Exchanges/HybridCurveUniV3ExchangeHelpersV2.sol";
import {UseDeployment} from "../test/Utils/UseDeployment.sol";

uint24 constant UNIV3_FEE_USDC_WETH = 500; // 0.05%
uint24 constant UNIV3_FEE_WETH_COLL = 100; // 0.01%

IQuoterV2 constant uniV3QuoterMainnet = IQuoterV2(0x61fFE014bA17989E743c5F6cB21bF9697530B21e);
IQuoterV2 constant uniV3QuoterSepolia = IQuoterV2(0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3);

contract DeployOnlyExchangeHelpersV2 is Script, UseDeployment {
    using Strings for *;

    function run() external {
        if (block.chainid != 1 && block.chainid != 11155111) {
            revert("Unsupported chain");
        }

        _loadDeploymentFromManifest(string.concat("addresses/", block.chainid.toString(), ".json"));

        vm.startBroadcast();
        HybridCurveUniV3ExchangeHelpersV2 exchangeHelpersV2 = new HybridCurveUniV3ExchangeHelpersV2({
            _usdc: USDC,
            _weth: WETH,
            _curvePool: ICurveStableswapNGPool(address(curveUsdcBold)),
            _usdcIndex: int8(curveUsdcBold.coins(0) == USDC ? 0 : 1),
            _boldIndex: int8(curveUsdcBold.coins(0) == BOLD ? 0 : 1),
            _feeUsdcWeth: UNIV3_FEE_USDC_WETH,
            _feeWethColl: UNIV3_FEE_WETH_COLL,
            _uniV3Quoter: block.chainid == 1 ? uniV3QuoterMainnet : uniV3QuoterSepolia
        });

        console.log("exchangeHelpersV2:", address(exchangeHelpersV2));
    }
}
