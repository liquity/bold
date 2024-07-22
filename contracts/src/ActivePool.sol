// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import "openzeppelin-contracts/contracts/utils/math/Math.sol";

import "./Dependencies/Constants.sol";
import "./Interfaces/IActivePool.sol";
import "./Interfaces/IBoldToken.sol";
import "./Interfaces/IInterestRouter.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/CheckContract.sol";
import "./Interfaces/IDefaultPool.sol";

// import "forge-std/console2.sol";

/*
 * The Active Pool holds the collateral and Bold debt (but not Bold tokens) for all active troves.
 *
 * When a trove is liquidated, it's Coll and Bold debt are transferred from the Active Pool, to either the
 * Stability Pool, the Default Pool, or both, depending on the liquidation conditions.
 *
 */
contract ActivePool is Ownable, CheckContract, IActivePool {
    using SafeERC20 for IERC20;

    string public constant NAME = "ActivePool";

    IERC20 public immutable collToken;
    address public borrowerOperationsAddress;
    address public troveManagerAddress;
    address public defaultPoolAddress;

    IBoldToken boldToken;

    IInterestRouter public interestRouter;
    IBoldRewardsReceiver public stabilityPool;

    uint256 internal collBalance; // deposited ether tracker

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

    bool public hasBeenShutDown;

    // --- Events ---

    event DefaultPoolAddressChanged(address _newDefaultPoolAddress);
    event StabilityPoolAddressChanged(address _newStabilityPoolAddress);
    event EtherSent(address _to, uint256 _amount);
    event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);
    event TroveManagerAddressChanged(address _newTroveManagerAddress);
    event ActivePoolBoldDebtUpdated(uint256 _recordedDebtSum);
    event ActivePoolCollBalanceUpdated(uint256 _collBalance);

    constructor(address _collAddress) {
        collToken = IERC20(_collAddress);
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
        defaultPoolAddress = _defaultPoolAddress;
        boldToken = IBoldToken(_boldTokenAddress);
        interestRouter = IInterestRouter(_interestRouterAddress);
        stabilityPool = IBoldRewardsReceiver(_stabilityPoolAddress);

        emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);
        emit TroveManagerAddressChanged(_troveManagerAddress);
        emit StabilityPoolAddressChanged(_stabilityPoolAddress);
        emit DefaultPoolAddressChanged(_defaultPoolAddress);

        // Allow funds movements between Liquity contracts
        collToken.approve(_defaultPoolAddress, type(uint256).max);

        _renounceOwnership();
    }

    // --- Getters for public variables. Required by IPool interface ---

    /*
    * Returns the Coll state variable.
    *
    *Not necessarily equal to the the contract's raw Coll balance - ether can be forcibly sent to contracts.
    */
    function getCollBalance() external view override returns (uint256) {
        return collBalance;
    }

    function calcPendingAggInterest() public view returns (uint256) {
        if (hasBeenShutDown) return 0;

        // We use the ceiling of the division here to ensure positive error, while we use regular floor division
        // when calculating the interest accrued by individual Troves.
        // This ensures that `system debt >= sum(trove debt)` always holds, and thus system debt won't turn negative
        // even if all Trove debt is repaid. The difference should be small and it should scale with the number of
        // interest minting events.
        return Math.ceilDiv(aggWeightedDebtSum * (block.timestamp - lastAggUpdateTime), ONE_YEAR * DECIMAL_PRECISION);
    }

    function calcPendingSPYield() external view returns (uint256) {
        return calcPendingAggInterest() * SP_YIELD_SPLIT / DECIMAL_PRECISION;
    }

    function getNewApproxAvgInterestRateFromTroveChange(TroveChange calldata _troveChange)
        external
        view
        returns (uint256)
    {
        // We are ignoring the upfront fee when calculating the approx. avg. interest rate.
        // This is a simple way to resolve the circularity in:
        //   fee depends on avg. interest rate -> avg. interest rate is weighted by debt -> debt includes fee -> ...
        assert(_troveChange.upfrontFee == 0);

        if (hasBeenShutDown) return 0;

        uint256 newAggRecordedDebt = aggRecordedDebt;
        newAggRecordedDebt += calcPendingAggInterest();
        newAggRecordedDebt += _troveChange.appliedRedistBoldDebtGain;
        newAggRecordedDebt += _troveChange.debtIncrease;
        newAggRecordedDebt -= _troveChange.debtDecrease;

        uint256 newAggWeightedDebtSum = aggWeightedDebtSum;
        newAggWeightedDebtSum += _troveChange.newWeightedRecordedDebt;
        newAggWeightedDebtSum -= _troveChange.oldWeightedRecordedDebt;

        // Avoid division by 0 if the first ever borrower tries to borrow 0 BOLD
        // Borrowing 0 BOLD is not allowed, but our check of debt >= MIN_DEBT happens _after_ calculating the upfront
        // fee, which involves getting the new approx. avg. interest rate
        return newAggRecordedDebt > 0 ? newAggWeightedDebtSum / newAggRecordedDebt : 0;
    }

    // Returns sum of agg.recorded debt plus agg. pending interest. Excludes pending redist. gains.
    function getBoldDebt() external view returns (uint256) {
        return aggRecordedDebt + calcPendingAggInterest();
    }

    // --- Pool functionality ---

    function sendColl(address _account, uint256 _amount) external override {
        _requireCallerIsBOorTroveMorSP();

        _accountForSendColl(_account, _amount);

        collToken.safeTransfer(_account, _amount);
    }

    function sendCollToDefaultPool(uint256 _amount) external override {
        _requireCallerIsTroveManager();

        address defaultPoolAddressCached = defaultPoolAddress;
        _accountForSendColl(defaultPoolAddressCached, _amount);

        IDefaultPool(defaultPoolAddressCached).receiveColl(_amount);
    }

    function _accountForSendColl(address _account, uint256 _amount) internal {
        uint256 newCollBalance = collBalance - _amount;
        collBalance = newCollBalance;
        emit ActivePoolCollBalanceUpdated(newCollBalance);
        emit EtherSent(_account, _amount);
    }

    function receiveColl(uint256 _amount) external {
        _requireCallerIsBorrowerOperationsOrDefaultPool();

        _accountForReceivedColl(_amount);

        // Pull Coll tokens from sender
        collToken.safeTransferFrom(msg.sender, address(this), _amount);
    }

    function accountForReceivedColl(uint256 _amount) public {
        _requireCallerIsBorrowerOperationsOrDefaultPool();

        _accountForReceivedColl(_amount);
    }

    function _accountForReceivedColl(uint256 _amount) internal {
        uint256 newCollBalance = collBalance + _amount;
        collBalance = newCollBalance;

        emit ActivePoolCollBalanceUpdated(newCollBalance);
    }

    // --- Aggregate interest operations ---

    // This function is called inside all state-changing user ops: borrower ops, liquidations, redemptions and SP deposits/withdrawals.
    // Some user ops trigger debt changes to Trove(s), in which case _troveDebtChange will be non-zero.
    // The aggregate recorded debt is incremented by the aggregate pending interest, plus the net Trove debt change.
    // The net Trove debt change consists of the sum of a) any debt issued/repaid and b) any redistribution debt gain applied in the encapsulating operation.
    // It does *not* include the Trove's individual accrued interest - this gets accounted for in the aggregate accrued interest.
    // The net Trove debt change could be positive or negative in a repayment (depending on whether its redistribution gain or repayment amount is larger),
    // so this function accepts both the increase and the decrease to avoid using (and converting to/from) signed ints.
    function mintAggInterestAndAccountForTroveChange(TroveChange calldata _troveChange) external {
        _requireCallerIsBOorTroveM();

        // Do the arithmetic in 2 steps here to avoid overflow from the decrease
        uint256 newAggRecordedDebt = aggRecordedDebt; // 1 SLOAD
        newAggRecordedDebt += _mintAggInterest(_troveChange.upfrontFee); // adds minted agg. interest + upfront fee
        newAggRecordedDebt += _troveChange.appliedRedistBoldDebtGain;
        newAggRecordedDebt += _troveChange.debtIncrease;
        newAggRecordedDebt -= _troveChange.debtDecrease;
        aggRecordedDebt = newAggRecordedDebt; // 1 SSTORE

        // assert(aggRecordedDebt >= 0) // This should never be negative. If all redistribution gians and all aggregate interest was applied
        // and all Trove debts were repaid, it should become 0.

        // Do the arithmetic in 2 steps here to avoid overflow from the decrease
        uint256 newAggWeightedDebtSum = aggWeightedDebtSum; // 1 SLOAD
        newAggWeightedDebtSum += _troveChange.newWeightedRecordedDebt;
        newAggWeightedDebtSum -= _troveChange.oldWeightedRecordedDebt;
        aggWeightedDebtSum = newAggWeightedDebtSum; // 1 SSTORE
    }

    function mintAggInterest() external override {
        _requireCallerIsBOorSP();
        aggRecordedDebt += _mintAggInterest(0);
    }

    function _mintAggInterest(uint256 _upfrontFee) internal returns (uint256 mintedAmount) {
        mintedAmount = calcPendingAggInterest() + _upfrontFee;

        // Mint part of the BOLD interest to the SP and part to the router for LPs.
        if (mintedAmount > 0) {
            uint256 spYield = SP_YIELD_SPLIT * mintedAmount / DECIMAL_PRECISION;
            uint256 remainderToLPs = mintedAmount - spYield;

            boldToken.mint(address(interestRouter), remainderToLPs);
            boldToken.mint(address(stabilityPool), spYield);

            stabilityPool.triggerBoldRewards(spYield);
        }

        lastAggUpdateTime = block.timestamp;
    }

    // --- Shutdown ---

    function setShutdownFlag() external {
        _requireCallerIsTroveManager();
        hasBeenShutDown = true;
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
                || msg.sender == address(stabilityPool),
            "ActivePool: Caller is neither BorrowerOperations nor TroveManager nor StabilityPool"
        );
    }

    function _requireCallerIsBOorSP() internal view {
        require(
            msg.sender == borrowerOperationsAddress || msg.sender == address(stabilityPool),
            "ActivePool: Caller is not BorrowerOperations nor StabilityPool"
        );
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
