// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import {Script} from "forge-std/Script.sol";
import {Strings} from "openzeppelin-contracts/contracts/utils/Strings.sol";
import {ICurveStableSwapFactoryNG} from "test/Interfaces/Curve/ICurveStableSwapFactoryNG.sol";
import {ERC20Faucet} from "test/TestContracts/ERC20Faucet.sol";

contract DeploySomeCurvePools is Script {
    using Strings for *;

    ICurveStableSwapFactoryNG constant factory = ICurveStableSwapFactoryNG(0x6A8cbed756804B16E05E741eDaBd5cB544AE21bf);

    function run() external {
        vm.startBroadcast();

        for (uint256 i = 1; i <= 3; ++i) {
            address[] memory coins = new address[](2);
            uint8[] memory assetTypes = new uint8[](2);
            bytes4[] memory methodIds = new bytes4[](2);
            address[] memory oracles = new address[](2);

            coins[0] = address(
                new ERC20Faucet({
                    _name: string.concat("Coin #", i.toString(), ".1"),
                    _symbol: string.concat("COIN", i.toString(), "1"),
                    _tapAmount: 0,
                    _tapPeriod: 0
                })
            );

            coins[1] = address(
                new ERC20Faucet({
                    _name: string.concat("Coin #", i.toString(), ".2"),
                    _symbol: string.concat("COIN", i.toString(), "2"),
                    _tapAmount: 0,
                    _tapPeriod: 0
                })
            );

            factory.deploy_plain_pool({
                _name: string.concat("Fancy Pool #", i.toString()),
                _symbol: string.concat(string.concat("POOL", i.toString())),
                _coins: coins,
                _A: 100,
                _fee: 4000000,
                _offpeg_fee_multiplier: 20000000000,
                _ma_exp_time: 866,
                _implementation_idx: 0,
                _asset_types: assetTypes,
                _method_ids: methodIds,
                _oracles: oracles
            });
        }
    }
}
