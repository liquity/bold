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

        (LiquityContracts memory contracts,,,,,) = _deployAndConnectContracts();
        vm.stopBroadcast();

        if (vm.envOr("OPEN_DEMO_TROVES", false)) {
            openDemoTroves(contracts.collToken, contracts.borrowerOperations);
        }
    }

    function openDemoTroves(IERC20 collToken, IBorrowerOperations borrowerOperations) internal {
        // Anvil accounts
        // TODO: pass accounts from env
        uint256[8] memory accounts = [
            0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80,
            0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d,
            0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a,
            0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6,
            0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a,
            0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba,
            0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e,
            0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356
        ];

        TroveParams[8] memory troves = [
            TroveParams({owner: accounts[0], ownerIndex: 0, coll: 20e18, debt: 1800e18}),
            TroveParams({owner: accounts[1], ownerIndex: 0, coll: 32e18, debt: 2800e18}),
            TroveParams({owner: accounts[2], ownerIndex: 0, coll: 30e18, debt: 4000e18}),
            TroveParams({owner: accounts[3], ownerIndex: 0, coll: 65e18, debt: 6000e18}),
            TroveParams({owner: accounts[4], ownerIndex: 0, coll: 50e18, debt: 5000e18}),
            TroveParams({owner: accounts[5], ownerIndex: 0, coll: 37e18, debt: 2400e18}),
            TroveParams({owner: accounts[6], ownerIndex: 0, coll: 37e18, debt: 2800e18}),
            TroveParams({owner: accounts[7], ownerIndex: 0, coll: 36e18, debt: 2222e18})
        ];

        for (uint256 i = 0; i < troves.length; i++) {
            vm.startBroadcast(troves[i].owner);

            ERC20Faucet(address(collToken)).tap();

            // Approve infinite collToken to BorrowerOperations
            collToken.approve(address(borrowerOperations), type(uint256).max);

            borrowerOperations.openTrove(
                vm.addr(troves[i].owner), // _owner
                troves[i].ownerIndex, //     _ownerIndex
                troves[i].coll, //           _ETHAmount
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
