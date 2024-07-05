// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {IBorrowerOperations} from "../../Interfaces/IBorrowerOperations.sol";
import {IBoldToken} from "../../Interfaces/IBoldToken.sol";
import {IStabilityPool} from "../../Interfaces/IStabilityPool.sol";
import {ITroveManager} from "../../Interfaces/ITroveManager.sol";
import {ICollSurplusPool} from "../../Interfaces/ICollSurplusPool.sol";
import {IPriceFeedTestnet} from "./Interfaces/IPriceFeedTestnet.sol";
import {mulDivCeil} from "../Utils/Math.sol";
import {StringFormatting} from "../Utils/StringFormatting.sol";
import {BaseHandler} from "./BaseHandler.sol";

import {
    DECIMAL_PRECISION,
    _1pct,
    _100pct,
    CCR,
    ETH_GAS_COMPENSATION,
    COLL_GAS_COMPENSATION_DIVISOR
} from "../../Dependencies/Constants.sol";

using {mulDivCeil} for uint256;

// Test parameters
uint256 constant OPEN_TROVE_BORROWED_MIN = 2_000 ether;
uint256 constant OPEN_TROVE_BORROWED_MAX = 100_000 ether;
uint256 constant OPEN_TROVE_ICR = CCR;
uint256 constant LIQUIDATION_ICR = MCR - _1pct;

// Universal constants
uint256 constant MCR = 1.1 ether;

