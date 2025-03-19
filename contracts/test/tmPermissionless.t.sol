// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "./TestContracts/Accounts.sol";
import {ERC20Faucet} from "./TestContracts/ERC20Faucet.sol";
import "./TestContracts/ActivePoolMock.sol";
import "./TestContracts/DefaultPoolMock.sol";
import "./TestContracts/BorrowerOperationsMock.sol";
import "./TestContracts/StabilityPoolMock.sol";
import "./TestContracts/PriceFeedMock.sol";
import "./TestContracts/TroveManagerPermissionless.sol";
import "src/BoldToken.sol";
import "src/AddressesRegistry.sol";
import "src/GasPool.sol";
import "src/SortedTroves.sol";
import "src/TroveNFT.sol";
import "src/Interfaces/IActivePool.sol";
//import "src/Interfaces/IBoldToken.sol";
import "src/Interfaces/ICollSurplusPool.sol";
import "src/Interfaces/IDefaultPool.sol";
import "src/Interfaces/IPriceFeed.sol";
import "src/Interfaces/ISortedTroves.sol";
import "src/Interfaces/ITroveManager.sol";
import {Logging} from "./Utils/Logging.sol";
import {StringFormatting} from "./Utils/StringFormatting.sol";

contract TroveManagerPermissionlessTest is TestAccounts, Logging {
    using StringFormatting for uint256;

    bytes32 SALT = keccak256(bytes("Permissionless"));

    uint256 constant CCR = 150e16;
    uint256 constant MCR = 110e16;
    uint256 constant BCR = 10e16;
    uint256 constant SCR = 110e16;
    uint256 constant LIQUIDATION_PENALTY_SP = 5e16;
    uint256 constant LIQUIDATION_PENALTY_REDISTRIBUTION = 10e16;

    uint256 price = 1000e18;

    IBoldToken boldToken;
    ERC20Faucet collToken;
    ERC20Faucet WETH;
    TroveManagerPermissionless troveManager;

    struct Addresses {
        address troveManagerAddress;
        address troveNFTAddress;
        address gasPoolAddress;
        address sortedTrovesAddress;
    }

    function setUp() public virtual {
        // Start tests at a non-zero timestamp
        vm.warp(block.timestamp + 600);

        accounts = new Accounts();
        createAccounts();

        (A, B, C, D, E, F, G) = (
            accountsList[0],
            accountsList[1],
            accountsList[2],
            accountsList[3],
            accountsList[4],
            accountsList[5],
            accountsList[6]
        );

        vm.startPrank(A);

        boldToken =  new BoldToken(A);
        collToken =  new ERC20Faucet("Coll token", "COLL", 1e24, 0);
        WETH =  new ERC20Faucet("WETH", "WETH", 1e24, 0);

        // Deploy mock contracts
        ActivePoolMock activePool = new ActivePoolMock(collToken, boldToken);
        DefaultPoolMock defaultPool = new DefaultPoolMock();
        BorrowerOperationsMock borrowerOperations = new BorrowerOperationsMock();
        StabilityPoolMock stabilityPool = new StabilityPoolMock();
        PriceFeedMock priceFeed = new PriceFeedMock();
        priceFeed.setPrice(price);

        AddressesRegistry addressesRegistry = new AddressesRegistry(
            A,
            CCR,
            MCR,
            BCR,
            SCR,
            LIQUIDATION_PENALTY_SP,
            LIQUIDATION_PENALTY_REDISTRIBUTION
        );

        Addresses memory tmpAddresses;
        tmpAddresses.troveManagerAddress = vm.computeCreate2Address(
            SALT, keccak256(abi.encodePacked(type(TroveManagerPermissionless).creationCode, abi.encode(address(addressesRegistry)))), A
        );
        tmpAddresses.troveNFTAddress = vm.computeCreate2Address(
            SALT, keccak256(abi.encodePacked(type(TroveNFT).creationCode, abi.encode(address(addressesRegistry)))), A
        );

        tmpAddresses.gasPoolAddress = vm.computeCreate2Address(
            SALT, keccak256(abi.encodePacked(type(GasPool).creationCode, abi.encode(addressesRegistry))), A
        );
        tmpAddresses.sortedTrovesAddress = vm.computeCreate2Address(
            SALT, keccak256(abi.encodePacked(type(SortedTroves).creationCode, abi.encode(addressesRegistry))), A
        );
        IAddressesRegistry.AddressVars memory addresses = IAddressesRegistry.AddressVars({
            collToken: IERC20Metadata(address(collToken)),
            borrowerOperations: IBorrowerOperations(address(borrowerOperations)),
            troveManager: ITroveManager(address(tmpAddresses.troveManagerAddress)),
            troveNFT: ITroveNFT(tmpAddresses.troveNFTAddress),
            metadataNFT: IMetadataNFT(address(0)),
            stabilityPool: IStabilityPool(address(stabilityPool)),
            priceFeed: IPriceFeed(address(priceFeed)),
            activePool: IActivePool(address(activePool)),
            defaultPool: IDefaultPool(address(defaultPool)),
            gasPoolAddress: tmpAddresses.gasPoolAddress,
            collSurplusPool: ICollSurplusPool(address(0)),
            sortedTroves: ISortedTroves(tmpAddresses.sortedTrovesAddress),
            interestRouter: IInterestRouter(address(0)),
            hintHelpers: IHintHelpers(address(0)),
            multiTroveGetter: IMultiTroveGetter(address(0)),
            collateralRegistry: ICollateralRegistry(address(0)),
            boldToken: boldToken,
            WETH: IWETH(address(WETH))
        });

        addressesRegistry.setAddresses(addresses);

        // Deploy other contracts
        ITroveNFT troveNFT = new TroveNFT{salt: SALT}(addressesRegistry);
        GasPool gasPool = new GasPool{salt: SALT}(addressesRegistry);
        SortedTroves sortedTroves = new SortedTroves{salt: SALT}(addressesRegistry);
        assertEq(address(troveNFT), tmpAddresses.troveNFTAddress);
        assertEq(address(gasPool), tmpAddresses.gasPoolAddress);
        assertEq(address(sortedTroves), tmpAddresses.sortedTrovesAddress);

        troveManager = new TroveManagerPermissionless{salt: SALT}(addressesRegistry);
        assertEq(address(troveManager), tmpAddresses.troveManagerAddress);

        // Link SP and AP mocks to Bold
        boldToken.setBranchAddresses(
            address(troveManager),
            address(stabilityPool),
            address(borrowerOperations),
            address(activePool)
        );

        // Give some Bold and Coll to test accounts
        uint256 initialBoldAmount = 1e36;
        uint256 initialCollAmount = initialBoldAmount * DECIMAL_PRECISION / price;
        for (uint256 i = 0; i < 6; i++) {
            // A to F
            activePool.mintBold(accountsList[i], initialBoldAmount);
        }

        vm.stopPrank();

        // TODO
        // Make sure there’s coll for liquidations
        deal(address(collToken), address(activePool), initialCollAmount);
    }

    function testTMBasicActions() public {
        TroveChange memory troveChange;
        troveChange.collIncrease = 10e18;
        troveChange.debtIncrease = 2000e18;

        troveManager.onOpenTrove(A, 1, troveChange, 5e16);
        assertEq(troveManager.getTroveColl(1), 10e18);
        assertEq(uint256(troveManager.getTroveStatus(1)), 1);

        troveManager.onOpenTroveAndJoinBatch(A, 2, troveChange, B, 0, 0);
        assertEq(troveManager.getTroveColl(2), 10e18);
        assertEq(uint256(troveManager.getTroveStatus(2)), 1);

        troveManager.onCloseTrove(1, troveChange, address(0), 0, 0);
        assertEq(troveManager.getTroveColl(1), 10e18);
        assertEq(uint256(troveManager.getTroveStatus(1)), 1);
    }
}
