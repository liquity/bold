// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.18;

import {Script} from "forge-std/Script.sol";
import {StdCheats} from "forge-std/StdCheats.sol";
import "../deployment.sol";
import {Accounts} from "../test/TestContracts/Accounts.sol";

contract DeployLiquity2Script is Script, StdCheats {
    struct TroveParams {
        uint256 coll;
        uint256 debt;
    }

    function run() external {
        if (vm.envBytes("DEPLOYER").length == 20) {
            // address
            vm.startBroadcast(vm.envAddress("DEPLOYER"));
        } else {
            // private key
            vm.startBroadcast(vm.envUint("DEPLOYER"));
        }

        LiquityContracts memory contracts = _deployAndConnectContracts();
        vm.stopBroadcast();

        if (vm.envOr("OPEN_DEMO_TROVES", false)) {
            openDemoTroves(contracts.WETH, contracts.borrowerOperations);
        }
    }

    function openDemoTroves(IERC20 WETH, IBorrowerOperations borrowerOperations) internal {
        address[10] memory accounts = createAccounts(WETH, borrowerOperations);

        uint256 eth = 1e18;
        uint256 bold = 1e18;

        TroveParams[8] memory troves = [
            TroveParams(20 * eth, 1800 * bold),
            TroveParams(32 * eth, 2800 * bold),
            TroveParams(30 * eth, 4000 * bold),
            TroveParams(65 * eth, 6000 * bold),
            TroveParams(50 * eth, 5000 * bold),
            TroveParams(37 * eth, 2400 * bold),
            TroveParams(37 * eth, 2800 * bold),
            TroveParams(36 * eth, 2222 * bold)
        ];

        for (uint256 i = 0; i < troves.length; i++) {
            vm.startPrank(accounts[i]);

            borrowerOperations.openTrove(
                accounts[i], //    _owner
                1, //              _ownerIndex
                1e18, //           _maxFeePercentage
                troves[i].coll, // _ETHAmount
                troves[i].debt, // _boldAmount
                0, //              _upperHint
                0, //              _lowerHint
                0.05e18 //         _annualInterestRate
            );

            vm.stopPrank();
        }
    }

    function createAccounts(IERC20 WETH, IBorrowerOperations borrowerOperations)
        internal
        returns (address[10] memory accountsList)
    {
        Accounts accounts = new Accounts();

        for (uint256 i = 0; i < accounts.getAccountsCount(); i++) {
            accountsList[i] = vm.addr(uint256(accounts.accountsPks(i)));
            deal(address(WETH), accountsList[i], 1000e18);

            // Approve infinite WETH to BorrowerOperations
            vm.startPrank(accountsList[i]);
            WETH.approve(address(borrowerOperations), type(uint256).max);
            vm.stopPrank();
        }
    }
}
