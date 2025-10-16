// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {IBorrowerOperations} from "src/Interfaces/IBorrowerOperations.sol";
import {IBoldToken} from "src/Interfaces/IBoldToken.sol";
import {IStabilityPool} from "src/Interfaces/IStabilityPool.sol";
import {ITroveManager} from "src/Interfaces/ITroveManager.sol";
import {ICollSurplusPool} from "src/Interfaces/ICollSurplusPool.sol";
import {HintHelpers} from "src/HintHelpers.sol";
import {IMockFXPriceFeed} from "./Interfaces/IMockFXPriceFeed.sol";
import {ITroveManagerTester} from "./Interfaces/ITroveManagerTester.sol";
import {LiquityMath} from "src/Dependencies/LiquityMath.sol";
import {ISystemParams} from "src/Interfaces/ISystemParams.sol";
import {mulDivCeil} from "../Utils/Math.sol";
import {StringFormatting} from "../Utils/StringFormatting.sol";
import {TroveId} from "../Utils/TroveId.sol";
import {BaseHandler} from "./BaseHandler.sol";

import {
    DECIMAL_PRECISION,
    _1pct,
    _100pct
} from "src/Dependencies/Constants.sol";

using {mulDivCeil} for uint256;

// Test parameters
uint256 constant OPEN_TROVE_BORROWED_MIN = 2_000 ether;
uint256 constant OPEN_TROVE_BORROWED_MAX = 100e18 ether;
uint256 constant OPEN_TROVE_ICR = 1.5 ether; // CCR
uint256 constant LIQUIDATION_ICR = MCR - _1pct;

// Universal constants
uint256 constant MCR = 1.1 ether;

