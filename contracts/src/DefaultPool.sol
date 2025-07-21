// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

import "./Interfaces/IDefaultPool.sol";
import "./Interfaces/IAddressesRegistry.sol";
import "./Interfaces/IActivePool.sol";

/*
 * The Default Pool holds the Coll and Bold debt (but not Bold tokens) from liquidations that have been redistributed
 * to active troves but not yet "applied", i.e. not yet recorded on a recipient active trove's struct.
 *
 * When a trove makes an operation that applies its pending Coll and Bold debt, its pending Coll and Bold debt is moved
 * from the Default Pool to the Active Pool.
 */
contract DefaultPool is IDefaultPool {
    using SafeERC20 for IERC20;

    string public constant NAME = "DefaultPool";

    IERC20 public immutable collToken;
    address public immutable troveManagerAddress;
    address public immutable activePoolAddress;
    uint256 internal collBalance; // deposited Coll tracker
    uint256 internal BoldDebt; // debt

    event CollTokenAddressChanged(address _newCollTokenAddress);
    event ActivePoolAddressChanged(address _newActivePoolAddress);
    event TroveManagerAddressChanged(address _newTroveManagerAddress);
    event DefaultPoolBoldDebtUpdated(uint256 _boldDebt);
    event DefaultPoolCollBalanceUpdated(uint256 _collBalance);

    constructor(IAddressesRegistry _addressesRegistry) {
        collToken = _addressesRegistry.collToken();
        troveManagerAddress = address(_addressesRegistry.troveManager());
        activePoolAddress = address(_addressesRegistry.activePool());

        emit CollTokenAddressChanged(address(collToken));
        emit TroveManagerAddressChanged(troveManagerAddress);
        emit ActivePoolAddressChanged(activePoolAddress);

        // Allow funds movements between Liquity contracts
        collToken.approve(activePoolAddress, type(uint256).max);
    }

    // --- Getters for public variables. Required by IPool interface ---

    /*
    * Returns the collBalance state variable.
    *
    * Not necessarily equal to the contract's raw Coll balance - ether can be forcibly sent to contracts.
    */
    function getCollBalance() external view override returns (uint256) {
        return collBalance;
    }

    function getBoldDebt() external view override returns (uint256) {
        return BoldDebt;
    }

    // --- Pool functionality ---

    function sendCollToActivePool(uint256 _amount) external override {
        _requireCallerIsTroveManager();
        uint256 newCollBalance = collBalance - _amount;
        collBalance = newCollBalance;
        emit DefaultPoolCollBalanceUpdated(newCollBalance);

        // Send Coll to Active Pool and increase its recorded Coll balance
        IActivePool(activePoolAddress).receiveColl(_amount);
    }

    function receiveColl(uint256 _amount) external {
        _requireCallerIsActivePool();

        uint256 newCollBalance = collBalance + _amount;
        collBalance = newCollBalance;

        // Pull Coll tokens from ActivePool
        collToken.safeTransferFrom(msg.sender, address(this), _amount);

        emit DefaultPoolCollBalanceUpdated(newCollBalance);
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
