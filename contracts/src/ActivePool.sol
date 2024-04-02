// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

import "./Dependencies/Ownable.sol";
import "./Dependencies/CheckContract.sol";
import './Interfaces/IDefaultPool.sol';
import './Interfaces/IActivePool.sol';

// import "forge-std/console.sol";

/*
 * The Active Pool holds the ETH collateral and Bold debt (but not Bold tokens) for all active troves.
 *
 * When a trove is liquidated, it's ETH and Bold debt are transferred from the Active Pool, to either the
 * Stability Pool, the Default Pool, or both, depending on the liquidation conditions.
 *
 */
contract ActivePool is Ownable, CheckContract, IActivePool {
    using SafeERC20 for IERC20;

    string constant public NAME = "ActivePool";

    IERC20 public immutable ETH;
    address public borrowerOperationsAddress;
    address public troveManagerAddress;
    address public stabilityPoolAddress;
    address public defaultPoolAddress;
    uint256 internal ETHBalance;  // deposited ether tracker
    uint256 internal boldDebt;

    // --- Events ---

    event DefaultPoolAddressChanged(address _newDefaultPoolAddress);
    event StabilityPoolAddressChanged(address _newStabilityPoolAddress);
    event EtherSent(address _to, uint _amount);
    event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);
    event TroveManagerAddressChanged(address _newTroveManagerAddress);
    event ActivePoolBoldDebtUpdated(uint _boldDebt);
    event ActivePoolETHBalanceUpdated(uint _ETHBalance);

    constructor(address _ETHAddress) {
        checkContract(_ETHAddress);
        ETH = IERC20(_ETHAddress);
    }

    // --- Contract setters ---

    function setAddresses(
        address _borrowerOperationsAddress,
        address _troveManagerAddress,
        address _stabilityPoolAddress,
        address _defaultPoolAddress
    )
        external
        onlyOwner
    {
        checkContract(_borrowerOperationsAddress);
        checkContract(_troveManagerAddress);
        checkContract(_stabilityPoolAddress);
        checkContract(_defaultPoolAddress);

        borrowerOperationsAddress = _borrowerOperationsAddress;
        troveManagerAddress = _troveManagerAddress;
        stabilityPoolAddress = _stabilityPoolAddress;
        defaultPoolAddress = _defaultPoolAddress;

        emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);
        emit TroveManagerAddressChanged(_troveManagerAddress);
        emit StabilityPoolAddressChanged(_stabilityPoolAddress);
        emit DefaultPoolAddressChanged(_defaultPoolAddress);

        // Allow funds movements between Liquity contracts
        ETH.approve(_defaultPoolAddress, type(uint256).max);

        _renounceOwnership();
    }

    // --- Getters for public variables. Required by IPool interface ---

    /*
    * Returns the ETH state variable.
    *
    *Not necessarily equal to the the contract's raw ETH balance - ether can be forcibly sent to contracts.
    */
    function getETHBalance() external view override returns (uint) {
        return ETHBalance;
    }

    function getBoldDebt() external view override returns (uint) {
        return boldDebt;
    }

    // --- Pool functionality ---

    function sendETH(address _account, uint _amount) external override {
        _requireCallerIsBOorTroveMorSP();

        _accountForSendETH(_account, _amount);

        ETH.safeTransfer(_account, _amount);
    }

    function sendETHToDefaultPool(uint _amount) external override {
        _requireCallerIsTroveManager();

        address defaultPoolAddressCached = defaultPoolAddress;
        _accountForSendETH(defaultPoolAddressCached, _amount);

        IDefaultPool(defaultPoolAddressCached).receiveETH(_amount);
    }

    function _accountForSendETH(address _account, uint _amount) internal {
        uint256 newETHBalance = ETHBalance - _amount;
        ETHBalance = newETHBalance;
        emit ActivePoolETHBalanceUpdated(newETHBalance);
        emit EtherSent(_account, _amount);
    }

    function receiveETH(uint256 _amount) external {
        _requireCallerIsBorrowerOperationsOrDefaultPool();

        uint256 newETHBalance = ETHBalance + _amount;
        ETHBalance = newETHBalance;

        // Pull ETH tokens from sender
        ETH.safeTransferFrom(msg.sender, address(this), _amount);

        emit ActivePoolETHBalanceUpdated(newETHBalance);
    }

    function increaseBoldDebt(uint _amount) external override {
        _requireCallerIsBOorTroveM();
        boldDebt  = boldDebt + _amount;
        emit ActivePoolBoldDebtUpdated(boldDebt);
    }

    function decreaseBoldDebt(uint _amount) external override {
        _requireCallerIsBOorTroveMorSP();
        boldDebt = boldDebt - _amount;
        emit ActivePoolBoldDebtUpdated(boldDebt);
    }

    // --- 'require' functions ---

    function _requireCallerIsBorrowerOperationsOrDefaultPool() internal view {
        require(
            msg.sender == borrowerOperationsAddress ||
            msg.sender == defaultPoolAddress,
            "ActivePool: Caller is neither BO nor Default Pool");
    }

    function _requireCallerIsBOorTroveMorSP() internal view {
        require(
            msg.sender == borrowerOperationsAddress ||
            msg.sender == troveManagerAddress ||
            msg.sender == stabilityPoolAddress,
            "ActivePool: Caller is neither BorrowerOperations nor TroveManager nor StabilityPool");
    }

    function _requireCallerIsBOorTroveM() internal view {
        require(
            msg.sender == borrowerOperationsAddress ||
            msg.sender == troveManagerAddress,
            "ActivePool: Caller is neither BorrowerOperations nor TroveManager");
    }

    function _requireCallerIsTroveManager() internal view {
        require(
            msg.sender == troveManagerAddress,
            "ActivePool: Caller is not TroveManager");
    }
}