contract SPInvariantsTestHandler is BaseHandler, TroveId {
    using StringFormatting for uint256;

    struct Contracts {
        IBoldToken boldToken;
        IBorrowerOperations borrowerOperations;
        IERC20 collateralToken;
        IMockFXPriceFeed priceFeed;
        IStabilityPool stabilityPool;
        ITroveManagerTester troveManager;
        ICollSurplusPool collSurplusPool;
        ISystemParams systemParams;
    }

    IBoldToken immutable boldToken;
    IBorrowerOperations immutable borrowerOperations;
    IERC20 collateralToken;
    IMockFXPriceFeed immutable priceFeed;
    IStabilityPool immutable stabilityPool;
    ITroveManagerTester immutable troveManager;
    ICollSurplusPool immutable collSurplusPool;
    ISystemParams immutable systemParams;
    HintHelpers immutable hintHelpers;

    uint256 immutable initialPrice;
    mapping(address owner => uint256) troveIndexOf;

    // System params
    uint256 immutable ETH_GAS_COMPENSATION;
    uint256 immutable MIN_ANNUAL_INTEREST_RATE;
    uint256 immutable MIN_BOLD_IN_SP;
    uint256 immutable COLL_GAS_COMPENSATION_DIVISOR;

    // Ghost variables
    uint256 myBold = 0;
    uint256 spBold = 0;
    uint256 spColl = 0;

    // Fixtures
    uint256[] fixtureDeposited;

    constructor(Contracts memory contracts, HintHelpers hintHelpers_) {
        boldToken = contracts.boldToken;
        borrowerOperations = contracts.borrowerOperations;
        collateralToken = contracts.collateralToken;
        priceFeed = contracts.priceFeed;
        stabilityPool = contracts.stabilityPool;
        troveManager = contracts.troveManager;
        collSurplusPool = contracts.collSurplusPool;
        systemParams = contracts.systemParams;
        hintHelpers = hintHelpers_;

        initialPrice = priceFeed.getPrice();

        // Initialize system params
        ETH_GAS_COMPENSATION = systemParams.ETH_GAS_COMPENSATION();
        MIN_ANNUAL_INTEREST_RATE = systemParams.MIN_ANNUAL_INTEREST_RATE();
        MIN_BOLD_IN_SP = systemParams.MIN_BOLD_IN_SP();
        COLL_GAS_COMPENSATION_DIVISOR = systemParams.COLL_GAS_COMPENSATION_DIVISOR();
    }

    function openTrove(uint256 borrowed) external returns (uint256 debt) {
        uint256 i = troveIndexOf[msg.sender];
        vm.assume(troveManager.getTroveStatus(addressToTroveId(msg.sender, i)) != ITroveManager.Status.active);

        borrowed = _bound(borrowed, OPEN_TROVE_BORROWED_MIN, OPEN_TROVE_BORROWED_MAX);
        uint256 price = priceFeed.getPrice();
        debt = borrowed + hintHelpers.predictOpenTroveUpfrontFee(0, borrowed, MIN_ANNUAL_INTEREST_RATE);
        uint256 coll = debt.mulDivCeil(OPEN_TROVE_ICR, price);
        assertEqDecimal(coll * price / debt, OPEN_TROVE_ICR, 18, "Wrong ICR");

        info("coll = ", coll.decimal(), ", debt = ", debt.decimal());
        logCall("openTrove", borrowed.decimal());

        deal(address(collateralToken), msg.sender, coll + ETH_GAS_COMPENSATION);
        vm.prank(msg.sender);
        collateralToken.approve(address(borrowerOperations), coll + ETH_GAS_COMPENSATION);
        vm.prank(msg.sender);
        uint256 troveId = borrowerOperations.openTrove(
            msg.sender,
            i,
            coll,
            borrowed,
            0,
            0,
            MIN_ANNUAL_INTEREST_RATE,
            type(uint256).max,
            address(0),
            address(0),
            address(0)
        );
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
        uint256 boldGain = stabilityPool.getDepositorYieldGainWithPending(msg.sender);

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

        // Sweep BOLD gain
        vm.prank(msg.sender);
        boldToken.transfer(address(this), boldGain);
        assertEqDecimal(boldToken.balanceOf(msg.sender), 0, 18, "Incomplete BOLD sweep");
        myBold += boldGain;

        myBold -= deposited;
        spBold += deposited;
        spColl -= collGain;

        assertEqDecimal(spBold, stabilityPool.getTotalBoldDeposits(), 18, "Wrong SP BOLD balance");
        assertEqDecimal(spColl, stabilityPool.getCollBalance(), 18, "Wrong SP Coll balance");
    }

    function liquidateMe() external {
        vm.assume(troveManager.getTroveIdsCount() > 1);
        uint256 troveId = addressToTroveId(msg.sender, troveIndexOf[msg.sender]);
        vm.assume(troveManager.getTroveStatus(troveId) == ITroveManager.Status.active);

        (uint256 debt, uint256 coll,,,) = troveManager.getEntireDebtAndColl(troveId);
        vm.assume(debt <= (spBold > MIN_BOLD_IN_SP ? spBold - MIN_BOLD_IN_SP : 0)); // only interested in SP offset, no redistribution

        logCall("liquidateMe");

        priceFeed.setPrice(initialPrice * LIQUIDATION_ICR / OPEN_TROVE_ICR);

        uint256 collBefore = collateralToken.balanceOf(address(this));
        uint256 accountSurplusBefore = collSurplusPool.getCollateral(msg.sender);
        uint256 totalBoldDeposits = stabilityPool.getTotalBoldDeposits();
        uint256 boldInSPForOffsets = totalBoldDeposits - LiquityMath._min(MIN_BOLD_IN_SP, totalBoldDeposits);
        uint256 collCompensation = troveManager.getCollGasCompensation(coll, debt, boldInSPForOffsets);
        // Calc claimable coll based on the remaining coll to liquidate, less the liq. penalty that goes to the SP depositors
        uint256 seizedColl = debt * (_100pct + troveManager.get_LIQUIDATION_PENALTY_SP()) / priceFeed.getPrice();
        // The Trove owner bears the gas compensation costs
        uint256 claimableColl = coll - seizedColl - collCompensation;

        troveManager.liquidate(troveId);

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

        ++troveIndexOf[msg.sender];

        spBold -= debt;
        spColl += coll - claimableColl - collCompensation;

        assertEqDecimal(spBold, stabilityPool.getTotalBoldDeposits(), 18, "Wrong SP BOLD balance");
        assertEqDecimal(spColl, stabilityPool.getCollBalance(), 18, "Wrong SP Coll balance");
    }
}
