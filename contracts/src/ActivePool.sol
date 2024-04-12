// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

import "./Interfaces/IActivePool.sol";
import "./Interfaces/IBoldToken.sol";
import "./Interfaces/IInterestRouter.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/CheckContract.sol";
import "./Interfaces/IDefaultPool.sol";
import "./Interfaces/IActivePool.sol";

//import "forge-std/console2.sol";

/*
 * The Active Pool holds the ETH collateral and Bold debt (but not Bold tokens) for all active troves.
 *
 * When a trove is liquidated, it's ETH and Bold debt are transferred from the Active Pool, to either the
 * Stability Pool, the Default Pool, or both, depending on the liquidation conditions.
 *
 */
contract ActivePool is Ownable, CheckContract, IActivePool {
    using SafeERC20 for IERC20;

    string public constant NAME = "ActivePool";

    IERC20 public immutable ETH;
    address public borrowerOperationsAddress;
    address public troveManagerAddress;
    address public stabilityPoolAddress;
    address public defaultPoolAddress;

    IBoldToken boldToken;

    IInterestRouter public interestRouter;

    uint256 public constant SECONDS_IN_ONE_YEAR = 31536000; // 60 * 60 * 24 * 365,

    uint256 internal ETHBalance; // deposited ether tracker

    // Sum of individual recorded Trove debts. Updated only at individual Trove operations.
    // "G" in the spec.
    uint256 internal recordedDebtSum;

    // Aggregate recorded debt tracker. Updated whenever a Trove's debt is touched AND whenever the aggregate pending interest is minted.
    // "D" in the spec.
    uint256 public aggRecordedDebt;

    /* Sum of individual recorded Trove debts weighted by their respective chosen interest rates.
    * Updated at individual Trove operations.
    * "S" in the spec.
    */
    uint256 public aggWeightedDebtSum;

    // Last time at which the aggregate recorded debt and weighted sum were updated
    uint256 public lastAggUpdateTime;

    // --- Events ---

    event DefaultPoolAddressChanged(address _newDefaultPoolAddress);
    event StabilityPoolAddressChanged(address _newStabilityPoolAddress);
    event EtherSent(address _to, uint256 _amount);
    event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);
    event TroveManagerAddressChanged(address _newTroveManagerAddress);
    event ActivePoolBoldDebtUpdated(uint256 _recordedDebtSum);
    event ActivePoolETHBalanceUpdated(uint256 _ETHBalance);

    constructor(address _ETHAddress) {
        checkContract(_ETHAddress);
        ETH = IERC20(_ETHAddress);
    }

    // --- Contract setters ---

    function setAddresses(
        address _borrowerOperationsAddress,
        address _troveManagerAddress,
        address _stabilityPoolAddress,
        address _defaultPoolAddress,
        address _boldTokenAddress,
        address _interestRouterAddress
    ) external onlyOwner {
        checkContract(_borrowerOperationsAddress);
        checkContract(_troveManagerAddress);
        checkContract(_stabilityPoolAddress);
        checkContract(_defaultPoolAddress);
        checkContract(_boldTokenAddress);
        checkContract(_interestRouterAddress);

        borrowerOperationsAddress = _borrowerOperationsAddress;
        troveManagerAddress = _troveManagerAddress;
        stabilityPoolAddress = _stabilityPoolAddress;
        defaultPoolAddress = _defaultPoolAddress;
        boldToken = IBoldToken(_boldTokenAddress);
        interestRouter = IInterestRouter(_interestRouterAddress);

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
    function getETHBalance() external view override returns (uint256) {
        return ETHBalance;
    }

    function getRecordedDebtSum() external view override returns (uint256) {
        return recordedDebtSum;
    }

    function calcPendingAggInterest() public view returns (uint256) {
        return aggWeightedDebtSum * (block.timestamp - lastAggUpdateTime) / SECONDS_IN_ONE_YEAR / 1e18;
    }

    // Returns sum of agg.recorded debt plus agg. pending interest. Excludes pending redist. gains.
    function getTotalActiveDebt() public view returns (uint256) {
        return aggRecordedDebt + calcPendingAggInterest();
    }

    // --- Pool functionality ---

    function sendETH(address _account, uint256 _amount) external override {
        _requireCallerIsBOorTroveMorSP();

        _accountForSendETH(_account, _amount);

        ETH.safeTransfer(_account, _amount);
    }

    function sendETHToDefaultPool(uint256 _amount) external override {
        _requireCallerIsTroveManager();

        address defaultPoolAddressCached = defaultPoolAddress;
        _accountForSendETH(defaultPoolAddressCached, _amount);

        IDefaultPool(defaultPoolAddressCached).receiveETH(_amount);
    }

    function _accountForSendETH(address _account, uint256 _amount) internal {
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

    function increaseRecordedDebtSum(uint256 _amount) external {
        _requireCallerIsTroveManager();
        _changeRecordedDebtSum(_amount, 0);
    }

    // TODO: remove this once we implement interest minting in redemptions
    function decreaseRecordedDebtSum(uint256 _amount) external {
        _requireCallerIsTroveManager();
        _changeRecordedDebtSum(0, _amount);
    }

    function _changeRecordedDebtSum(uint256 _recordedDebtIncrease, uint256 _recordedDebtDecrease) internal {
        // Do the arithmetic in 2 steps here to avoid overflow from the decrease
        uint256 newRecordedDebtSum = recordedDebtSum + _recordedDebtIncrease; // 1 SLOAD
        newRecordedDebtSum -= _recordedDebtDecrease;
        recordedDebtSum = newRecordedDebtSum; // 1 SSTORE
        emit ActivePoolBoldDebtUpdated(newRecordedDebtSum);
    }

    function _changeAggWeightedDebtSum(
        uint256 _newTroveWeightedRecordedTroveDebt,
        uint256 _oldWeightedRecordedTroveDebt
    ) internal {
        // Do the arithmetic in 2 steps here to avoid overflow from the decrease
        uint256 newAggWeightedDebtSum = aggWeightedDebtSum + _newTroveWeightedRecordedTroveDebt; // 1 SLOAD
        newAggWeightedDebtSum -= _oldWeightedRecordedTroveDebt;
        aggWeightedDebtSum = newAggWeightedDebtSum; // 1 SSTORE
    }

    // --- Aggregate interest operations ---

    // This function is called inside all state-changing user ops: borrower ops, liquidations, redemptions and SP deposits/withdrawals.
    // Some user ops trigger debt changes to Trove(s), in which case _troveDebtChange will be non-zero.
    // The aggregate recorded debt is incremented by the aggregate pending interest, plus the net Trove debt change.
    // The net Trove debt change consists of the sum of a) any debt issued/repaid and b) any redistribution debt gain applied in the encapsulating operation.
    // It does *not* include the Trove's individual accrued interest - this gets accounted for in the aggregate accrued interest.
    // The net Trove debt change could be positive or negative in a repayment (depending on whether its redistribution gain or repayment amount is larger),
    // so this function accepts both the increase and the decrease to avoid using (and converting to/from) signed ints.
    function mintAggInterest(
        uint256 _troveDebtIncrease,
        uint256 _troveDebtDecrease,
        uint256 recordedSumIncrease,
        uint256 recordedSumDecrease,
        uint256 newWeightedRecordedTroveDebt,
        uint256 oldWeightedRecordedTroveDebt
    ) external {
        _requireCallerIsBOorTroveM();

        // Do the arithmetic in 2 steps here to avoid overflow from the decrease
        uint256 newAggRecordedDebt = _mintAggInterestNoTroveChange() + _troveDebtIncrease; // 1 SLOAD
        newAggRecordedDebt -= _troveDebtDecrease;
        aggRecordedDebt = newAggRecordedDebt; // 1 SSTORE
        // assert(aggRecordedDebt >= 0) // This should never be negative. If all redistribution gians and all aggregate interest was applied
        // and all Trove debts were repaid, it should become 0.

        _changeRecordedDebtSum(recordedSumIncrease, recordedSumDecrease);
        _changeAggWeightedDebtSum(newWeightedRecordedTroveDebt, oldWeightedRecordedTroveDebt);
    }

    function mintAggInterestNoTroveChange() external returns (uint256) {
        _requireCallerIsSP();
        aggRecordedDebt = _mintAggInterestNoTroveChange();
    }

    function _mintAggInterestNoTroveChange() internal returns (uint256) {
        uint256 aggInterest = calcPendingAggInterest();
        // Mint the new BOLD interest to a mock interest router that would split it and send it onward to SP, LP staking, etc.
        // TODO: implement interest routing and SP Bold reward tracking
        if (aggInterest > 0) boldToken.mint(address(interestRouter), aggInterest);

        lastAggUpdateTime = block.timestamp;
        return aggRecordedDebt + aggInterest;
    }

    // --- 'require' functions ---

    function _requireCallerIsBorrowerOperationsOrDefaultPool() internal view {
        require(
            msg.sender == borrowerOperationsAddress || msg.sender == defaultPoolAddress,
            "ActivePool: Caller is neither BO nor Default Pool"
        );
    }

    function _requireCallerIsBOorTroveMorSP() internal view {
        require(
            msg.sender == borrowerOperationsAddress || msg.sender == troveManagerAddress
                || msg.sender == stabilityPoolAddress,
            "ActivePool: Caller is neither BorrowerOperations nor TroveManager nor StabilityPool"
        );
    }

    function _requireCallerIsSP() internal view {
        require(msg.sender == stabilityPoolAddress, "ActivePool: Caller is not StabilityPool");
    }

    function _requireCallerIsBOorTroveM() internal view {
        require(
            msg.sender == borrowerOperationsAddress || msg.sender == troveManagerAddress,
            "ActivePool: Caller is neither BorrowerOperations nor TroveManager"
        );
    }

    function _requireCallerIsTroveManager() internal view {
        require(msg.sender == troveManagerAddress, "ActivePool: Caller is not TroveManager");
    }
}