contract SPInvariantsTestHandler is BaseHandler {
    using StringFormatting for uint256;

    struct Contracts {
        IBoldToken boldToken;
        IBorrowerOperations borrowerOperations;
        IERC20 collateralToken;
        IPriceFeedTestnet priceFeed;
        IStabilityPool stabilityPool;
        ITroveManager troveManager;
        ICollSurplusPool collSurplusPool;
    }

    IBoldToken immutable boldToken;
    IBorrowerOperations immutable borrowerOperations;
    IERC20 collateralToken;
    IPriceFeedTestnet immutable priceFeed;
    IStabilityPool immutable stabilityPool;
    ITroveManager immutable troveManager;
    ICollSurplusPool immutable collSurplusPool;

    uint256 immutable initialPrice;

    // Ghost variables
    uint256 myBold = 0;
    uint256 spBold = 0;
    uint256 spColl = 0;

    // Fixtures
    uint256[] fixtureDeposited;

    constructor(string memory handlerName, Contracts memory contracts) BaseHandler(handlerName) {
        boldToken = contracts.boldToken;
        borrowerOperations = contracts.borrowerOperations;
        collateralToken = contracts.collateralToken;
        priceFeed = contracts.priceFeed;
        stabilityPool = contracts.stabilityPool;
        troveManager = contracts.troveManager;
        collSurplusPool = contracts.collSurplusPool;

        initialPrice = priceFeed.getPrice();
    }

    function _getTroveId(address owner, uint256 i) internal pure returns (uint256) {
        return uint256(keccak256(abi.encode(owner, i)));
    }

    function openTrove(uint256 borrowed) external returns (uint256 debt) {
        uint256 i = troveManager.balanceOf(msg.sender);
        vm.assume(troveManager.getTroveStatus(_getTroveId(msg.sender, i)) != ITroveManager.Status.active);

        borrowed = _bound(borrowed, OPEN_TROVE_BORROWED_MIN, OPEN_TROVE_BORROWED_MAX);
        uint256 price = priceFeed.getPrice();
        debt = borrowed;
        uint256 coll = debt.mulDivCeil(OPEN_TROVE_ICR, price);
        assertEqDecimal(coll * price / debt, OPEN_TROVE_ICR, 18, "Wrong ICR");

        info("coll = ", coll.decimal(), ", debt = ", debt.decimal());
        logCall("openTrove", borrowed.decimal());

        deal(address(collateralToken), msg.sender, coll + ETH_GAS_COMPENSATION);
        vm.prank(msg.sender);
        collateralToken.approve(address(borrowerOperations), coll + ETH_GAS_COMPENSATION);
        vm.prank(msg.sender);
        uint256 troveId = borrowerOperations.openTrove(msg.sender, i + 1, coll, borrowed, 0, 0, 0, type(uint256).max);
        (uint256 actualDebt,,,,) = troveManager.getEntireDebtAndColl(troveId);
        assertEqDecimal(debt, actualDebt, 18, "Wrong debt");

        // Sweep funds
        vm.prank(msg.sender);
        boldToken.transfer(address(this), borrowed);
        assertEqDecimal(boldToken.balanceOf(msg.sender), 0, 18, "Incomplete BOLD sweep");
        myBold += borrowed;

        // Use these interesting values as SP deposit amounts later
        fixtureDeposited.push(debt);
        fixtureDeposited.push(debt + debt / DECIMAL_PRECISION + 1); // See https://github.com/liquity/dev/security/advisories/GHSA-m9f3-hrx8-x2g3
    }

    function provideToSp(uint256 deposited, bool useFixture) external {
        vm.assume(myBold > 0);

        uint256 collBefore = collateralToken.balanceOf(msg.sender);
        uint256 collGain = stabilityPool.getDepositorCollGain(msg.sender);

        // Poor man's fixturing, because Foundry's fixtures don't seem to work under invariant testing
        if (useFixture && fixtureDeposited.length > 0) {
            info("pulling `deposited` from fixture");
            deposited = fixtureDeposited[_bound(deposited, 0, fixtureDeposited.length - 1)];
        }

        deposited = _bound(deposited, 1, myBold);

        logCall("provideToSp", deposited.decimal(), "false");

        boldToken.transfer(msg.sender, deposited);
        vm.prank(msg.sender);
        // Provide to SP and claim Coll and BOLD gains
        stabilityPool.provideToSP(deposited, true);

        info("totalBoldDeposits = ", stabilityPool.getTotalBoldDeposits().decimal());
        _log();

        uint256 collAfter = collateralToken.balanceOf(msg.sender);
        assertEqDecimal(collAfter, collBefore + collGain, 18, "Wrong Coll gain");

        myBold -= deposited;
        spBold += deposited;
        spColl -= collGain;

        assertEqDecimal(spBold, stabilityPool.getTotalBoldDeposits(), 18, "Wrong SP BOLD balance");
        assertEqDecimal(spColl, stabilityPool.getCollBalance(), 18, "Wrong SP Coll balance");
    }

    function liquidateMe() external {
        uint256 troveId = _getTroveId(msg.sender, troveManager.balanceOf(msg.sender));
        vm.assume(troveManager.getTroveStatus(troveId) == ITroveManager.Status.active);

        (uint256 debt, uint256 coll,,,) = troveManager.getEntireDebtAndColl(troveId);
        vm.assume(debt <= spBold); // only interested in SP offset, no redistribution

        logCall("liquidateMe");

        priceFeed.setPrice(initialPrice * LIQUIDATION_ICR / OPEN_TROVE_ICR);

        uint256 collBefore = collateralToken.balanceOf(address(this));
        uint256 accountSurplusBefore = collSurplusPool.getCollateral(msg.sender);
        uint256 collCompensation = coll / COLL_GAS_COMPENSATION_DIVISOR;
        // Calc claimable coll based on the remaining coll to liquidate, less the liq. penalty that goes to the SP depositors
        uint256 seizedColl = debt * (_100pct + troveManager.LIQUIDATION_PENALTY_SP()) / priceFeed.getPrice();
        // The Trove owner bears the gas compensation costs
        uint256 claimableColl = coll - seizedColl - collCompensation;

        // try
        troveManager.liquidate(troveId);
        // {} catch Panic(uint256 errorCode) {
        //     // XXX ignore assertion failure inside liquidation (due to P = 0)
        //     assertEq(errorCode, 1, "Unexpected revert in liquidate()");
        //     vm.assume(false);
        // }

        priceFeed.setPrice(initialPrice);

        info("totalBoldDeposits = ", stabilityPool.getTotalBoldDeposits().decimal());
        info("P = ", stabilityPool.P().decimal());
        _log();

        uint256 collAfter = collateralToken.balanceOf(address(this));
        uint256 accountSurplusAfter = collSurplusPool.getCollateral(msg.sender);
        // Check liquidator got the compensation
        // This is first branch, so coll token is WETH (used for ETH liquidation reserve)
        assertEqDecimal(collAfter, collBefore + collCompensation + ETH_GAS_COMPENSATION, 18, "Wrong Coll compensation");
        // Check claimable coll surplus is correct
        uint256 accountSurplusDelta = accountSurplusAfter - accountSurplusBefore;
        assertEqDecimal(accountSurplusDelta, claimableColl, 18, "Wrong account surplus");

        spBold -= debt;
        spColl += coll - claimableColl - collCompensation;

        assertEqDecimal(spBold, stabilityPool.getTotalBoldDeposits(), 18, "Wrong SP BOLD balance");
        assertEqDecimal(spColl, stabilityPool.getCollBalance(), 18, "Wrong SP Coll balance");
    }
}
