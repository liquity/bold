// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.18;

import {Script} from "forge-std/Script.sol";
import {StdCheats} from "forge-std/StdCheats.sol";
import "../deployment.sol";
import {Accounts} from "../test/TestContracts/Accounts.sol";
import {ERC20Faucet} from "../test/TestContracts/ERC20Faucet.sol";

contract DeployLiquity2Script is Script, StdCheats {
    struct TroveParams {
        uint256 coll;
        uint256 collIndex;
        uint256 debt;
        uint256 owner;
        uint256 ownerIndex;
    }

    function run() external {
        bool demo = vm.envOr("OPEN_DEMO_TROVES", false);

        if (vm.envBytes("DEPLOYER").length == 20) {
            // address
            vm.startBroadcast(vm.envAddress("DEPLOYER"));
        } else {
            // private key
            vm.startBroadcast(vm.envUint("DEPLOYER"));
        }

        LiquityContractsDev[] memory contractsArray = new LiquityContractsDev[](2);
        if (demo) {
            TroveManagerParams[] memory troveManagerParamsArray = new TroveManagerParams[](2);
            troveManagerParamsArray[0] = TroveManagerParams(150e16, 110e16, 110e16, 5e16, 10e16);
            troveManagerParamsArray[1] = TroveManagerParams(150e16, 110e16, 110e16, 5e16, 10e16);
            (contractsArray,,,,,) = _deployAndConnectContractsMultiColl(troveManagerParamsArray);
        } else {
            _deployAndConnectContracts();
        }

        vm.stopBroadcast();

        if (demo) {
            demoState(contractsArray);
        }
    }

    function demoState(LiquityContractsDev[] memory contractsArray) internal {
        // Anvil default accounts
        // TODO: get accounts from env
        uint256[] memory accounts = new uint256[](8);
        accounts[0] = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        accounts[1] = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;
        accounts[2] = 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a;
        accounts[3] = 0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6;
        accounts[4] = 0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a;
        accounts[5] = 0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba;
        accounts[6] = 0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e;
        accounts[7] = 0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356;

        DemoTroveParams[] memory troves = new DemoTroveParams[](4);
        troves[0] = DemoTroveParams({collIndex: 0, owner: accounts[0], ownerIndex: 0, coll: 25e18, debt: 2800e18});
        troves[1] = DemoTroveParams({collIndex: 0, owner: accounts[1], ownerIndex: 0, coll: 37e18, debt: 2400e18});
        troves[2] = DemoTroveParams({collIndex: 0, owner: accounts[2], ownerIndex: 0, coll: 30e18, debt: 4000e18});
        troves[3] = DemoTroveParams({collIndex: 0, owner: accounts[3], ownerIndex: 0, coll: 65e18, debt: 6000e18});

        for (uint256 i = 0; i < contractsArray.length; i++) {
            tapFaucet(accounts, contractsArray[i]);
        }

        openDemoTroves(troves, contractsArray);
    }

    function tapFaucet(uint256[] memory accounts, LiquityContractsDev memory contracts) internal {
        for (uint256 i = 0; i < accounts.length; i++) {
            vm.startBroadcast(accounts[i]);
            ERC20Faucet(address(contracts.collToken)).tap();
            vm.stopBroadcast();
        }
    }

    function openDemoTroves(DemoTroveParams[] memory troves, LiquityContractsDev[] memory contractsArray) internal {
        for (uint256 i = 0; i < troves.length; i++) {
            DemoTroveParams memory trove = troves[i];
            LiquityContractsDev memory contracts = contractsArray[trove.collIndex];

            ERC20Faucet(address(collToken)).tap();

            // Approve infinite collToken to BorrowerOperations
            collToken.approve(address(borrowerOperations), type(uint256).max);

            borrowerOperations.openTrove(
                vm.addr(troves[i].owner), // _owner
                troves[i].ownerIndex, //     _ownerIndex
                troves[i].coll, //           _collAmount
                troves[i].debt, //           _boldAmount
                0, //                        _upperHint
                0, //                        _lowerHint
                0.05e18, //                  _annualInterestRate
                type(uint256).max //         _maxUpfrontFee
            );

            vm.stopBroadcast();
        }
    }
}
