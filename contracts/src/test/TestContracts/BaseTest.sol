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
import "../../Interfaces/ITroveManager.sol";
import "../../Interfaces/ICollateralRegistry.sol";
import "./PriceFeedTestnet.sol";
import "../../Interfaces/IInterestRouter.sol";
import "../../GasPool.sol";

import "forge-std/Test.sol";
import "forge-std/console2.sol";

contract BaseTest is Test {
    Accounts accounts;

    address[] accountsList;
    address public A;
    address public B;
    address public C;
    address public D;
    address public E;
    address public F;
    address public G;

    uint256 public constant DECIMAL_PRECISION = 1e18;
    uint256 public constant MAX_UINT256 = type(uint256).max;
    uint256 public constant SECONDS_IN_1_YEAR = 31536000; // 60*60*24*365
    uint256 _100pct = 100e16;
    uint256 MCR = 110e16;
    uint256 CCR = 150e16;
    address public constant ZERO_ADDRESS = address(0);

    // Core contracts
    IActivePool activePool;
    IBorrowerOperations borrowerOperations;
    ICollSurplusPool collSurplusPool;
    IDefaultPool defaultPool;
    ISortedTroves sortedTroves;
    IStabilityPool stabilityPool;
    ITroveManager troveManager;
    IBoldToken boldToken;
    ICollateralRegistry collateralRegistry;
    IPriceFeedTestnet priceFeed;

    GasPool gasPool;
    IInterestRouter mockInterestRouter;

    // Structs for use in test where we need to bi-pass "stack-too-deep" errors
    struct ABCDEF {
        uint256 A;
        uint256 B;
        uint256 C;
        uint256 D;
        uint256 E;
    }

    // --- functions ---

    function createAccounts() public {
        address[10] memory tempAccounts;
        for (uint256 i = 0; i < accounts.getAccountsCount(); i++) {
            tempAccounts[i] = vm.addr(uint256(accounts.accountsPks(i)));
        }

        accountsList = tempAccounts;
    }

    function addressToTroveId(address _owner, uint256 _ownerIndex) public pure returns (uint256) {
        return uint256(keccak256(abi.encode(_owner, _ownerIndex)));
    }

    function addressToTroveId(address _owner) public pure returns (uint256) {
        return addressToTroveId(_owner, 0);
    }

    function openTroveNoHints100pct(address _account, uint256 _coll, uint256 _boldAmount, uint256 _annualInterestRate)
        public
        returns (uint256)
    {
        return openTroveNoHints100pctWithIndex(_account, 0, _coll, _boldAmount, _annualInterestRate);
    }

    function openTroveNoHints100pctWithIndex(
        address _account,
        uint256 _index,
        uint256 _coll,
        uint256 _boldAmount,
        uint256 _annualInterestRate
    ) public returns (uint256) {
        vm.startPrank(_account);
        uint256 troveId = borrowerOperations.openTrove(_account, _index, _coll, _boldAmount, 0, 0, _annualInterestRate);
        vm.stopPrank();
        return troveId;
    }

    // (uint _maxFeePercentage, uint _collWithdrawal, uint _boldChange, bool _isDebtIncrease)
    function adjustTrove100pct(
        address _account,
        uint256 _troveId,
        uint256 _collChange,
        uint256 _boldChange,
        bool _isCollIncrease,
        bool _isDebtIncrease
    ) public {
        vm.startPrank(_account);
        borrowerOperations.adjustTrove(_troveId, _collChange, _isCollIncrease, _boldChange, _isDebtIncrease);
        vm.stopPrank();
    }

    function changeInterestRateNoHints(address _account, uint256 _troveId, uint256 _newAnnualInterestRate) public {
        vm.startPrank(_account);
        borrowerOperations.adjustTroveInterestRate(_troveId, _newAnnualInterestRate, 0, 0);
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

    function claimAllETHGains(address _account) public {
        vm.startPrank(_account);
        stabilityPool.claimAllETHGains();
        vm.stopPrank();
    }

    function closeTrove(address _account, uint256 _troveId) public {
        vm.startPrank(_account);
        borrowerOperations.closeTrove(_troveId);
        vm.stopPrank();
    }

    function withdrawBold100pct(address _account, uint256 _troveId, uint256 _debtIncrease) public {
        vm.startPrank(_account);
        borrowerOperations.withdrawBold(_troveId, _debtIncrease);
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
        console.log(_trovesList[0], "trove 0 to liq");
        console.log(_trovesList[1], "trove 1 to liq");
        troveManager.batchLiquidateTroves(_trovesList);
        vm.stopPrank();
    }

    function redeem(address _from, uint256 _boldAmount) public {
        vm.startPrank(_from);
        collateralRegistry.redeemCollateral(_boldAmount, MAX_UINT256, 1e18);
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
}
