// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.18;

import "./BaseTest.sol";
import "../../deployment.sol";

contract DevTestSetup is BaseTest {
    IERC20 WETH;

    uint256 BOLD_GAS_COMP;
    uint256 MIN_NET_DEBT;
    uint256 MIN_DEBT;
    uint256 UPFRONT_INTEREST_PERIOD;

    function calcInterest(uint256 debt, uint256 interestRate, uint256 period) internal pure returns (uint256) {
        return debt * interestRate * period / 365 days / 1e18;
    }

    function calcUpfrontInterest(uint256 debt, uint256 interestRate) internal view returns (uint256) {
        return calcInterest(debt, interestRate, UPFRONT_INTEREST_PERIOD);
    }

    function giveAndApproveETH(address _account, uint256 _amount) public {
        return giveAndApproveCollateral(WETH, _account, _amount, address(borrowerOperations));
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

        // Approve ETH to BorrowerOperations
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

        LiquityContracts memory contracts;
        (contracts, collateralRegistry, boldToken) = _deployAndConnectContracts();
        WETH = contracts.WETH;
        activePool = contracts.activePool;
        borrowerOperations = contracts.borrowerOperations;
        collSurplusPool = contracts.collSurplusPool;
        defaultPool = contracts.defaultPool;
        gasPool = contracts.gasPool;
        priceFeed = contracts.priceFeed;
        sortedTroves = contracts.sortedTroves;
        stabilityPool = contracts.stabilityPool;
        troveManager = contracts.troveManager;
        mockInterestRouter = contracts.interestRouter;

        MCR = troveManager.MCR();

        // Give some ETH to test accounts, and approve it to BorrowerOperations
        uint256 initialETHAmount = 1000_000e18;
        for (uint256 i = 0; i < 6; i++) {
            // A to F
            giveAndApproveETH(accountsList[i], initialETHAmount);
        }

        BOLD_GAS_COMP = troveManager.BOLD_GAS_COMPENSATION();
        MIN_NET_DEBT = troveManager.MIN_NET_DEBT();
        MIN_DEBT = troveManager.MIN_DEBT();
        UPFRONT_INTEREST_PERIOD = troveManager.UPFRONT_INTEREST_PERIOD();
    }

    function _setupForWithdrawETHGainToTrove() internal returns (uint256, uint256, uint256) {
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
        assertLt(troveManager.getCurrentICR(CTroveId, price), troveManager.MCR());

        // A liquidates C
        liquidate(A, CTroveId);

        // check A has an ETH gain
        assertGt(stabilityPool.getDepositorETHGain(A), 0);

        return (ATroveId, BTroveId, CTroveId);
    }

    function _setupForBatchLiquidateTrovesPureOffset() internal returns (uint256, uint256, uint256, uint256) {
        uint256 troveDebtRequest_A = 2000e18;
        uint256 troveDebtRequest_B = 3000e18;
        uint256 troveDebtRequest_C = 2250e18;
        uint256 troveDebtRequest_D = 2250e18;
        uint256 interestRate = 5e16; // 5%

        ABCDEF memory troveIDs;

        uint256 price = 2000e18;
        priceFeed.setPrice(price);

        troveIDs.A = openTroveNoHints100pct(A, 5 ether, troveDebtRequest_A, interestRate);
        troveIDs.B = openTroveNoHints100pct(B, 5 ether, troveDebtRequest_B, interestRate);
        troveIDs.C = openTroveNoHints100pct(C, 25e17, troveDebtRequest_C, interestRate);
        troveIDs.D = openTroveNoHints100pct(D, 25e17, troveDebtRequest_D, interestRate);

        // A and B deposit to SP
        makeSPDepositAndClaim(A, troveDebtRequest_A);
        makeSPDepositAndClaim(B, troveDebtRequest_B);

        // Price drops, C and D become liquidateable
        price = 1050e18;
        priceFeed.setPrice(price);

        assertFalse(troveManager.checkBelowCriticalThreshold(price));
        assertLt(troveManager.getCurrentICR(troveIDs.C, price), troveManager.MCR());
        assertLt(troveManager.getCurrentICR(troveIDs.D, price), troveManager.MCR());

        return (troveIDs.A, troveIDs.B, troveIDs.C, troveIDs.D);
    }

    function _setupForSPDepositAdjustments() internal returns (ABCDEF memory troveIDs) {
        (troveIDs.A, troveIDs.B, troveIDs.C, troveIDs.D) = _setupForBatchLiquidateTrovesPureOffset();

        // A liquidates C
        liquidate(A, troveIDs.C);

        // D sends BOLD to A and B so they have some to use in tests
        transferBold(D, A, boldToken.balanceOf(D) / 2);
        transferBold(D, B, boldToken.balanceOf(D));

        assertEq(troveManager.getTroveStatus(troveIDs.C), 3); // Status 3 - closed by liquidation
    }

    function _setupForBatchLiquidateTrovesPureRedist() internal returns (uint256, uint256, uint256, uint256) {
        uint256 troveDebtRequest_A = 2000e18;
        uint256 troveDebtRequest_B = 3000e18;
        uint256 troveDebtRequest_C = 2250e18;
        uint256 troveDebtRequest_D = 2250e18;
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
        assertLt(troveManager.getCurrentICR(CTroveId, price), troveManager.MCR());
        assertLt(troveManager.getCurrentICR(DTroveId, price), troveManager.MCR());

        return (ATroveId, BTroveId, CTroveId, DTroveId);
    }

    function _setupForRedemption(ABCDEF memory _troveInterestRates)
        internal
        returns (uint256 coll, uint256 debtRequest, ABCDEF memory troveIDs)
    {
        priceFeed.setPrice(2000e18);

        // fast-forward to pass bootstrap phase
        vm.warp(block.timestamp + 14 days);

        coll = 20 ether;
        debtRequest = 20000e18;
        troveIDs.A = openTroveNoHints100pct(A, coll, debtRequest, _troveInterestRates.A);
        troveIDs.B = openTroveNoHints100pct(B, coll, debtRequest, _troveInterestRates.B);
        troveIDs.C = openTroveNoHints100pct(C, coll, debtRequest, _troveInterestRates.C);
        troveIDs.D = openTroveNoHints100pct(D, coll, debtRequest, _troveInterestRates.D);

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

    function _redeemAndCreateZombieTrovesAAndB(ABCDEF memory _troveIDs) internal {
        // Redeem enough to leave A with 0 net debt and B with net debt < MIN_NET_DEBT
        uint256 redeemFromA = troveManager.getRedeemableDebt(_troveIDs.A);
        uint256 redeemFromB = troveManager.getRedeemableDebt(_troveIDs.B) - MIN_NET_DEBT / 2;
        uint256 redeemAmount = redeemFromA + redeemFromB;

        // Maximally redeem A and leave B with net debt < MIN_NET_DEBT
        redeem(E, redeemAmount);

        // Check A has net_debt == 0, and B has net_debt < min_net_debt
        assertEq(troveManager.getTroveDebt(_troveIDs.A) - BOLD_GAS_COMP, 0);
        assertLt(troveManager.getTroveDebt(_troveIDs.B) - BOLD_GAS_COMP, MIN_NET_DEBT);

        // Check A and B tagged as Zombie troves
        assertEq(troveManager.getTroveStatus(_troveIDs.A), 5); // status 'unredeemable'
        assertEq(troveManager.getTroveStatus(_troveIDs.A), 5); // status 'unredeemable'
    }

    function _redeemAndCreateZombieTroveAAndHitB(ABCDEF memory _troveIDs) internal {
        // Redeem enough to leave A with 0 debt but B with net debt > MIN_NET_DEBT
        uint256 redeemFromA = troveManager.getRedeemableDebt(_troveIDs.A);
        uint256 redeemFromB = troveManager.getRedeemableDebt(_troveIDs.B) - MIN_NET_DEBT * 2;
        uint256 redeemAmount = redeemFromA + redeemFromB;

        // Maximally redeem A and leave B with net debt > MIN_NET_DEBT
        redeem(E, redeemAmount);

        // Check A has net_debt == gas_comp, and B has net_debt > min_net_debt;
        assertEq(troveManager.getTroveDebt(_troveIDs.A) - BOLD_GAS_COMP, 0);
        assertGt(troveManager.getTroveDebt(_troveIDs.B) - BOLD_GAS_COMP, MIN_NET_DEBT);

        // // Check A is zombie Trove but B is not
        assertEq(troveManager.getTroveStatus(_troveIDs.A), 5); // status 'unredeemable'
        assertEq(troveManager.getTroveStatus(_troveIDs.B), 1); // status 'active'
    }
}
