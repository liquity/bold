// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

import "./Interfaces/IActivePool.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/CheckContract.sol";
import "./Interfaces/IDefaultPool.sol";

/*
 * The Default Pool holds the ETH and Bold debt (but not Bold tokens) from liquidations that have been redistributed
 * to active troves but not yet "applied", i.e. not yet recorded on a recipient active trove's struct.
 *
 * When a trove makes an operation that applies its pending ETH and Bold debt, its pending ETH and Bold debt is moved
 * from the Default Pool to the Active Pool.
 */
contract DefaultPool is Ownable, CheckContract, IDefaultPool {
    using SafeERC20 for IERC20;

    string public constant NAME = "DefaultPool";

    IERC20 public immutable ETH;
    address public troveManagerAddress;
    address public activePoolAddress;
    uint256 internal ETHBalance; // deposited ETH tracker
    uint256 internal BoldDebt; // debt

    event ActivePoolAddressChanged(address _newActivePoolAddress);
    event EtherSent(address _to, uint256 _amount);
    event TroveManagerAddressChanged(address _newTroveManagerAddress);
    event DefaultPoolBoldDebtUpdated(uint256 _boldDebt);
    event DefaultPoolETHBalanceUpdated(uint256 _ETHBalance);

    constructor(address _ETHAddress) {
        checkContract(_ETHAddress);
        ETH = IERC20(_ETHAddress);
    }

    // --- Dependency setters ---

    function setAddresses(address _troveManagerAddress, address _activePoolAddress) external onlyOwner {
        checkContract(_troveManagerAddress);
        checkContract(_activePoolAddress);

        troveManagerAddress = _troveManagerAddress;
        activePoolAddress = _activePoolAddress;

        emit TroveManagerAddressChanged(_troveManagerAddress);
        emit ActivePoolAddressChanged(_activePoolAddress);

        // Allow funds movements between Liquity contracts
        ETH.approve(_activePoolAddress, type(uint256).max);

        _renounceOwnership();
    }

    // --- Getters for public variables. Required by IPool interface ---

    /*
    * Returns the ETHBalance state variable.
    *
    * Not necessarily equal to the the contract's raw ETH balance - ether can be forcibly sent to contracts.
    */
    function getETHBalance() external view override returns (uint256) {
        return ETHBalance;
    }

    function getBoldDebt() external view override returns (uint256) {
        return BoldDebt;
    }

    // --- Pool functionality ---

    function sendETHToActivePool(uint256 _amount) external override {
        _requireCallerIsTroveManager();
        address activePool = activePoolAddress; // cache to save an SLOAD
        uint256 newETHBalance = ETHBalance - _amount;
        ETHBalance = newETHBalance;
        emit DefaultPoolETHBalanceUpdated(newETHBalance);
        emit EtherSent(activePool, _amount);

        // Send ETH to Active Pool and increase its recorded ETH balance
        IActivePool(activePool).receiveETH(_amount);
    }

    function receiveETH(uint256 _amount) external {
        _requireCallerIsActivePool();

        uint256 newETHBalance = ETHBalance + _amount;
        ETHBalance = newETHBalance;

        // Pull ETH tokens from ActivePool
        ETH.safeTransferFrom(msg.sender, address(this), _amount);

        emit DefaultPoolETHBalanceUpdated(newETHBalance);
    }

    function increaseBoldDebt(uint256 _amount) external override {
        _requireCallerIsTroveManager();
        BoldDebt = BoldDebt + _amount;
        emit DefaultPoolBoldDebtUpdated(BoldDebt);
    }

    function decreaseBoldDebt(uint256 _amount) external override {
        _requireCallerIsTroveManager();
        BoldDebt = BoldDebt - _amount;
        emit DefaultPoolBoldDebtUpdated(BoldDebt);
    }

    // --- 'require' functions ---

    function _requireCallerIsActivePool() internal view {
        require(msg.sender == activePoolAddress, "DefaultPool: Caller is not the ActivePool");
    }

    function _requireCallerIsTroveManager() internal view {
        require(msg.sender == troveManagerAddress, "DefaultPool: Caller is not the TroveManager");
    }
}
