// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

import "./Accounts.sol";
import "src/Interfaces/IActivePool.sol";
import "src/Interfaces/IBoldToken.sol";
import "src/Interfaces/ICollSurplusPool.sol";
import "src/Interfaces/IDefaultPool.sol";
import "src/Interfaces/IPriceFeed.sol";
import "src/Interfaces/ISortedTroves.sol";
import "src/Interfaces/IStabilityPool.sol";
import "./BorrowerOperationsTester.t.sol";
import "./TroveManagerTester.t.sol";
import "src/Interfaces/ICollateralRegistry.sol";
import "./PriceFeedTestnet.sol";
import "src/Interfaces/IInterestRouter.sol";
import "src/GasPool.sol";
import "src/HintHelpers.sol";
import "src/Zappers/WETHZapper.sol";
import "src/Zappers/GasCompZapper.sol";
import "src/Zappers/LeverageLSTZapper.sol";
import {mulDivCeil} from "../Utils/Math.sol";
import {Logging} from "../Utils/Logging.sol";
import {StringFormatting} from "../Utils/StringFormatting.sol";
import {TroveId} from "../Utils/TroveId.sol";

import "forge-std/console2.sol";

contract BaseTest is TestAccounts, Logging, TroveId {
    uint256 constant STALE_TROVE_DURATION = 90 days;

    uint256 CCR;
    uint256 MCR;
    uint256 BCR;
    uint256 SCR;
    uint256 LIQUIDATION_PENALTY_SP;
    uint256 LIQUIDATION_PENALTY_REDISTRIBUTION;

    // Addresses
    address governor;

    // Core contracts
    IAddressesRegistry addressesRegistry;
    IActivePool activePool;
    IBorrowerOperationsTester borrowerOperations;
    ICollSurplusPool collSurplusPool;
    IDefaultPool defaultPool;
    ISortedTroves sortedTroves;
    IStabilityPool stabilityPool;
    ITroveManagerTester troveManager;
    ITroveNFT troveNFT;
    IMetadataNFT metadataNFT;
    IBoldToken boldToken;
    ICollateralRegistry collateralRegistry;
    IPriceFeedTestnet priceFeed;
    GasPool gasPool;
    IInterestRouter mockInterestRouter;
    IERC20 collToken;
    HintHelpers hintHelpers;
    IWETH WETH; // used for gas compensation
    WETHZapper wethZapper;
    GasCompZapper gasCompZapper;
    ILeverageZapper leverageZapperCurve;
    ILeverageZapper leverageZapperUniV3;

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

    function getTroveEntireColl(uint256 _troveId) internal view returns (uint256) {
        LatestTroveData memory trove = troveManager.getLatestTroveData(_troveId);
        return trove.entireColl;
    }

    function getTroveEntireDebt(uint256 _troveId) internal view returns (uint256) {
        LatestTroveData memory trove = troveManager.getLatestTroveData(_troveId);
        return trove.entireDebt;
    }

    function getTroveEntireColl(ITroveManager _troveManager, uint256 _troveId) internal view returns (uint256) {
        LatestTroveData memory trove = _troveManager.getLatestTroveData(_troveId);
        return trove.entireColl;
    }

    function getTroveEntireDebt(ITroveManager _troveManager, uint256 _troveId) internal view returns (uint256) {
        LatestTroveData memory trove = _troveManager.getLatestTroveData(_troveId);
        return trove.entireDebt;
    }

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

    function forcePredictAdjustInterestRateUpfrontFee(uint256 troveId, uint256 newInterestRate)
        internal
        view
        returns (uint256)
    {
        return hintHelpers.forcePredictAdjustInterestRateUpfrontFee(0, troveId, newInterestRate);
    }

    function predictAdjustTroveUpfrontFee(uint256 troveId, uint256 debtIncrease) internal view returns (uint256) {
        return hintHelpers.predictAdjustTroveUpfrontFee(0, troveId, debtIncrease);
    }

    function predictJoinBatchInterestRateUpfrontFee(uint256 _troveId, address _batchAddress)
        internal
        view
        returns (uint256)
    {
        return hintHelpers.predictJoinBatchInterestRateUpfrontFee(0, _troveId, _batchAddress);
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
            upfrontFee,
            address(0),
            address(0),
            address(0)
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
        troveId = borrowerOperations.openTrove(
            _account, _index, _coll, borrow, 0, 0, _interestRate, upfrontFee, address(0), address(0), address(0)
        );
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
        troveId = borrowerOperations.openTrove(
            _account, _index, coll, borrow, 0, 0, _interestRate, upfrontFee, address(0), address(0), address(0)
        );
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

    function adjustZombieTrove(
        address _account,
        uint256 _troveId,
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _boldChange,
        bool _isDebtIncrease
    ) public {
        vm.startPrank(_account);

        borrowerOperations.adjustZombieTrove(
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

    function checkBelowCriticalThreshold(bool _true) public view {
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

    function applyPendingDebt(address _from, uint256 _troveId) public {
        vm.startPrank(_from);
        borrowerOperations.applyPendingDebt(_troveId);
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
        registerBatchManager(
            _account, uint128(1e16), uint128(20e16), uint128(5e16), uint128(25e14), MIN_INTEREST_RATE_CHANGE_PERIOD
        );
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
        return openTroveAndJoinBatchManagerWithIndex(_troveOwner, 0, _coll, _debt, _batchAddress, _annualInterestRate);
    }

    function openTroveAndJoinBatchManagerWithIndex(
        address _troveOwner,
        uint256 _index,
        uint256 _coll,
        uint256 _debt,
        address _batchAddress,
        uint256 _annualInterestRate
    ) internal returns (uint256) {
        if (!borrowerOperations.checkBatchManagerExists(_batchAddress)) {
            registerBatchManager(
                _batchAddress,
                uint128(LiquityMath._min(1e16, _annualInterestRate)),
                uint128(LiquityMath._max(20e16, _annualInterestRate)),
                uint128(_annualInterestRate),
                uint128(25e14),
                MIN_INTEREST_RATE_CHANGE_PERIOD
            );
        }

        IBorrowerOperations.OpenTroveAndJoinInterestBatchManagerParams memory params = IBorrowerOperations
            .OpenTroveAndJoinInterestBatchManagerParams({
            owner: _troveOwner,
            ownerIndex: _index,
            collAmount: _coll,
            boldAmount: _debt,
            upperHint: 0,
            lowerHint: 0,
            interestBatchManager: _batchAddress,
            maxUpfrontFee: 1e24,
            addManager: address(0),
            removeManager: address(0),
            receiver: address(0)
        });
        vm.startPrank(_troveOwner);
        uint256 troveId = borrowerOperations.openTroveAndJoinInterestBatchManager(params);
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
                MIN_INTEREST_RATE_CHANGE_PERIOD
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

    function switchBatchManager(address _troveOwner, uint256 _troveId, address _newBatchManager) internal {
        switchBatchManager(_troveOwner, _troveId, 0, 0, _newBatchManager, 0, 0, type(uint256).max);
    }

    function switchBatchManager(
        address _troveOwner,
        uint256 _troveId,
        uint256 _removeUpperHint,
        uint256 _removeLowerHint,
        address _newBatchManager,
        uint256 _addUpperHint,
        uint256 _addLowerHint,
        uint256 _maxUpfrontFee
    ) internal {
        vm.startPrank(_troveOwner);
        borrowerOperations.switchBatchManager(
            _troveId, _removeUpperHint, _removeLowerHint, _newBatchManager, _addUpperHint, _addLowerHint, _maxUpfrontFee
        );
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

    function assertApproximatelyEqual(uint256 _x, uint256 _y, uint256 _margin) public pure {
        assertApproxEqAbs(_x, _y, _margin, "");
    }

    function assertApproximatelyEqual(uint256 _x, uint256 _y, uint256 _margin, string memory _reason) public pure {
        assertApproxEqAbs(_x, _y, _margin, _reason);
    }

    function uintToArray(uint256 _value) public pure returns (uint256[] memory result) {
        result = new uint256[](1);
        result[0] = _value;
    }
}
