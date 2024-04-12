// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.18;

import "./BaseTest.sol";
import "../../deployment.sol";

contract DevTestSetup is BaseTest {
    IERC20 WETH;

    function giveAndApproveETH(address _account, uint256 _amount) public {
        // Give some ETH to test accounts
        deal(address(WETH), _account, _amount);

        // Check accounts are funded
        assertEq(WETH.balanceOf(_account), _amount);

        // Approve ETH to BorrowerOperations
        vm.startPrank(_account);
        WETH.approve(address(borrowerOperations), _amount);
        vm.stopPrank();

        // Check approvals
        assertEq(WETH.allowance(_account, address(borrowerOperations)), _amount);
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

        LiquityContracts memory contracts = _deployAndConnectContracts();
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
        boldToken = contracts.boldToken;
        mockInterestRouter = contracts.interestRouter;

        // Give some ETH to test accounts, and approve it to BorrowerOperations
        uint256 initialETHAmount = 10_000e18;
        for (uint256 i = 0; i < 6; i++) {
            // A to F
            giveAndApproveETH(accountsList[i], initialETHAmount);
        }
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

        console.log(troveManager.getTCR(price), "TCR");
        console.log(troveManager.getCurrentICR(CTroveId, price), "C CR");

        // A and B deposit to SP
        makeSPDeposit(A, troveDebtRequest_A);
        makeSPDeposit(B, troveDebtRequest_B);

        // Price drops, C becomes liquidateable
        price = 1025e18;
        priceFeed.setPrice(price);

        console.log(troveManager.getTCR(price), "TCR before liq");
        console.log(troveManager.getCurrentICR(CTroveId, price), "C CR before liq");

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

        uint256 price = 2000e18;
        priceFeed.setPrice(price);

        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 5 ether, troveDebtRequest_A, interestRate);
        uint256 BTroveId = openTroveNoHints100pctMaxFee(B, 5 ether, troveDebtRequest_B, interestRate);
        uint256 CTroveId = openTroveNoHints100pctMaxFee(C, 25e17, troveDebtRequest_C, interestRate);
        uint256 DTroveId = openTroveNoHints100pctMaxFee(D, 25e17, troveDebtRequest_D, interestRate);

        // console.log(troveManager.getTCR(price), "TCR");
        // console.log(troveManager.getCurrentICR(CTroveId, price), "C CR");

        // A and B deposit to SP
        makeSPDeposit(A, troveDebtRequest_A);
        makeSPDeposit(B, troveDebtRequest_B);

        // Price drops, C and D become liquidateable
        price = 1050e18;
        priceFeed.setPrice(price);

        assertFalse(troveManager.checkRecoveryMode(price));
        assertLt(troveManager.getCurrentICR(CTroveId, price), troveManager.MCR());
        assertLt(troveManager.getCurrentICR(DTroveId, price), troveManager.MCR());

        return (ATroveId, BTroveId, CTroveId, DTroveId);
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

    function _setupForRedemption() public returns (uint256, uint256, TroveIDs memory) {
        TroveIDs memory troveIDs;

        priceFeed.setPrice(2000e18);

        uint256 interestRate_A = 10e16;
        uint256 interestRate_B = 20e16;
        uint256 interestRate_C = 30e16;
        uint256 interestRate_D = 40e16;
        uint256 coll = 20 ether;
        uint256 debtRequest = 20000e18;
        // Open in increasing order of interst rate
        troveIDs.A = openTroveNoHints100pctMaxFee(A, coll, debtRequest, interestRate_A);
        troveIDs.B = openTroveNoHints100pctMaxFee(B, coll, debtRequest, interestRate_B);
        troveIDs.C = openTroveNoHints100pctMaxFee(C, coll, debtRequest, interestRate_C);
        troveIDs.D = openTroveNoHints100pctMaxFee(D, coll, debtRequest, interestRate_D);

        // fast-forward to pass bootstrap phase
        vm.warp(block.timestamp + 14 days);

        // A, B, C, D transfer all their Bold to E
        transferBold(A, E, boldToken.balanceOf(A));
        transferBold(B, E, boldToken.balanceOf(B));
        transferBold(C, E, boldToken.balanceOf(C));
        transferBold(D, E, boldToken.balanceOf(D));

        return (coll, debtRequest, troveIDs);
    }
}
