// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "./TestContracts/Accounts.sol";
import {ERC20Faucet} from "./TestContracts/ERC20Faucet.sol";
import "./TestContracts/ActivePoolMock.sol";
import "./TestContracts/StabilityPoolPermissionless.sol";
import "src/BoldToken.sol";
import "src/AddressesRegistry.sol";
import "src/Interfaces/IActivePool.sol";
//import "src/Interfaces/IBoldToken.sol";
import "src/Interfaces/ICollSurplusPool.sol";
import "src/Interfaces/IDefaultPool.sol";
import "src/Interfaces/IPriceFeed.sol";
import "src/Interfaces/ISortedTroves.sol";
import "src/Interfaces/IStabilityPool.sol";
import {Logging} from "./Utils/Logging.sol";
import {StringFormatting} from "./Utils/StringFormatting.sol";

contract StabilityPoolPermissionlessTest is TestAccounts, Logging {
    using StringFormatting for uint256;

    uint256 price = 1000e18;

    IBoldToken boldToken;
    ERC20Faucet collToken;
    StabilityPoolPermissionless stabilityPool;
    ActivePoolMock activePool;
    uint256 constant CCR = 150e16;
    uint256 constant MCR = 110e16;
    uint256 constant BCR = 10e16;
    uint256 constant SCR = 110e16;
    uint256 constant LIQUIDATION_PENALTY_SP = 5e16;
    uint256 constant LIQUIDATION_PENALTY_REDISTRIBUTION = 10e16;
    uint256 P_PRECISION;
    uint256 SCALE_FACTOR;
    uint256 SCALE_SPAN;

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

        boldToken =  new BoldToken(A);
        collToken =  new ERC20Faucet("Coll token", "COLL", 1e24, 0);

        activePool = new ActivePoolMock(collToken, boldToken);

        AddressesRegistry addressesRegistry = new AddressesRegistry(
            A,
            CCR,
            MCR,
            BCR,
            SCR,
            LIQUIDATION_PENALTY_SP,
            LIQUIDATION_PENALTY_REDISTRIBUTION
        );
        IAddressesRegistry.AddressVars memory addresses = IAddressesRegistry.AddressVars({
            collToken: IERC20Metadata(address(collToken)),
            borrowerOperations: IBorrowerOperations(address(0)),
            troveManager: ITroveManager(address(0)),
            troveNFT: ITroveNFT(address(0)),
            metadataNFT: IMetadataNFT(address(0)),
            stabilityPool: IStabilityPool(address(0)),
            priceFeed: IPriceFeed(address(0)),
            activePool: IActivePool(address(activePool)),
            defaultPool: IDefaultPool(address(0)),
            gasPoolAddress: address(0),
            collSurplusPool: ICollSurplusPool(address(0)),
            sortedTroves: ISortedTroves(address(0)),
            interestRouter: IInterestRouter(address(0)),
            hintHelpers: IHintHelpers(address(0)),
            multiTroveGetter: IMultiTroveGetter(address(0)),
            collateralRegistry: ICollateralRegistry(address(0)),
            boldToken: boldToken,
            WETH: IWETH(address(0))
        });


        vm.startPrank(A);
        addressesRegistry.setAddresses(addresses);
        vm.stopPrank();

        stabilityPool = new StabilityPoolPermissionless(addressesRegistry);
        P_PRECISION = stabilityPool.P_PRECISION();
        SCALE_FACTOR = stabilityPool.SCALE_FACTOR();
        SCALE_SPAN = stabilityPool.SCALE_SPAN();

        // Link SP and AP mocks
        activePool.setAddresses(stabilityPool);

        // Link SP and AP mocks to Bold
        vm.startPrank(A);
        boldToken.setBranchAddresses(
            address(0),
            address(stabilityPool),
            address(0),
            address(activePool)
        );

        // Give some Bold and Coll to test accounts, and approve it to SP
        uint256 initialBoldAmount = 1e36;
        uint256 initialCollAmount = initialBoldAmount * DECIMAL_PRECISION / price;
        for (uint256 i = 0; i < 6; i++) {
            // A to F
            activePool.mintBold(accountsList[i], initialBoldAmount);
        }
        vm.stopPrank();

        // Make sure there’s coll for liquidations
        deal(address(collToken), address(activePool), initialCollAmount);
    }

    // --- SP wrappers

    function provideToSP(address _account, uint256 _amount) internal {
        provideToSP(_account, _amount, false);
    }

    function provideToSP(address _account, uint256 _amount, bool _doClaim) internal {
        vm.startPrank(_account);
        stabilityPool.provideToSP(_amount, _doClaim);
        vm.stopPrank();
    }

    function withdrawFromSP(address _account, uint256 _amount) internal {
        withdrawFromSP(_account, _amount, false);
    }

    function withdrawFromSP(address _account, uint256 _amount, bool _doClaim) internal {
        vm.startPrank(_account);
        stabilityPool.withdrawFromSP(_amount, _doClaim);
        vm.stopPrank();
    }

    function offset(address _account, uint256 _debt) internal {
        uint256 coll = _debt * MCR / price;
        if (coll > 1) coll -= 1;
        offset(_account, _debt, coll);
    }

    function offset(address _account, uint256 _debt, uint256 _coll) internal {
        //info("offset debt: ", _debt);
        //info("offset coll: ", _coll);
        vm.startPrank(_account);
        stabilityPool.offset(_debt, _coll);
        vm.stopPrank();
    }

    function triggerBoldRewards(uint256 _amount) internal {
        activePool.triggerBoldRewards(_amount); // Will call SP.triggerBoldRewards
    }

    // --- Tests

    function testSPBasicActions() public {
        provideToSP(A, 10e18);
        assertEq(stabilityPool.getCompoundedBoldDeposit(A), 10e18);

        withdrawFromSP(A, 1e18);
        assertEq(stabilityPool.getCompoundedBoldDeposit(A), 9e18);

        triggerBoldRewards(100e18);
        assertApproxEqAbs(stabilityPool.getDepositorYieldGain(A), 100e18, 1);

        assertEq(stabilityPool.getDepositorCollGain(A), 0);

        offset(A, 5e18);
        assertApproxEqAbs(stabilityPool.getCompoundedBoldDeposit(A), 4e18, 1);
        assertApproxEqAbs(stabilityPool.getDepositorCollGain(A), 55e14, 1);
    }

    // --- Log helper functions

    function info(uint256 _amount, string memory _desc) internal pure {
        info(_amount.decimal(), _desc);
    }

    function info(string memory _desc, uint256 _amount) internal pure {
        info(_desc, _amount.decimal());
    }
}
