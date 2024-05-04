// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.18;

import "./BaseTest.sol";
import "../../deployment.sol";

contract DevTestSetup is BaseTest {
    IERC20 WETH;

    uint256 BOLD_GAS_COMP;
    uint256 MIN_NET_DEBT;

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

        // Give some ETH to test accounts, and approve it to BorrowerOperations
        uint256 initialETHAmount = 1000_000e18;
        for (uint256 i = 0; i < 6; i++) {
            // A to F
            giveAndApproveETH(accountsList[i], initialETHAmount);
        }

        BOLD_GAS_COMP = troveManager.BOLD_GAS_COMPENSATION();
        MIN_NET_DEBT = troveManager.MIN_NET_DEBT();
    }

    function _setupForWithdrawETHGainToTrove() internal returns (uint256, uint256, uint256) {
        uint256 troveDebtRequest_A = 2000e18;
        uint256 troveDebtRequest_B = 3000e18;
        uint256 troveDebtRequest_C = 4500e18;
        uint256 interestRate = 5e16; // 5%

        uint256 price = 2000e18;
        priceFeed.setPrice(price);

        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 5 ether, troveDebtRequest_A, interestRate);
        uint256 BTroveId = openTroveNoHints100pctMaxFee(B, 5 ether, troveDebtRequest_B, interestRate);
        uint256 CTroveId = openTroveNoHints100pctMaxFee(C, 5 ether, troveDebtRequest_C, interestRate);

        // A and B deposit to SP
        makeSPDepositAndClaim(A, troveDebtRequest_A);
        makeSPDepositAndClaim(B, troveDebtRequest_B);

        // Price drops, C becomes liquidateable
        price = 1025e18;
        priceFeed.setPrice(price);

        assertFalse(troveManager.checkRecoveryMode(price));
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

        TroveIDs memory troveIDs;

        uint256 price = 2000e18;
        priceFeed.setPrice(price);

        troveIDs.A = openTroveNoHints100pctMaxFee(A, 5 ether, troveDebtRequest_A, interestRate);
        troveIDs.B = openTroveNoHints100pctMaxFee(B, 5 ether, troveDebtRequest_B, interestRate);
        troveIDs.C = openTroveNoHints100pctMaxFee(C, 25e17, troveDebtRequest_C, interestRate);
        troveIDs.D = openTroveNoHints100pctMaxFee(D, 25e17, troveDebtRequest_D, interestRate);

        // A and B deposit to SP
        makeSPDepositAndClaim(A, troveDebtRequest_A);
        makeSPDepositAndClaim(B, troveDebtRequest_B);

        // Price drops, C and D become liquidateable
        price = 1050e18;
        priceFeed.setPrice(price);

        assertFalse(troveManager.checkRecoveryMode(price));
        assertLt(troveManager.getCurrentICR(troveIDs.C, price), troveManager.MCR());
        assertLt(troveManager.getCurrentICR(troveIDs.D, price), troveManager.MCR());

        return (troveIDs.A, troveIDs.B, troveIDs.C, troveIDs.D);
    }

    function _setupForSPDepositAdjustments() internal returns (TroveIDs memory) {
        TroveIDs memory troveIDs;
        (troveIDs.A, troveIDs.B, troveIDs.C, troveIDs.D) =  _setupForBatchLiquidateTrovesPureOffset();

        // A liquidates C
        liquidate(A, troveIDs.C);

        // D sends BOLD to A and B so they have some to use in tests
        transferBold(D, A, boldToken.balanceOf(D) / 2);
        transferBold(D, B, boldToken.balanceOf(D));

        assertEq(troveManager.getTroveStatus(troveIDs.C), 3); // Status 3 - closed by liquidation
        return troveIDs;
    }

    function _setupForBatchLiquidateTrovesPureRedist() internal returns (uint256, uint256, uint256, uint256) {
        uint256 troveDebtRequest_A = 2000e18;
        uint256 troveDebtRequest_B = 3000e18;
        uint256 troveDebtRequest_C = 2250e18;
        uint256 troveDebtRequest_D = 2250e18;
        uint256 interestRate = 5e16; // 5%

        uint256 price = 2000e18;
        priceFeed.setPrice(price);

        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 5 ether, troveDebtRequest_A, interestRate);
        uint256 BTroveId = openTroveNoHints100pctMaxFee(B, 5 ether, troveDebtRequest_B, interestRate);
        uint256 CTroveId = openTroveNoHints100pctMaxFee(C, 25e17, troveDebtRequest_C, interestRate);
        uint256 DTroveId = openTroveNoHints100pctMaxFee(D, 25e17, troveDebtRequest_D, interestRate);

        // Price drops, C and D become liquidateable
        price = 1050e18;
        priceFeed.setPrice(price);

        assertFalse(troveManager.checkRecoveryMode(price));
        assertLt(troveManager.getCurrentICR(CTroveId, price), troveManager.MCR());
        assertLt(troveManager.getCurrentICR(DTroveId, price), troveManager.MCR());

        return (ATroveId, BTroveId, CTroveId, DTroveId);
    }

    function _setupForRedemption(TroveInterestRates memory _troveInterestRates) internal returns (uint256, uint256, TroveIDs memory) {
        TroveIDs memory troveIDs;

        priceFeed.setPrice(2000e18);

        // fast-forward to pass bootstrap phase
        vm.warp(block.timestamp + 14 days);

        uint256 coll = 20 ether;
        uint256 debtRequest = 20000e18;
        troveIDs.A = openTroveNoHints100pctMaxFee(A, coll, debtRequest, _troveInterestRates.A);
        troveIDs.B = openTroveNoHints100pctMaxFee(B, coll, debtRequest, _troveInterestRates.B);
        troveIDs.C = openTroveNoHints100pctMaxFee(C, coll, debtRequest, _troveInterestRates.C);
        troveIDs.D = openTroveNoHints100pctMaxFee(D, coll, debtRequest, _troveInterestRates.D);

        // A, B, C, D transfer all their Bold to E
        transferBold(A, E, boldToken.balanceOf(A));
        transferBold(B, E, boldToken.balanceOf(B));
        transferBold(C, E, boldToken.balanceOf(C));
        transferBold(D, E, boldToken.balanceOf(D));

        return (coll, debtRequest, troveIDs);
    }

    function _setupForRedemptionAscendingInterest() internal returns (uint256, uint256, TroveIDs memory) {
        TroveInterestRates memory troveInterestRates;
        troveInterestRates.A = 1e17; // 10%
        troveInterestRates.B = 2e17; // 20%
        troveInterestRates.C = 3e17; // 30%
        troveInterestRates.D = 4e17; // 40%

        return _setupForRedemption(troveInterestRates);
    }


    function _redeemAndCreateZombieTrovesAAndB(TroveIDs memory _troveIDs) internal returns (uint256, uint256, TroveIDs memory) {
        // Redeem enough to leave to leave A with 0 debt and B with debt < MIN_NET_DEBT
        uint256 redeemFromA = troveManager.getTroveEntireDebt(_troveIDs.A) - troveManager.BOLD_GAS_COMPENSATION();
        uint256 redeemFromB  = troveManager.getTroveEntireDebt(_troveIDs.B) - troveManager.BOLD_GAS_COMPENSATION() - troveManager.MIN_NET_DEBT() / 2;
        uint256 redeemAmount = redeemFromA + redeemFromB;

        // Fully redeem A and leave B with debt < MIN_NET_DEBT
        redeem(E, redeemAmount);

        // Check A has net_debt == 0, and B has net_debt < min_net_debt
        assertEq(troveManager.getTroveEntireDebt(_troveIDs.A), BOLD_GAS_COMP);
        assertLt(troveManager.getTroveEntireDebt(_troveIDs.B) - BOLD_GAS_COMP, troveManager.MIN_NET_DEBT());

       // Check A and B tagged as Zombie troves
        assertEq(troveManager.getTroveStatus(_troveIDs.A), 5); // status 'unredeemable'
        assertEq(troveManager.getTroveStatus(_troveIDs.A), 5); // status 'unredeemable'
    }

    function _redeemAndCreateZombieTroveAAndHitB(TroveIDs memory _troveIDs) internal returns (uint256, uint256, TroveIDs memory) {
        // Redeem enough to leave to leave A with 0 debt and B with debt < MIN_NET_DEBT
        uint256 redeemFromA = troveManager.getTroveEntireDebt(_troveIDs.A) - troveManager.BOLD_GAS_COMPENSATION();
        // Leave B with net_debt > min_net_debt
        uint256 redeemFromB = troveManager.getTroveEntireDebt(_troveIDs.B) - troveManager.BOLD_GAS_COMPENSATION() - troveManager.MIN_NET_DEBT() - 37;
      
        uint256 redeemAmount = redeemFromA + redeemFromB;

        // Fully redeem A and leave B with debt > MIN_NET_DEBT
        redeem(E, redeemAmount);

        // Check A has net_debt == gas_comp, and B has net_debt > min_net_debt;
        assertEq(troveManager.getTroveEntireDebt(_troveIDs.A), BOLD_GAS_COMP);
        assertGt(troveManager.getTroveEntireDebt(_troveIDs.B), BOLD_GAS_COMP);

        // // Check A is zombie Trove but B is not
        assertEq(troveManager.getTroveStatus(_troveIDs.A), 5); // status 'unredeemable'
        assertEq(troveManager.getTroveStatus(_troveIDs.B), 1); // status 'active'
    }
}
