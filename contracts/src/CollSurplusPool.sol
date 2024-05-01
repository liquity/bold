// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

import "./Interfaces/ICollSurplusPool.sol";
import "./Dependencies/Ownable.sol";

contract CollSurplusPool is Ownable, ICollSurplusPool {
    using SafeERC20 for IERC20;

    string public constant NAME = "CollSurplusPool";

    IERC20 public immutable ETH;
    address public borrowerOperationsAddress;
    address public troveManagerAddress;
    address public activePoolAddress;

    // deposited ether tracker
    uint256 internal ETHBalance;
    // Collateral surplus claimable by trove owners
    mapping(uint256 => uint256) internal balances;

    // --- Events ---

    event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);
    event TroveManagerAddressChanged(address _newTroveManagerAddress);
    event ActivePoolAddressChanged(address _newActivePoolAddress);

    event CollBalanceUpdated(uint256 indexed _troveId, uint256 _newBalance);
    event EtherSent(address _to, uint256 _amount);

    constructor(address _ETHAddress) {
        ETH = IERC20(_ETHAddress);
    }

    // --- Contract setters ---

    function setAddresses(address _borrowerOperationsAddress, address _troveManagerAddress, address _activePoolAddress)
        external
        override
        onlyOwner
    {
        borrowerOperationsAddress = _borrowerOperationsAddress;
        troveManagerAddress = _troveManagerAddress;
        activePoolAddress = _activePoolAddress;

        emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);
        emit TroveManagerAddressChanged(_troveManagerAddress);
        emit ActivePoolAddressChanged(_activePoolAddress);

        _renounceOwnership();
    }

    /* Returns the ETHBalance state variable
       Not necessarily equal to the raw ether balance - ether can be forcibly sent to contracts. */
    function getETHBalance() external view override returns (uint256) {
        return ETHBalance;
    }

    function getCollateral(uint256 _troveId) external view override returns (uint256) {
        return balances[_troveId];
    }

    // --- Pool functionality ---

    function accountSurplus(uint256 _troveId, uint256 _amount) external override {
        _requireCallerIsTroveManager();

        uint256 newAmount = balances[_troveId] + _amount;
        balances[_troveId] = newAmount;
        ETHBalance = ETHBalance + _amount;

        emit CollBalanceUpdated(_troveId, newAmount);
    }

    function claimColl(address _account, uint256 _troveId) external override {
        _requireCallerIsBorrowerOperations();
        uint256 claimableColl = balances[_troveId];
        require(claimableColl > 0, "CollSurplusPool: No collateral available to claim");

        balances[_troveId] = 0;
        emit CollBalanceUpdated(_troveId, 0);

        ETHBalance = ETHBalance - claimableColl;
        emit EtherSent(_account, claimableColl);

        ETH.safeTransfer(_account, claimableColl);
    }

    // --- 'require' functions ---

    function _requireCallerIsBorrowerOperations() internal view {
        require(msg.sender == borrowerOperationsAddress, "CollSurplusPool: Caller is not Borrower Operations");
    }

    function _requireCallerIsTroveManager() internal view {
        require(msg.sender == troveManagerAddress, "CollSurplusPool: Caller is not TroveManager");
    }

    function _requireCallerIsActivePool() internal view {
        require(msg.sender == activePoolAddress, "CollSurplusPool: Caller is not Active Pool");
    }
}
