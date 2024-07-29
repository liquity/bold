// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.18;

import {Script} from "forge-std/Script.sol";
import {StdCheats} from "forge-std/StdCheats.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {Accounts} from "../test/TestContracts/Accounts.sol";
import {ERC20Faucet} from "../test/TestContracts/ERC20Faucet.sol";
import {ETH_GAS_COMPENSATION} from "../Dependencies/Constants.sol";
import {IBorrowerOperations} from "../Interfaces/IBorrowerOperations.sol";
import "../AddressesRegistry.sol";
import "../ActivePool.sol";
import "../BoldToken.sol";
import "../BorrowerOperations.sol";
import "../CollSurplusPool.sol";
import "../DefaultPool.sol";
import "../GasPool.sol";
import "../HintHelpers.sol";
import "../MultiTroveGetter.sol";
import "../SortedTroves.sol";
import "../StabilityPool.sol";
import "../test/TestContracts/BorrowerOperationsTester.t.sol";
import "../test/TestContracts/TroveManagerTester.t.sol";
import "../TroveNFT.sol";
import "../CollateralRegistry.sol";
import "../MockInterestRouter.sol";
import "../test/TestContracts/PriceFeedTestnet.sol";
import {WETHTester} from "../test/TestContracts/WETHTester.sol";

