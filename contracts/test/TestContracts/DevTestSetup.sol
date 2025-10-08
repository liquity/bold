// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

import "./BaseTest.sol";
import {TestDeployer} from "./Deployment.t.sol";

contract DevTestSetup is BaseTest {
    function giveAndApproveColl(address _account, uint256 _amount) public {
        return giveAndApproveCollateral(collToken, _account, _amount, address(borrowerOperations));
    }

    function giveAndApproveCollateral(
        IERC20 _token,
        address _account,
        uint256 _amount,
        address _borrowerOperationsAddress
    ) public {
        // Give some Collateral to test accounts
        deal(address(_token), _account, _amount);

        // Check accounts are funded
        assertEq(_token.balanceOf(_account), _amount);

        // Approve Coll to BorrowerOperations
        vm.startPrank(_account);
        _token.approve(_borrowerOperationsAddress, _amount);
        vm.stopPrank();

        // Check approvals
        assertEq(_token.allowance(_account, _borrowerOperationsAddress), _amount);
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

        TestDeployer deployer = new TestDeployer();
        TestDeployer.LiquityContractsDev memory contracts;
        (contracts, collateralRegistry, boldToken, hintHelpers,, WETH) = deployer.deployAndConnectContracts();
        addressesRegistry = contracts.addressesRegistry;
        collToken = contracts.collToken;
        activePool = contracts.activePool;
        borrowerOperations = contracts.borrowerOperations;
        collSurplusPool = contracts.pools.collSurplusPool;
        defaultPool = contracts.pools.defaultPool;
        gasPool = contracts.pools.gasPool;
        priceFeed = contracts.priceFeed;
        sortedTroves = contracts.sortedTroves;
        stabilityPool = contracts.stabilityPool;
        troveManager = contracts.troveManager;
        troveNFT = contracts.troveNFT;
        metadataNFT = addressesRegistry.metadataNFT();
        mockInterestRouter = contracts.interestRouter;
        systemParams = contracts.systemParams;

        // Give some Coll to test accounts, and approve it to BorrowerOperations
        uint256 initialCollAmount = 10_000_000_000e18;
        for (uint256 i = 0; i < 6; i++) {
            // A to F
            giveAndApproveColl(accountsList[i], initialCollAmount);
        }

        CCR = troveManager.get_CCR();
        MCR = troveManager.get_MCR();
        BCR = troveManager.get_BCR();
        LIQUIDATION_PENALTY_SP = troveManager.get_LIQUIDATION_PENALTY_SP();
        LIQUIDATION_PENALTY_REDISTRIBUTION = troveManager.get_LIQUIDATION_PENALTY_REDISTRIBUTION();
        
        MIN_DEBT = systemParams.MIN_DEBT();
        SP_YIELD_SPLIT = systemParams.SP_YIELD_SPLIT();
        MIN_ANNUAL_INTEREST_RATE = systemParams.MIN_ANNUAL_INTEREST_RATE();
        ETH_GAS_COMPENSATION = systemParams.ETH_GAS_COMPENSATION();
        COLL_GAS_COMPENSATION_DIVISOR = systemParams.COLL_GAS_COMPENSATION_DIVISOR();
        MIN_BOLD_IN_SP = systemParams.MIN_BOLD_IN_SP();
        REDEMPTION_FEE_FLOOR = systemParams.REDEMPTION_FEE_FLOOR();
        INITIAL_BASE_RATE = systemParams.INITIAL_BASE_RATE();
        REDEMPTION_MINUTE_DECAY_FACTOR = systemParams.REDEMPTION_MINUTE_DECAY_FACTOR();
    }

    function _setupForWithdrawCollGainToTrove() internal returns (uint256, uint256, uint256) {
        uint256 troveDebtRequest_A = 2000e18;
        uint256 troveDebtRequest_B = 3000e18;
        uint256 troveDebtRequest_C = 4500e18;
        uint256 interestRate = 5e16; // 5%

        uint256 price = 2000e18;
        priceFeed.setPrice(price);

        uint256 ATroveId = openTroveNoHints100pct(A, 5 ether, troveDebtRequest_A, interestRate);
        uint256 BTroveId = openTroveNoHints100pct(B, 5 ether, troveDebtRequest_B, interestRate);
        uint256 CTroveId = openTroveNoHints100pct(C, 5 ether, troveDebtRequest_C, interestRate);

        // A and B deposit to SP
        makeSPDepositAndClaim(A, troveDebtRequest_A);
        makeSPDepositAndClaim(B, troveDebtRequest_B);

        // Price drops, C becomes liquidateable
        price = 1025e18;
        priceFeed.setPrice(price);

        assertFalse(troveManager.checkBelowCriticalThreshold(price));
        assertLt(troveManager.getCurrentICR(CTroveId, price), MCR);

        // A liquidates C
        liquidate(A, CTroveId);

        // check A has an Coll gain
        assertGt(stabilityPool.getDepositorCollGain(A), 0);

        return (ATroveId, BTroveId, CTroveId);
    }

    function _setupForBatchLiquidateTrovesPureOffset(uint256 _magnitude)
        internal
        returns (uint256, uint256, uint256, uint256)
    {
        uint256 troveDebtRequest_A = 2200e18 * _magnitude;
        uint256 troveDebtRequest_B = 3200e18 * _magnitude;
        uint256 troveDebtRequest_C = 2450e18 * _magnitude;
        uint256 troveDebtRequest_D = 2450e18 * _magnitude;
        uint256 interestRate = 5e16; // 5%

        ABCDEF memory troveIDs;

        uint256 price = 2000e18;
        priceFeed.setPrice(price);

        troveIDs.A = openTroveNoHints100pct(A, 5 ether * _magnitude, troveDebtRequest_A, interestRate);
        troveIDs.B = openTroveNoHints100pct(B, 5 ether * _magnitude, troveDebtRequest_B, interestRate);
        troveIDs.C = openTroveNoHints100pct(C, 25e17 * _magnitude, troveDebtRequest_C, interestRate);
        troveIDs.D = openTroveNoHints100pct(D, 25e17 * _magnitude, troveDebtRequest_D, interestRate);

        // A and B deposit to SP
        makeSPDepositAndClaim(A, troveDebtRequest_A);
        makeSPDepositAndClaim(B, troveDebtRequest_B);

        // Price drops, C and D become liquidateable
        price = 1050e18;
        priceFeed.setPrice(price);

        assertFalse(troveManager.checkBelowCriticalThreshold(price));
        assertLt(troveManager.getCurrentICR(troveIDs.C, price), MCR);
        assertLt(troveManager.getCurrentICR(troveIDs.D, price), MCR);

        return (troveIDs.A, troveIDs.B, troveIDs.C, troveIDs.D);
    }

    function _setupForSPDepositAdjustments() internal returns (ABCDEF memory troveIDs) {
        (troveIDs.A, troveIDs.B, troveIDs.C, troveIDs.D) = _setupForBatchLiquidateTrovesPureOffset(1);

        // A liquidates C
        liquidate(A, troveIDs.C);

        // D sends BOLD to A and B so they have some to use in tests
        transferBold(D, A, boldToken.balanceOf(D) / 2);
        transferBold(D, B, boldToken.balanceOf(D));

        assertEq(uint8(troveManager.getTroveStatus(troveIDs.C)), uint8(ITroveManager.Status.closedByLiquidation));
    }

    function _setupForSPDepositAdjustmentsBigTroves() internal returns (ABCDEF memory troveIDs) {
        (troveIDs.A, troveIDs.B, troveIDs.C, troveIDs.D) = _setupForBatchLiquidateTrovesPureOffset(1e9);

        // A liquidates C
        liquidate(A, troveIDs.C);

        // D sends BOLD to A and B so they have some to use in tests
        transferBold(D, A, boldToken.balanceOf(D) / 2);
        transferBold(D, B, boldToken.balanceOf(D));

        assertEq(uint8(troveManager.getTroveStatus(troveIDs.C)), uint8(ITroveManager.Status.closedByLiquidation));
    }

    function _setupForSPDepositAdjustmentsWithoutOwedYieldRewards() internal returns (ABCDEF memory troveIDs) {
        (troveIDs.A, troveIDs.B, troveIDs.C, troveIDs.D) = _setupForBatchLiquidateTrovesPureOffset(1);

        // A claims yield rewards
        makeSPWithdrawalAndClaim(A, 0);

        // A liquidates C
        liquidate(A, troveIDs.C);

        // D sends BOLD to A and B so they have some to use in tests
        transferBold(D, A, boldToken.balanceOf(D) / 2);
        transferBold(D, B, boldToken.balanceOf(D));

        assertEq(uint8(troveManager.getTroveStatus(troveIDs.C)), uint8(ITroveManager.Status.closedByLiquidation));
    }

    function _setupForPTests() internal returns (ABCDEF memory) {
        ABCDEF memory troveIDs;
        (troveIDs.A, troveIDs.B, troveIDs.C, troveIDs.D) = _setupForBatchLiquidateTrovesPureOffset(1);
        // B leaves so only A is in the pool
        makeSPWithdrawalAndClaim(B, stabilityPool.getCompoundedBoldDeposit(B));
        return troveIDs;
    }

    function _setupForBatchLiquidateTrovesPureRedist() internal returns (uint256, uint256, uint256, uint256) {
        uint256 troveDebtRequest_A = 2200e18;
        uint256 troveDebtRequest_B = 3200e18;
        uint256 troveDebtRequest_C = 2450e18;
        uint256 troveDebtRequest_D = 2450e18;
        uint256 interestRate = 5e16; // 5%

        uint256 price = 2000e18;
        priceFeed.setPrice(price);

        uint256 ATroveId = openTroveNoHints100pct(A, 5 ether, troveDebtRequest_A, interestRate);
        uint256 BTroveId = openTroveNoHints100pct(B, 5 ether, troveDebtRequest_B, interestRate);
        uint256 CTroveId = openTroveNoHints100pct(C, 25e17, troveDebtRequest_C, interestRate);
        uint256 DTroveId = openTroveNoHints100pct(D, 25e17, troveDebtRequest_D, interestRate);

        // Price drops, C and D become liquidateable
        price = 1050e18;
        priceFeed.setPrice(price);

        assertFalse(troveManager.checkBelowCriticalThreshold(price));
        assertLt(troveManager.getCurrentICR(CTroveId, price), MCR);
        assertLt(troveManager.getCurrentICR(DTroveId, price), MCR);

        return (ATroveId, BTroveId, CTroveId, DTroveId);
    }

    function _setupForRedemption(ABCDEF memory _troveInterestRates)
        internal
        returns (uint256 coll, uint256 debtRequest, ABCDEF memory troveIDs)
    {
        return _setupForRedemption(_troveInterestRates, false);
    }

    function _setupForRedemption(ABCDEF memory _troveInterestRates, bool _batched)
        internal
        returns (uint256 coll, uint256 debtRequest, ABCDEF memory troveIDs)
    {
        priceFeed.setPrice(2000e18);

        // fast-forward to pass bootstrap phase
        vm.warp(block.timestamp + 14 days);

        coll = 20 ether;
        debtRequest = 20200e18;
        if (_batched) {
            troveIDs.A = openTroveAndJoinBatchManager(A, coll, debtRequest, A, _troveInterestRates.A);
            troveIDs.B = openTroveAndJoinBatchManager(B, coll, debtRequest, B, _troveInterestRates.B);
            troveIDs.C = openTroveAndJoinBatchManager(C, coll, debtRequest, C, _troveInterestRates.C);
            troveIDs.D = openTroveAndJoinBatchManager(D, coll, debtRequest, D, _troveInterestRates.D);
        } else {
            troveIDs.A = openTroveNoHints100pct(A, coll, debtRequest, _troveInterestRates.A);
            troveIDs.B = openTroveNoHints100pct(B, coll, debtRequest, _troveInterestRates.B);
            troveIDs.C = openTroveNoHints100pct(C, coll, debtRequest, _troveInterestRates.C);
            troveIDs.D = openTroveNoHints100pct(D, coll, debtRequest, _troveInterestRates.D);
        }

        // A, B, C, D transfer all their Bold to E
        transferBold(A, E, boldToken.balanceOf(A));
        transferBold(B, E, boldToken.balanceOf(B));
        transferBold(C, E, boldToken.balanceOf(C));
        transferBold(D, E, boldToken.balanceOf(D));
    }

    function _setupForRedemptionAscendingInterest() internal returns (uint256, uint256, ABCDEF memory) {
        ABCDEF memory troveInterestRates;
        troveInterestRates.A = 1e17; // 10%
        troveInterestRates.B = 2e17; // 20%
        troveInterestRates.C = 3e17; // 30%
        troveInterestRates.D = 4e17; // 40%

        return _setupForRedemption(troveInterestRates);
    }

    function _setupForRedemptionAscendingInterestInBatch() internal returns (uint256, uint256, ABCDEF memory) {
        ABCDEF memory troveInterestRates;
        troveInterestRates.A = 1e17; // 10%
        troveInterestRates.B = 2e17; // 20%
        troveInterestRates.C = 3e17; // 30%
        troveInterestRates.D = 4e17; // 40%

        return _setupForRedemption(troveInterestRates, true);
    }

    function _redeemAndCreateZombieTrovesAAndB(ABCDEF memory _troveIDs) internal {
        // Wait some time to make sure redemption rate low
        vm.warp(block.timestamp + 30 days);

        // Redeem enough to leave A with 0 debt and B with debt < MIN_DEBT
        uint256 redeemFromA = troveManager.getTroveEntireDebt(_troveIDs.A);
        uint256 redeemFromB = troveManager.getTroveEntireDebt(_troveIDs.B) - MIN_DEBT / 2;
        uint256 redeemAmount = redeemFromA + redeemFromB;

        // Fully redeem A and leave B with debt < MIN_NET_DEBT
        redeem(E, redeemAmount);

        // Check A has debt == 0, and B has debt < min_debt
        assertEq(troveManager.getTroveEntireDebt(_troveIDs.A), 0);
        assertLt(troveManager.getTroveEntireDebt(_troveIDs.B), MIN_DEBT);

        // Check A and B tagged as Zombie troves
        assertEq(uint8(troveManager.getTroveStatus(_troveIDs.A)), uint8(ITroveManager.Status.zombie));
        assertEq(uint8(troveManager.getTroveStatus(_troveIDs.A)), uint8(ITroveManager.Status.zombie));
    }

    function _redeemAndCreateEmptyZombieTrovesAAndB(ABCDEF memory _troveIDs) internal {
        // Redeem enough to leave A with 0 debt and B with debt < MIN_DEBT
        uint256 redeemFromA = troveManager.getTroveEntireDebt(_troveIDs.A);
        uint256 redeemFromB = troveManager.getTroveEntireDebt(_troveIDs.B);
        uint256 redeemAmount = redeemFromA + redeemFromB;

        // Fully redeem A and B
        redeem(E, redeemAmount);

        // Check A, B has debt == 0
        assertEq(troveManager.getTroveEntireDebt(_troveIDs.A), 0);
        assertEq(troveManager.getTroveEntireDebt(_troveIDs.B), 0);

        // Check A and B tagged as Zombie troves
        assertEq(uint8(troveManager.getTroveStatus(_troveIDs.A)), uint8(ITroveManager.Status.zombie));
        assertEq(uint8(troveManager.getTroveStatus(_troveIDs.A)), uint8(ITroveManager.Status.zombie));
    }

    function _redeemAndCreateZombieTroveAAndHitB(ABCDEF memory _troveIDs) internal {
        // Redeem enough to leave A with 0 debt but B with debt > MIN_NET_DEBT
        uint256 redeemFromA = troveManager.getTroveEntireDebt(_troveIDs.A);
        uint256 redeemFromB = troveManager.getTroveEntireDebt(_troveIDs.B) - MIN_DEBT * 2;
        uint256 redeemAmount = redeemFromA + redeemFromB;

        // Fully redeem A and leave B with debt > MIN_NET_DEBT
        redeem(E, redeemAmount);

        // Check A has debt == 0, and B has debt > min_debt;
        assertEq(troveManager.getTroveEntireDebt(_troveIDs.A), 0);
        assertGt(troveManager.getTroveEntireDebt(_troveIDs.B), MIN_DEBT);

        // // Check A is zombie Trove but B is not
        assertEq(uint8(troveManager.getTroveStatus(_troveIDs.A)), uint8(ITroveManager.Status.zombie));
        assertEq(uint8(troveManager.getTroveStatus(_troveIDs.B)), uint8(ITroveManager.Status.active));
    }

    function _getSPYield(uint256 _aggInterest) internal view returns (uint256) {
        uint256 spYield = SP_YIELD_SPLIT * _aggInterest / 1e18;
        assertGt(spYield, 0);
        assertLe(spYield, _aggInterest);
        return spYield;
    }
}
