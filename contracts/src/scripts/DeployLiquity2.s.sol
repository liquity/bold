// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.18;

import {Script} from "forge-std/Script.sol";
import {StdCheats} from "forge-std/StdCheats.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {TestDeployer} from "../test/TestContracts/Deployment.t.sol";
import {Accounts} from "../test/TestContracts/Accounts.sol";
import {ERC20Faucet} from "../test/TestContracts/ERC20Faucet.sol";
import {ETH_GAS_COMPENSATION} from "../Dependencies/Constants.sol";
import {IBorrowerOperations} from "../Interfaces/IBorrowerOperations.sol";

contract DeployLiquity2Script is Script, StdCheats {
    struct DemoTroveParams {
        uint256 coll;
        uint256 debt;
        uint256 owner;
        uint256 ownerIndex;
    }

    function run() external {
        if (vm.envBytes("DEPLOYER").length == 20) {
            // address
            vm.startBroadcast(vm.envAddress("DEPLOYER"));
        } else {
            // private key
            vm.startBroadcast(vm.envUint("DEPLOYER"));
        }

        TestDeployer deployer = new TestDeployer();
        (TestDeployer.LiquityContractsDev memory contracts,,,,,) = deployer.deployAndConnectContracts();
        vm.stopBroadcast();

        if (vm.envOr("OPEN_DEMO_TROVES", false)) {
            // Anvil default accounts
            // TODO: get accounts from env
            uint256[] memory demoAccounts = new uint256[](8);
            demoAccounts[0] = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
            demoAccounts[1] = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;
            demoAccounts[2] = 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a;
            demoAccounts[3] = 0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6;
            demoAccounts[4] = 0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a;
            demoAccounts[5] = 0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba;
            demoAccounts[6] = 0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e;
            demoAccounts[7] = 0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356;

            DemoTroveParams[] memory demoTroves = new DemoTroveParams[](4);
            demoTroves[0] = DemoTroveParams({owner: demoAccounts[0], ownerIndex: 0, coll: 25e18, debt: 2800e18});
            demoTroves[1] = DemoTroveParams({owner: demoAccounts[1], ownerIndex: 0, coll: 37e18, debt: 2400e18});
            demoTroves[2] = DemoTroveParams({owner: demoAccounts[2], ownerIndex: 0, coll: 30e18, debt: 4000e18});
            demoTroves[3] = DemoTroveParams({owner: demoAccounts[3], ownerIndex: 0, coll: 65e18, debt: 6000e18});

            tapFaucet(demoAccounts, contracts);
            openDemoTroves(demoTroves, contracts);
        }
    }

    function tapFaucet(uint256[] memory accounts, TestDeployer.LiquityContractsDev memory contracts) internal {
        for (uint256 i = 0; i < accounts.length; i++) {
            vm.startBroadcast(accounts[i]);
            ERC20Faucet(address(contracts.collToken)).tap();
            vm.stopBroadcast();
        }
    }

    function openDemoTroves(DemoTroveParams[] memory troves, TestDeployer.LiquityContractsDev memory contracts)
        internal
    {
        for (uint256 i = 0; i < troves.length; i++) {
            DemoTroveParams memory trove = troves[i];

            vm.startBroadcast(trove.owner);

            // Approve collToken to BorrowerOperations
            IERC20(contracts.collToken).approve(
                address(contracts.borrowerOperations), trove.coll + ETH_GAS_COMPENSATION
            );

            IBorrowerOperations(contracts.borrowerOperations).openTrove(
                vm.addr(trove.owner), // _owner
                trove.ownerIndex, //     _ownerIndex
                trove.coll, //           _collAmount
                trove.debt, //           _boldAmount
                0, //                    _upperHint
                0, //                    _lowerHint
                0.05e18, //              _annualInterestRate
                type(uint256).max, //    _maxUpfrontFee
                address(0), //           _addManager
                address(0), //           _removeManager
                address(0) //           _receiver
            );

            vm.stopBroadcast();
        }
    }
}