contract DeployLiquity2Script is Script, StdCheats {
    bytes32 constant SALT = keccak256("LiquityV2");

    address deployer;

    struct LiquityContractsTestnet {
        IAddressesRegistry addressesRegistry;
        IActivePool activePool;
        IBorrowerOperations borrowerOperations;
        ICollSurplusPool collSurplusPool;
        IDefaultPool defaultPool;
        ISortedTroves sortedTroves;
        IStabilityPool stabilityPool;
        ITroveManager troveManager;
        ITroveNFT troveNFT;
        IPriceFeedTestnet priceFeed; // Tester
        GasPool gasPool;
        IInterestRouter interestRouter;
        IERC20 collToken;
    }

    struct LiquityContractAddresses {
        address activePool;
        address borrowerOperations;
        address collSurplusPool;
        address defaultPool;
        address sortedTroves;
        address stabilityPool;
        address troveManager;
        address troveNFT;
        address priceFeed;
        address gasPool;
        address interestRouter;
    }

    struct TroveManagerParams {
        uint256 CCR;
        uint256 MCR;
        uint256 SCR;
        uint256 LIQUIDATION_PENALTY_SP;
        uint256 LIQUIDATION_PENALTY_REDISTRIBUTION;
    }

    struct DeploymentVarsTestnet {
        uint256 numCollaterals;
        IERC20[] collaterals;
        LiquityContractsTestnet contracts;
        bytes bytecode;
        address boldTokenAddress;
        uint256 i;
    }

    struct DemoTroveParams {
        uint256 coll;
        uint256 debt;
        uint256 owner;
        uint256 ownerIndex;
    }

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

        TroveManagerParams[] memory troveManagerParamsArray = new TroveManagerParams[](1);

        troveManagerParamsArray[0] = TroveManagerParams(150e16, 110e16, 110e16, 5e16, 10e16);

        // used for gas compensation and as collateral of the first branch
        IWETH WETH = new WETHTester(
            100 ether, //     _tapAmount
            1 days //         _tapPeriod
        );
        (LiquityContractsTestnet[] memory contractsArray,,,,) =
            _deployAndConnectContracts(troveManagerParamsArray, WETH);
        LiquityContractsTestnet memory contracts = contractsArray[0];
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

    function tapFaucet(uint256[] memory accounts, LiquityContractsTestnet memory contracts) internal {
        for (uint256 i = 0; i < accounts.length; i++) {
            vm.startBroadcast(accounts[i]);
            ERC20Faucet(address(contracts.collToken)).tap();
            vm.stopBroadcast();
        }
    }

    function openDemoTroves(DemoTroveParams[] memory troves, LiquityContractsTestnet memory contracts) internal {
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

    // See: https://solidity-by-example.org/app/create2/
    function getBytecode(bytes memory _creationCode, address _addressesRegistry) public pure returns (bytes memory) {
        return abi.encodePacked(_creationCode, abi.encode(_addressesRegistry));
    }

    function _deployAndConnectContracts(TroveManagerParams[] memory troveManagerParamsArray, IWETH _WETH)
        internal
        returns (
            LiquityContractsTestnet[] memory contractsArray,
            ICollateralRegistry collateralRegistry,
            IBoldToken boldToken,
            HintHelpers hintHelpers,
            MultiTroveGetter multiTroveGetter
        )
    {
        DeploymentVarsTestnet memory vars;
        vars.numCollaterals = troveManagerParamsArray.length;
        // Deploy Bold
        vars.bytecode = abi.encodePacked(type(BoldToken).creationCode, abi.encode(deployer));
        vars.boldTokenAddress = vm.computeCreate2Address(SALT, keccak256(vars.bytecode));
        boldToken = new BoldToken{salt: SALT}(deployer);
        assert(address(boldToken) == vars.boldTokenAddress);

        contractsArray = new LiquityContractsTestnet[](vars.numCollaterals);
        vars.collaterals = new IERC20[](vars.numCollaterals);

        // Deploy the first branch with WETH collateral
        vars.collaterals[0] = _WETH;
        for (vars.i = 1; vars.i < vars.numCollaterals; vars.i++) {
            IERC20 collToken = new ERC20Faucet(
                string.concat("Staked ETH", string(abi.encode(vars.i))), // _name
                string.concat("stETH", string(abi.encode(vars.i))), // _symbol
                100 ether, //     _tapAmount
                1 days //         _tapPeriod
            );
            vars.collaterals[vars.i] = collToken;
        }

        collateralRegistry = new CollateralRegistry(boldToken, vars.collaterals);
        hintHelpers = new HintHelpers(collateralRegistry);
        multiTroveGetter = new MultiTroveGetter(collateralRegistry);

        vars.contracts = _deployAndConnectCollateralContractsTestnet(
            0, _WETH, boldToken, collateralRegistry, _WETH, hintHelpers, multiTroveGetter, troveManagerParamsArray[0]
        );
        contractsArray[0] = vars.contracts;

        // Deploy the remaining branches with LST collateral
        for (vars.i = 1; vars.i < vars.numCollaterals; vars.i++) {
            vars.contracts = _deployAndConnectCollateralContractsTestnet(
                vars.i,
                vars.collaterals[vars.i],
                boldToken,
                collateralRegistry,
                _WETH,
                hintHelpers,
                multiTroveGetter,
                troveManagerParamsArray[vars.i]
            );
            contractsArray[vars.i] = vars.contracts;
        }

        boldToken.setCollateralRegistry(address(collateralRegistry));
    }

    function _deployAndConnectCollateralContractsTestnet(
        uint256 _branch,
        IERC20 _collToken,
        IBoldToken _boldToken,
        ICollateralRegistry _collateralRegistry,
        IWETH _weth,
        IHintHelpers _hintHelpers,
        IMultiTroveGetter _multiTroveGetter,
        TroveManagerParams memory _troveManagerParams
    ) internal returns (LiquityContractsTestnet memory contracts) {
        LiquityContractAddresses memory addresses;
        contracts.collToken = _collToken;

        // Deploy all contracts, using testers for TM and PriceFeed
        contracts.addressesRegistry = new AddressesRegistry(
            deployer,
            _troveManagerParams.CCR,
            _troveManagerParams.MCR,
            _troveManagerParams.SCR,
            _troveManagerParams.LIQUIDATION_PENALTY_SP,
            _troveManagerParams.LIQUIDATION_PENALTY_REDISTRIBUTION
        );
        contracts.priceFeed = new PriceFeedTestnet();
        contracts.interestRouter = new MockInterestRouter();
        addresses.borrowerOperations = vm.computeCreate2Address(
            SALT, keccak256(getBytecode(type(BorrowerOperations).creationCode, address(contracts.addressesRegistry)))
        );
        addresses.troveManager = vm.computeCreate2Address(
            SALT, keccak256(getBytecode(type(TroveManager).creationCode, address(contracts.addressesRegistry)))
        );
        addresses.troveNFT = vm.computeCreate2Address(
            SALT, keccak256(getBytecode(type(TroveNFT).creationCode, address(contracts.addressesRegistry)))
        );
        addresses.stabilityPool = vm.computeCreate2Address(
            SALT, keccak256(getBytecode(type(StabilityPool).creationCode, address(contracts.addressesRegistry)))
        );
        addresses.activePool = vm.computeCreate2Address(
            SALT, keccak256(getBytecode(type(ActivePool).creationCode, address(contracts.addressesRegistry)))
        );
        addresses.defaultPool = vm.computeCreate2Address(
            SALT, keccak256(getBytecode(type(DefaultPool).creationCode, address(contracts.addressesRegistry)))
        );
        addresses.gasPool = vm.computeCreate2Address(
            SALT, keccak256(getBytecode(type(GasPool).creationCode, address(contracts.addressesRegistry)))
        );
        addresses.collSurplusPool = vm.computeCreate2Address(
            SALT, keccak256(getBytecode(type(CollSurplusPool).creationCode, address(contracts.addressesRegistry)))
        );
        addresses.sortedTroves = vm.computeCreate2Address(
            SALT, keccak256(getBytecode(type(SortedTroves).creationCode, address(contracts.addressesRegistry)))
        );

        IAddressesRegistry.AddressVars memory addressVars = IAddressesRegistry.AddressVars({
            collToken: _collToken,
            borrowerOperations: IBorrowerOperations(addresses.borrowerOperations),
            troveManager: ITroveManager(addresses.troveManager),
            troveNFT: ITroveNFT(addresses.troveNFT),
            stabilityPool: IStabilityPool(addresses.stabilityPool),
            priceFeed: contracts.priceFeed,
            activePool: IActivePool(addresses.activePool),
            defaultPool: IDefaultPool(addresses.defaultPool),
            gasPoolAddress: addresses.gasPool,
            collSurplusPool: ICollSurplusPool(addresses.collSurplusPool),
            sortedTroves: ISortedTroves(addresses.sortedTroves),
            interestRouter: contracts.interestRouter,
            hintHelpers: _hintHelpers,
            multiTroveGetter: _multiTroveGetter,
            collateralRegistry: _collateralRegistry,
            boldToken: _boldToken,
            WETH: _weth
        });
        contracts.addressesRegistry.setAddresses(addressVars);

        contracts.borrowerOperations = new BorrowerOperations{salt: SALT}(contracts.addressesRegistry);
        contracts.troveManager = new TroveManager{salt: SALT}(contracts.addressesRegistry);
        contracts.troveNFT = new TroveNFT{salt: SALT}(contracts.addressesRegistry);
        contracts.stabilityPool = new StabilityPool{salt: SALT}(contracts.addressesRegistry);
        contracts.activePool = new ActivePool{salt: SALT}(contracts.addressesRegistry);
        contracts.defaultPool = new DefaultPool{salt: SALT}(contracts.addressesRegistry);
        contracts.gasPool = new GasPool{salt: SALT}(contracts.addressesRegistry);
        contracts.collSurplusPool = new CollSurplusPool{salt: SALT}(contracts.addressesRegistry);
        contracts.sortedTroves = new SortedTroves{salt: SALT}(contracts.addressesRegistry);

        assert(address(contracts.borrowerOperations) == addresses.borrowerOperations);
        assert(address(contracts.troveManager) == addresses.troveManager);
        assert(address(contracts.troveNFT) == addresses.troveNFT);
        assert(address(contracts.stabilityPool) == addresses.stabilityPool);
        assert(address(contracts.activePool) == addresses.activePool);
        assert(address(contracts.defaultPool) == addresses.defaultPool);
        assert(address(contracts.gasPool) == addresses.gasPool);
        assert(address(contracts.collSurplusPool) == addresses.collSurplusPool);
        assert(address(contracts.sortedTroves) == addresses.sortedTroves);

        // Connect contracts
        _boldToken.setBranchAddresses(
            address(contracts.troveManager),
            address(contracts.stabilityPool),
            address(contracts.borrowerOperations),
            address(contracts.activePool)
        );

        _collateralRegistry.setTroveManager(_branch, contracts.troveManager);
    }
}
