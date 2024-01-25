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

    uint256 public constant MAX_UINT256 = type(uint256).max;
    uint256 public constant SECONDS_IN_1_YEAR = 31536000; // 60*60*24*365
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

    GasPool gasPool;

    function createAccounts() public {
        address[10] memory tempAccounts;
        for (uint256 i = 0; i < accounts.getAccountsCount(); i++) {
            tempAccounts[i] = vm.addr(uint256(accounts.accountsPks(i)));
        }

        accountsList = tempAccounts;
    }

    function openTroveNoHints100pctMaxFee(
        address _account, 
        uint256 _coll, 
        uint256 _boldAmount, 
        uint256 _annualInterestRate
    ) 
    public 
    {
        vm.startPrank(_account);
        borrowerOperations.openTrove{value: _coll}(1e18, _boldAmount, ZERO_ADDRESS, ZERO_ADDRESS, _annualInterestRate);
        vm.stopPrank();
    }


    // (uint _maxFeePercentage, uint _collWithdrawal, uint _boldChange, bool _isDebtIncrease)
    function adjustTrove100pctMaxFee(
        address _account, 
        uint256 _collChange,
        uint256 _boldChange, 
        bool _isCollIncrease,
        bool _isDebtIncrease
    ) 
    public 
    {
        vm.startPrank(_account);
        if (_isCollIncrease) {
            borrowerOperations.adjustTrove{value: _collChange}(1e18, 0, _boldChange,  _isDebtIncrease);
        } else {
            borrowerOperations.adjustTrove(1e18, _collChange, _boldChange,  _isDebtIncrease);
        }
        vm.stopPrank();
    }

    function changeInterestRateNoHints(address _account, uint256 _newAnnualInterestRate) public {
        vm.startPrank(_account);
        borrowerOperations.adjustTroveInterestRate(_newAnnualInterestRate, ZERO_ADDRESS, ZERO_ADDRESS);
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
}
