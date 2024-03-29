// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.18;

import {Script} from "forge-std/Script.sol";
import {ActivePool} from "../src/ActivePool.sol";
import {BorrowerOperations} from "../src/BorrowerOperations.sol";
import {CollSurplusPool} from "../src/CollSurplusPool.sol";
import {DefaultPool} from "../src/DefaultPool.sol";
import {GasPool} from "../src/GasPool.sol";
import {PriceFeedTestnet} from "../src/TestContracts/PriceFeedTestnet.sol";
import {PriceFeedMock} from "../src/test/TestContracts/PriceFeedMock.sol";
import {SortedTroves} from "../src/SortedTroves.sol";
import {StabilityPool} from "../src/StabilityPool.sol";
import {TroveManager} from "../src/TroveManager.sol";
import {BoldToken} from "../src/BoldToken.sol";
import {FunctionCaller} from "../src/TestContracts/FunctionCaller.sol";
import {HintHelpers} from "../src/HintHelpers.sol";
import {Accounts} from "../src/test/TestContracts/Accounts.sol";

contract DeployLiquity2Script is Script {
    ActivePool activePool;
    BorrowerOperations borrowerOperations;
    CollSurplusPool collSurplusPool;
    DefaultPool defaultPool;
    GasPool gasPool;
    PriceFeedTestnet priceFeed;
    SortedTroves sortedTroves;
    StabilityPool stabilityPool;
    TroveManager troveManager;
    BoldToken boldToken;
    FunctionCaller functionCaller;
    HintHelpers hintHelpers;

    function run() external {
        if (vm.envBytes("DEPLOYER").length == 20) {
            // address
            vm.startBroadcast(vm.envAddress("DEPLOYER"));
        } else {
            // private key
            vm.startBroadcast(vm.envUint("DEPLOYER"));
        }

        deployCoreContracts();
        connectCoreContracts();

        vm.stopBroadcast();

        if (vm.envOr("OPEN_DEMO_TROVES", false)) {
            openDemoTroves();
        }
    }

    function deployCoreContracts() internal {
        activePool = new ActivePool();
        borrowerOperations = new BorrowerOperations();
        collSurplusPool = new CollSurplusPool();
        defaultPool = new DefaultPool();
        gasPool = new GasPool();
        priceFeed = new PriceFeedTestnet();
        sortedTroves = new SortedTroves();
        stabilityPool = new StabilityPool();
        troveManager = new TroveManager();
        boldToken = new BoldToken(address(troveManager), address(stabilityPool), address(borrowerOperations));
        functionCaller = new FunctionCaller();
        hintHelpers = new HintHelpers();
    }

    function connectCoreContracts() internal {
        troveManager.setAddresses(
            address(borrowerOperations),
            address(activePool),
            address(defaultPool),
            address(stabilityPool),
            address(gasPool),
            address(collSurplusPool),
            address(priceFeed),
            address(boldToken),
            address(sortedTroves)
        );
        stabilityPool.setAddresses(
            address(borrowerOperations),
            address(troveManager),
            address(activePool),
            address(boldToken),
            address(sortedTroves),
            address(priceFeed)
        );

        sortedTroves.setParams(
            0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff,
            address(troveManager),
            address(borrowerOperations)
        );
        functionCaller.setTroveManagerAddress(address(troveManager));
        functionCaller.setSortedTrovesAddress(address(sortedTroves));
        borrowerOperations.setAddresses(
            address(troveManager),
            address(activePool),
            address(defaultPool),
            address(stabilityPool),
            address(gasPool),
            address(collSurplusPool),
            address(priceFeed),
            address(sortedTroves),
            address(boldToken)
        );
        activePool.setAddresses(
            address(borrowerOperations), address(troveManager), address(stabilityPool), address(defaultPool)
        );
        defaultPool.setAddresses(address(troveManager), address(activePool));
        collSurplusPool.setAddresses(address(borrowerOperations), address(troveManager), address(activePool));
        hintHelpers.setAddresses(address(sortedTroves), address(troveManager));
    }

    struct TroveParams {
        uint256 coll;
        uint256 debt;
    }

    function openDemoTroves() internal {
        address[10] memory accounts = createAccounts();

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
            borrowerOperations.openTrove{value: troves[i].coll}(
                1e18, // max fee, 100%
                troves[i].debt, // debt in BOLD
                address(0), // upperHint
                address(0), // lowerHint
                5 * 1e16 // interest rate, 5%
            );
            vm.stopPrank();
        }
    }

    function createAccounts() internal returns (address[10] memory accountsList) {
        Accounts accounts = new Accounts();
        for (uint256 i = 0; i < accounts.getAccountsCount(); i++) {
            accountsList[i] = vm.addr(uint256(accounts.accountsPks(i)));
            vm.deal(accountsList[i], 1000 * 1e18);
        }
    }
}
