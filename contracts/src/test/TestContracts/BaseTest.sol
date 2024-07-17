// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.18;

import "./Accounts.sol";
import "../../Interfaces/IActivePool.sol";
import "../../Interfaces/IBoldToken.sol";
import "../../Interfaces/IBorrowerOperations.sol";
import "../../Interfaces/ICollSurplusPool.sol";
import "../../Interfaces/IDefaultPool.sol";
import "../../Interfaces/IPriceFeed.sol";
import "../../Interfaces/ISortedTroves.sol";
import "../../Interfaces/IStabilityPool.sol";
import "./TroveManagerTester.t.sol";
import "../../Interfaces/ICollateralRegistry.sol";
import "./PriceFeedTestnet.sol";
import "../../Interfaces/IInterestRouter.sol";
import "../../GasPool.sol";
import "../../HintHelpers.sol";
import {mulDivCeil} from "../Utils/Math.sol";

import "forge-std/console2.sol";

contract BaseTest is TestAccounts {
    uint256 MCR;
    uint256 SCR;
    uint256 LIQUIDATION_PENALTY_SP;
    uint256 LIQUIDATION_PENALTY_REDISTRIBUTION;

    // Core contracts
    IActivePool activePool;
    IBorrowerOperations borrowerOperations;
    ICollSurplusPool collSurplusPool;
    IDefaultPool defaultPool;
    ISortedTroves sortedTroves;
    IStabilityPool stabilityPool;
    ITroveManagerTester troveManager;
    IBoldToken boldToken;
    ICollateralRegistry collateralRegistry;
    IPriceFeedTestnet priceFeed;
    GasPool gasPool;
    IInterestRouter mockInterestRouter;
    IERC20 collToken;
    HintHelpers hintHelpers;
    IERC20 WETH; // used for gas compensation

    // Structs for use in test where we need to bi-pass "stack-too-deep" errors
    struct ABCDEF {
        uint256 A;
        uint256 B;
        uint256 C;
        uint256 D;
        uint256 E;
        uint256 F;
    }

    // --- functions ---

    function calcInterest(uint256 weightedRecordedDebt, uint256 period) internal pure returns (uint256) {
        return weightedRecordedDebt * period / 365 days / DECIMAL_PRECISION;
    }

    function calcUpfrontFee(uint256 debt, uint256 avgInterestRate) internal pure returns (uint256) {
        return calcInterest(debt * avgInterestRate, UPFRONT_INTEREST_PERIOD);
    }

    function predictOpenTroveUpfrontFee(uint256 borrowedAmount, uint256 interestRate) internal view returns (uint256) {
        return hintHelpers.predictOpenTroveUpfrontFee(0, borrowedAmount, interestRate);
    }

    function predictAdjustInterestRateUpfrontFee(uint256 troveId, uint256 newInterestRate)
        internal
        view
        returns (uint256)
    {
        return hintHelpers.predictAdjustInterestRateUpfrontFee(0, troveId, newInterestRate);
    }

    function predictAdjustTroveUpfrontFee(uint256 troveId, uint256 debtIncrease) internal view returns (uint256) {
        return hintHelpers.predictAdjustTroveUpfrontFee(0, troveId, debtIncrease);
    }

    // Quick and dirty binary search instead of Newton's, because it's easier
    function findAmountToBorrowWithOpenTrove(uint256 targetDebt, uint256 interestRate)
        internal
        view
        returns (uint256 borrow, uint256 upfrontFee)
    {
        uint256 borrowRight = targetDebt;
        upfrontFee = predictOpenTroveUpfrontFee(borrowRight, interestRate);
        uint256 borrowLeft = borrowRight - upfrontFee;

        for (uint256 i = 0; i < 256; ++i) {
            borrow = (borrowLeft + borrowRight) / 2;
            upfrontFee = predictOpenTroveUpfrontFee(borrow, interestRate);
            uint256 actualDebt = borrow + upfrontFee;

            if (actualDebt == targetDebt) {
                break;
            } else if (actualDebt < targetDebt) {
                borrowLeft = borrow;
            } else {
                borrowRight = borrow;
            }
        }
    }

    function findAmountToBorrowWithAdjustTrove(uint256 troveId, uint256 targetDebt)
        internal
        view
        returns (uint256 borrow, uint256 upfrontFee)
    {
        uint256 entireDebt = troveManager.getTroveEntireDebt(troveId);
        assert(targetDebt >= entireDebt);

        uint256 borrowRight = targetDebt - entireDebt;
        upfrontFee = predictAdjustTroveUpfrontFee(troveId, borrowRight);
        uint256 borrowLeft = borrowRight - upfrontFee;

        for (uint256 i = 0; i < 256; ++i) {
            borrow = (borrowLeft + borrowRight) / 2;
            upfrontFee = predictAdjustTroveUpfrontFee(troveId, borrow);
            uint256 actualDebt = entireDebt + borrow + upfrontFee;

            if (actualDebt == targetDebt) {
                break;
            } else if (actualDebt < targetDebt) {
                borrowLeft = borrow;
            } else {
                borrowRight = borrow;
            }
        }
    }

    function getRedeemableDebt(uint256 troveId) internal view returns (uint256) {
        return troveManager.getTroveEntireDebt(troveId);
    }

    function addressToTroveId(address _owner, uint256 _ownerIndex) public pure returns (uint256) {
        return uint256(keccak256(abi.encode(_owner, _ownerIndex)));
    }

    function addressToTroveId(address _owner) public pure returns (uint256) {
        return addressToTroveId(_owner, 0);
    }

    function openTroveNoHints100pct(address _account, uint256 _coll, uint256 _boldAmount, uint256 _annualInterestRate)
        public
        returns (uint256 troveId)
    {
        (troveId,) = openTroveHelper(_account, 0, _coll, _boldAmount, _annualInterestRate);
    }

    function openTroveNoHints100pctWithIndex(
        address _account,
        uint256 _index,
        uint256 _coll,
        uint256 _boldAmount,
        uint256 _annualInterestRate
    ) public returns (uint256 troveId) {
        (troveId,) = openTroveHelper(_account, _index, _coll, _boldAmount, _annualInterestRate);
    }

    function openTroveHelper(
        address _account,
        uint256 _index,
        uint256 _coll,
        uint256 _boldAmount,
        uint256 _annualInterestRate
    ) public returns (uint256 troveId, uint256 upfrontFee) {
        upfrontFee = predictOpenTroveUpfrontFee(_boldAmount, _annualInterestRate);

        vm.startPrank(_account);

        troveId = borrowerOperations.openTrove(
            _account,
            _index,
            _coll,
            _boldAmount,
            0, // _upperHint
            0, // _lowerHint
            _annualInterestRate,
            upfrontFee
        );

        vm.stopPrank();
    }

    function openTroveWithExactDebt(
        address _account,
        uint256 _index,
        uint256 _coll,
        uint256 _debt,
        uint256 _interestRate
    ) public returns (uint256 troveId) {
        (uint256 borrow, uint256 upfrontFee) = findAmountToBorrowWithOpenTrove(_debt, _interestRate);

        vm.prank(_account);
        troveId = borrowerOperations.openTrove(_account, _index, _coll, borrow, 0, 0, _interestRate, upfrontFee);
    }

    function openTroveWithExactICRAndDebt(
        address _account,
        uint256 _index,
        uint256 _ICR,
        uint256 _debt,
        uint256 _interestRate
    ) public returns (uint256 troveId, uint256 coll) {
        (uint256 borrow, uint256 upfrontFee) = findAmountToBorrowWithOpenTrove(_debt, _interestRate);
        uint256 price = priceFeed.getPrice();
        coll = mulDivCeil(_debt, _ICR, price);

        vm.prank(_account);
        troveId = borrowerOperations.openTrove(_account, _index, coll, borrow, 0, 0, _interestRate, upfrontFee);
    }

    function adjustTrove100pct(
        address _account,
        uint256 _troveId,
        uint256 _collChange,
        uint256 _boldChange,
        bool _isCollIncrease,
        bool _isDebtIncrease
    ) public {
        vm.startPrank(_account);

        borrowerOperations.adjustTrove(
            _troveId,
            _collChange,
            _isCollIncrease,
            _boldChange,
            _isDebtIncrease,
            predictAdjustTroveUpfrontFee(
                _troveId,
                _isDebtIncrease ? _boldChange : 0 // debtIncrease
            )
        );

        vm.stopPrank();
    }

    function adjustUnredeemableTrove(
        address _account,
        uint256 _troveId,
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _boldChange,
        bool _isDebtIncrease
    ) public {
        vm.startPrank(_account);

        borrowerOperations.adjustUnredeemableTrove(
            _troveId,
            _collChange,
            _isCollIncrease,
            _boldChange,
            _isDebtIncrease,
            0, // _upperHint
            0, // _lowerHint
            predictAdjustTroveUpfrontFee(
                _troveId,
                _isDebtIncrease ? _boldChange : 0 // debtIncrease
            )
        );

        vm.stopPrank();
    }

    function changeInterestRateNoHints(address _account, uint256 _troveId, uint256 _newAnnualInterestRate)
        public
        returns (uint256 upfrontFee)
    {
        upfrontFee = predictAdjustInterestRateUpfrontFee(_troveId, _newAnnualInterestRate);

        vm.startPrank(_account);
        borrowerOperations.adjustTroveInterestRate(_troveId, _newAnnualInterestRate, 0, 0, upfrontFee);
        vm.stopPrank();
    }

    function checkBelowCriticalThreshold(bool _true) public {
        uint256 price = priceFeed.getPrice();
        bool belowCriticalThreshold = troveManager.checkBelowCriticalThreshold(price);
        assertEq(belowCriticalThreshold, _true);
    }

    function makeSPDepositAndClaim(address _account, uint256 _amount) public {
        vm.startPrank(_account);
        stabilityPool.provideToSP(_amount, true);
        vm.stopPrank();
    }

    function makeSPDepositNoClaim(address _account, uint256 _amount) public {
        vm.startPrank(_account);
        stabilityPool.provideToSP(_amount, false);
        vm.stopPrank();
    }

    function makeSPWithdrawalAndClaim(address _account, uint256 _amount) public {
        vm.startPrank(_account);
        stabilityPool.withdrawFromSP(_amount, true);
        vm.stopPrank();
    }

    function makeSPWithdrawalNoClaim(address _account, uint256 _amount) public {
        vm.startPrank(_account);
        stabilityPool.withdrawFromSP(_amount, false);
        vm.stopPrank();
    }

    function claimAllCollGains(address _account) public {
        vm.startPrank(_account);
        stabilityPool.claimAllCollGains();
        vm.stopPrank();
    }

    function closeTrove(address _account, uint256 _troveId) public {
        vm.startPrank(_account);
        borrowerOperations.closeTrove(_troveId);
        vm.stopPrank();
    }

    function withdrawBold100pct(address _account, uint256 _troveId, uint256 _debtIncrease) public {
        vm.startPrank(_account);
        borrowerOperations.withdrawBold(_troveId, _debtIncrease, predictAdjustTroveUpfrontFee(_troveId, _debtIncrease));
        vm.stopPrank();
    }

    function repayBold(address _account, uint256 _troveId, uint256 _debtDecrease) public {
        vm.startPrank(_account);
        borrowerOperations.repayBold(_troveId, _debtDecrease);
        vm.stopPrank();
    }

    function addColl(address _account, uint256 _troveId, uint256 _collIncrease) public {
        vm.startPrank(_account);
        borrowerOperations.addColl(_troveId, _collIncrease);
        vm.stopPrank();
    }

    function withdrawColl(address _account, uint256 _troveId, uint256 _collDecrease) public {
        vm.startPrank(_account);
        borrowerOperations.withdrawColl(_troveId, _collDecrease);
        vm.stopPrank();
    }

    function applyTroveInterestPermissionless(address _from, uint256 _troveId) public {
        vm.startPrank(_from);
        borrowerOperations.applyTroveInterestPermissionless(_troveId);
        vm.stopPrank();
    }

    function applyBatchInterestAndFeePermissionless(address _from, address _batchAddress) public {
        vm.startPrank(_from);
        borrowerOperations.applyBatchInterestAndFeePermissionless(_batchAddress);
        vm.stopPrank();
    }

    function transferBold(address _from, address _to, uint256 _amount) public {
        vm.startPrank(_from);
        boldToken.transfer(_to, _amount);
        vm.stopPrank();
    }

    function liquidate(address _from, uint256 _troveId) public {
        vm.startPrank(_from);
        troveManager.liquidate(_troveId);
        vm.stopPrank();
    }

    function batchLiquidateTroves(address _from, uint256[] memory _trovesList) public {
        vm.startPrank(_from);
        troveManager.batchLiquidateTroves(_trovesList);
        vm.stopPrank();
    }

    function redeem(address _from, uint256 _boldAmount) public {
        vm.startPrank(_from);
        collateralRegistry.redeemCollateral(_boldAmount, MAX_UINT256, 1e18);
        vm.stopPrank();
    }

    function getShareofSPReward(address _depositor, uint256 _reward) public view returns (uint256) {
        return _reward * stabilityPool.getCompoundedBoldDeposit(_depositor) / stabilityPool.getTotalBoldDeposits();
    }

    function registerBatchManager(address _account) internal {
        registerBatchManager(_account, uint128(1e16), uint128(20e16), uint128(5e16), uint128(25e14), uint128(0));
    }

    function registerBatchManager(
        address _account,
        uint128 _minInterestRate,
        uint128 _maxInterestRate,
        uint128 _currentInterestRate,
        uint128 _fee,
        uint128 _minInterestRateChangePeriod
    ) internal {
        vm.startPrank(_account);
        borrowerOperations.registerBatchManager(
            _minInterestRate, _maxInterestRate, _currentInterestRate, _fee, _minInterestRateChangePeriod
        );
        vm.stopPrank();
    }

    function openTroveAndJoinBatchManager() internal returns (uint256) {
        return openTroveAndJoinBatchManager(A, 100e18, 5000e18, B, 5e16);
    }

    function openTroveAndJoinBatchManager(
        address _troveOwner,
        uint256 _coll,
        uint256 _debt,
        address _batchAddress,
        uint256 _annualInterestRate
    ) internal returns (uint256) {
        if (!borrowerOperations.checkBatchManagerExists(_batchAddress)) {
            registerBatchManager(
                _batchAddress, uint128(1e16), uint128(20e16), uint128(_annualInterestRate), uint128(25e14), uint128(0)
            );
        }

        vm.startPrank(_troveOwner);
        uint256 troveId = borrowerOperations.openTroveAndJoinInterestBatchManager(
            _troveOwner,
            0,
            _coll,
            _debt,
            0, // _upperHint
            0, // _lowerHint
            _batchAddress,
            1e24
        );
        vm.stopPrank();

        return troveId;
    }

    function setBatchInterestRate(address _batchAddress, uint256 _newAnnualInterestRate) internal {
        vm.startPrank(_batchAddress);
        borrowerOperations.setBatchManagerAnnualInterestRate(uint128(_newAnnualInterestRate), 0, 0, type(uint256).max);
        vm.stopPrank();
    }

    function setInterestBatchManager(
        address _troveOwner,
        uint256 _troveId,
        address _newBatchManager,
        uint256 _annualInterestRate
    ) internal {
        if (!borrowerOperations.checkBatchManagerExists(_newBatchManager)) {
            registerBatchManager(
                _newBatchManager,
                uint128(1e16),
                uint128(20e16),
                uint128(_annualInterestRate),
                uint128(25e14),
                uint128(0)
            );
        }
        setInterestBatchManager(_troveOwner, _troveId, _newBatchManager);
    }

    function setInterestBatchManager(address _troveOwner, uint256 _troveId, address _newBatchManager) internal {
        vm.startPrank(_troveOwner);
        borrowerOperations.setInterestBatchManager(_troveId, _newBatchManager, 0, 0, type(uint256).max);
        vm.stopPrank();
    }

    function removeFromBatch(address _troveOwner, uint256 _troveId, uint256 _newAnnualInterestRate) internal {
        vm.startPrank(_troveOwner);
        borrowerOperations.removeFromBatch(_troveId, _newAnnualInterestRate, 0, 0, type(uint256).max);
        vm.stopPrank();
    }

    function logContractAddresses() public view {
        console.log("ActivePool addr: ", address(activePool));
        console.log("BorrowerOps addr: ", address(borrowerOperations));
        console.log("CollSurplusPool addr: ", address(collSurplusPool));
        console.log("DefaultPool addr: ", address(defaultPool));
        console.log("GasPool addr: ", address(gasPool));
        console.log("SortedTroves addr: ", address(sortedTroves));
        console.log("StabilityPool addr: ", address(stabilityPool));
        console.log("TroveManager addr: ", address(troveManager));
        console.log("BoldToken addr: ", address(boldToken));
    }

    function abs(uint256 x, uint256 y) public pure returns (uint256) {
        return x > y ? x - y : y - x;
    }

    function assertApproximatelyEqual(uint256 _x, uint256 _y, uint256 _margin) public {
        assertApproxEqAbs(_x, _y, _margin, "");
    }

    function assertApproximatelyEqual(uint256 _x, uint256 _y, uint256 _margin, string memory _reason) public {
        assertApproxEqAbs(_x, _y, _margin, _reason);
    }

    function uintToArray(uint256 _value) public pure returns (uint256[] memory result) {
        result = new uint256[](1);
        result[0] = _value;
    }
}
