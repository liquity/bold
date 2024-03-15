
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.18;

import "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

import "./Interfaces/IPriceFeedTestnet.sol";

import "../../ActivePool.sol";
import "../../BoldToken.sol";
import "../../BorrowerOperations.sol";
import "../../CollSurplusPool.sol";
import "../../DefaultPool.sol";
import "../../GasPool.sol";
import "../../HintHelpers.sol";
import "../../MultiTroveGetter.sol";
import "../../SortedTroves.sol";
import "../../StabilityPool.sol";
import "../../TroveManager.sol";
import "../../MockInterestRouter.sol";

import "./BaseTest.sol";

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

        (A, B, C, D, E, F, G) =
            (accountsList[0], accountsList[1], accountsList[2], accountsList[3], accountsList[4], accountsList[5], accountsList[6]);

        WETH = new ERC20("Wrapped ETH", "WETH");

        // TODO: optimize deployment order & constructor args & connector functions

        // Deploy all contracts
        activePool = new ActivePool(address(WETH));
        borrowerOperations = new BorrowerOperations(address(WETH));
        collSurplusPool = new CollSurplusPool(address(WETH));
        defaultPool = new DefaultPool(address(WETH));
        gasPool = new GasPool();
        priceFeed = new PriceFeedTestnet();
        sortedTroves = new SortedTroves();
        stabilityPool = new StabilityPool(address(WETH));
        troveManager = new TroveManager();
        boldToken = new BoldToken(address(troveManager), address(stabilityPool), address(borrowerOperations), address(activePool));
        mockInterestRouter = new MockInterestRouter();

        // Connect contracts
        sortedTroves.setParams(
            MAX_UINT256,
            address(troveManager),
            address(borrowerOperations)
        );

        // set contracts in the Trove Manager
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

        // set contracts in BorrowerOperations
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

        // set contracts in the Pools
        stabilityPool.setAddresses(
            address(borrowerOperations),
            address(troveManager),
            address(activePool),
            address(boldToken),
            address(sortedTroves),
            address(priceFeed)
        );

        activePool.setAddresses(
            address(borrowerOperations),
            address(troveManager),
            address(stabilityPool),
            address(defaultPool),
            address(boldToken),
            address(mockInterestRouter)
        );

        defaultPool.setAddresses(
            address(troveManager),
            address(activePool)
        );

        collSurplusPool.setAddresses(
            address(borrowerOperations),
            address(troveManager),
            address(activePool)
        );

        // Give some ETH to test accounts, and approve it to BorrowerOperations
        uint256 initialETHAmount = 10_000e18;
        for(uint256 i = 0; i < 6; i++) { // A to F
            giveAndApproveETH(accountsList[i], initialETHAmount);
        }
    }

    function _setupForWithdrawETHGainToTrove() internal {
        uint256 troveDebtRequest_A = 2000e18;
        uint256 troveDebtRequest_B = 3000e18;
        uint256 troveDebtRequest_C = 4500e18;
        uint256 interestRate = 5e16; // 5%

        uint256 price = 2000e18;
        priceFeed.setPrice(price);

        openTroveNoHints100pctMaxFee(A,  5 ether, troveDebtRequest_A, interestRate);
        openTroveNoHints100pctMaxFee(B,  5 ether, troveDebtRequest_B, interestRate);
        openTroveNoHints100pctMaxFee(C,  5 ether, troveDebtRequest_C, interestRate);

        console.log(troveManager.getTCR(price), "TCR");
        console.log(troveManager.getCurrentICR(C, price), "C CR");

        // A and B deposit to SP
        makeSPDeposit(A, troveDebtRequest_A);
        makeSPDeposit(B, troveDebtRequest_B);

        // Price drops, C becomes liquidateable
        price = 1025e18;
        priceFeed.setPrice(price);

        console.log(troveManager.getTCR(price), "TCR before liq");
        console.log(troveManager.getCurrentICR(C, price), "C CR before liq");

        assertFalse(troveManager.checkRecoveryMode(price));
        assertLt(troveManager.getCurrentICR(C, price), troveManager.MCR());

        // A liquidates C
        liquidate(A, C);

        // check A has an ETH gain
        assertGt(stabilityPool.getDepositorETHGain(A), 0);
    }

    function _setupForBatchLiquidateTrovesPureOffset() internal {
        uint256 troveDebtRequest_A = 2000e18;
        uint256 troveDebtRequest_B = 3000e18;
        uint256 troveDebtRequest_C = 2250e18;
        uint256 troveDebtRequest_D = 2250e18;
        uint256 interestRate = 5e16; // 5%

        uint256 price = 2000e18;
        priceFeed.setPrice(price);

        openTroveNoHints100pctMaxFee(A,  5 ether, troveDebtRequest_A, interestRate);
        openTroveNoHints100pctMaxFee(B,  5 ether, troveDebtRequest_B, interestRate);
        openTroveNoHints100pctMaxFee(C,  25e17, troveDebtRequest_C, interestRate);
        openTroveNoHints100pctMaxFee(D,  25e17, troveDebtRequest_D, interestRate);

        // console.log(troveManager.getTCR(price), "TCR");
        // console.log(troveManager.getCurrentICR(C, price), "C CR");

        // A and B deposit to SP
        makeSPDeposit(A, troveDebtRequest_A);
        makeSPDeposit(B, troveDebtRequest_B);

        // Price drops, C and D become liquidateable
        price = 1050e18;
        priceFeed.setPrice(price);

        assertFalse(troveManager.checkRecoveryMode(price));
        assertLt(troveManager.getCurrentICR(C, price), troveManager.MCR());
        assertLt(troveManager.getCurrentICR(D, price), troveManager.MCR());
    }

        function _setupForBatchLiquidateTrovesPureRedist() internal {
        uint256 troveDebtRequest_A = 2000e18;
        uint256 troveDebtRequest_B = 3000e18;
        uint256 troveDebtRequest_C = 2250e18;
        uint256 troveDebtRequest_D = 2250e18;
        uint256 interestRate = 5e16; // 5%

        uint256 price = 2000e18;
        priceFeed.setPrice(price);

        openTroveNoHints100pctMaxFee(A,  5 ether, troveDebtRequest_A, interestRate); 
        openTroveNoHints100pctMaxFee(B,  5 ether, troveDebtRequest_B, interestRate); 
        openTroveNoHints100pctMaxFee(C,  25e17, troveDebtRequest_C, interestRate);
        openTroveNoHints100pctMaxFee(D,  25e17, troveDebtRequest_D, interestRate); 

        // Price drops, C and D become liquidateable 
        price = 1050e18;
        priceFeed.setPrice(price);

        assertFalse(troveManager.checkRecoveryMode(price));
        assertLt(troveManager.getCurrentICR(C, price), troveManager.MCR());
        assertLt(troveManager.getCurrentICR(D, price), troveManager.MCR());
    }
}
