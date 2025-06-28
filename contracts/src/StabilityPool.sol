// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

import "./Interfaces/IStabilityPool.sol";
import "./Interfaces/IAddressesRegistry.sol";
import "./Interfaces/IStabilityPoolEvents.sol";
import "./Interfaces/ITroveManager.sol";
import "./Interfaces/IBoldToken.sol";
import "./Dependencies/LiquityBase.sol";
import "openzeppelin-contracts/contracts/access/Ownable.sol";
import "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "./Interfaces/IDEXRouter.sol";

/*
 * The Stability Pool holds Bold tokens deposited by Stability Pool depositors.
 *
 * When a trove is liquidated, then depending on system conditions, some of its Bold debt gets offset with
 * Bold in the Stability Pool:  that is, the offset debt evaporates, and an equal amount of Bold tokens in the Stability Pool is burned.
 *
 * Thus, a liquidation causes each depositor to receive a Bold loss, in proportion to their deposit as a share of total deposits.
 * They also receive an Coll gain, as the collateral of the liquidated trove is distributed among Stability depositors,
 * in the same proportion.
 *
 * When a liquidation occurs, it depletes every deposit by the same fraction: for example, a liquidation that depletes 40%
 * of the total Bold in the Stability Pool, depletes 40% of each deposit.
 *
 * A deposit that has experienced a series of liquidations is termed a "compounded deposit": each liquidation depletes the deposit,
 * multiplying it by some factor in range ]0,1[
 *
 *
 * --- IMPLEMENTATION ---
 *
 * We use a highly scalable method of tracking deposits and Coll gains that has O(1) complexity.
 *
 * When a liquidation occurs, rather than updating each depositor's deposit and Coll gain, we simply update two state variables:
 * a product P, and a sum S.
 *
 * A mathematical manipulation allows us to factor out the initial deposit, and accurately track all depositors' compounded deposits
 * and accumulated Coll gains over time, as liquidations occur, using just these two variables P and S. When depositors join the
 * Stability Pool, they get a snapshot of the latest P and S: P_t and S_t, respectively.
 *
 * The formula for a depositor's accumulated Coll gain is derived here:
 * https://github.com/liquity/dev/blob/main/papers/Scalable_Reward_Distribution_with_Compounding_Stakes.pdf
 *
 * For a given deposit d_t, the ratio P/P_t tells us the factor by which a deposit has decreased since it joined the Stability Pool,
 * and the term d_t * (S - S_t)/P_t gives us the deposit's total accumulated Coll gain.
 *
 * Each liquidation updates the product P and sum S. After a series of liquidations, a compounded deposit and corresponding Coll gain
 * can be calculated using the initial deposit, the depositor’s snapshots of P and S, and the latest values of P and S.
 *
 * Any time a depositor updates their deposit (withdrawal, top-up) their accumulated Coll gain is paid out, their new deposit is recorded
 * (based on their latest compounded deposit and modified by the withdrawal/top-up), and they receive new snapshots of the latest P and S.
 * Essentially, they make a fresh deposit that overwrites the old one.
 *
 *
 * --- SCALE FACTOR ---
 *
 * Since P is a running product in range ]0,1] that is always-decreasing, it should never reach 0 when multiplied by a number in range ]0,1[.
 * Unfortunately, Solidity floor division always reaches 0, sooner or later.
 *
 * A series of liquidations that nearly empty the Pool (and thus each multiply P by a very small number in range ]0,1[ ) may push P
 * to its 36 digit decimal limit, and round it to 0, when in fact the Pool hasn't been emptied: this would break deposit tracking.
 * 
 * P is stored at 36-digit precision as a uint. That is, a value of "1" is represented by a value of 1e36 in the code.
 *
 * So, to track P accurately, we use a scale factor: if a liquidation would cause P to decrease below 1e27,
 * we first multiply P by 1e9, and increment a currentScale factor by 1.
 *
 * The added benefit of using 1e9 for the scale factor that it ensures negligible precision loss close to the
 * scale boundary: when P is at its minimum value of 1e27, the relative precision loss in P due to floor division is only on the
 * order of 1e-27.
 *
 * --- MIN BOLD IN SP ---
 *
 * Once totalBoldDeposits has become >= MIN_BOLD_IN_SP, a liquidation may never fully empty the Pool - a minimum of 1 BOLD remains in the SP at all times thereafter.
 * This is enforced for liquidations in TroveManager.batchLiquidateTroves, and for withdrawals in StabilityPool.withdrawFromSP.
 * As such, it is impossible to empty the Stability Pool via liquidations, and P can never become 0.
 *
 * --- TRACKING DEPOSIT OVER SCALE CHANGES ---
 *
 * When a deposit is made, it gets a snapshot of the currentScale.
 *
 * When calculating a compounded deposit, we compare the current scale to the deposit's scale snapshot. If they're equal, the compounded deposit is given by d_t * P/P_t.
 * If it spans one scale change, it is given by d_t * P/(P_t * 1e9).
 *
 *  --- TRACKING DEPOSITOR'S COLL GAIN OVER SCALE CHANGES  ---
 *
 * We calculate the depositor's accumulated Coll gain for the scale at which they made the deposit, using the Coll gain formula:
 * e_1 = d_t * (S - S_t) / P_t
 *
 * and also for the scale after, taking care to divide the latter by a factor of 1e9:
 * e_2 = d_t * S / (P_t * 1e9)
 *
 * The gain in the second scale will be full, as the starting point was in the previous scale, thus no need to subtract anything.
 * The deposit therefore was present for reward events from the beginning of that second scale.
 *
 *        S_i-S_t + S_{i+1}
 *      .<--------.------------>
 *      .         .
 *      . S_i     .   S_{i+1}
 *   <--.-------->.<----------->
 *   S_t.         .
 *   <->.         .
 *      t         .
 *  |---+---------|-------------|-----...
 *         i            i+1
 *
 * The sum of (e_1 + e_2) captures the depositor's total accumulated Coll gain, handling the case where their
 * deposit spanned one scale change.
 *
 * --- UPDATING P WHEN A LIQUIDATION OCCURS ---
 *
 * Please see the implementation spec in the proof document, which closely follows on from the compounded deposit / Coll gain derivations:
 * https://github.com/liquity/liquity/blob/master/papers/Scalable_Reward_Distribution_with_Compounding_Stakes.pdf
 *
 *
 */
contract StabilityPool is LiquityBase, IStabilityPool, IStabilityPoolEvents, Ownable {
    using SafeERC20 for IERC20;

    string public constant NAME = "StabilityPool";

    // collToken is inherited from LiquityBase via AddressesRegistry if needed by activePool.sendColl
    // It's the memecoin for this specific pool.
    // IBoldToken public immutable boldToken; // The global StableMToken, inherited from LiquityBase via AR

    uint256 internal collBalance; // Tracks liquidated memecoin collateral held by this contract
    uint256 internal totalBoldDeposits; // Tracks the $StableM balance held by this contract for burning bad debt

    // Swap Configuration
    address public dexRouter;
    address public targetStablecoin; // e.g., USDC address to swap memecoin into
    address public collateralRecipient; // Address to send the swapped stablecoins to (e.g., DAO Treasury)

    // Events to keep (or ensure they are in IStabilityPoolEvents)
    // event StabilityPoolBoldBalanceUpdated(uint256 _newBalance); // This is in IStabilityPoolEvents
    // event StabilityPoolCollBalanceUpdated(uint256 _newBalance); // This is in IStabilityPoolEvents
    // event TroveManagerAddressChanged(address _newTroveManagerAddress); (From constructor if needed, or implicit via registry)
    // event BoldTokenAddressChanged(address _newBoldTokenAddress); (From constructor if needed, or implicit via registry)
    // Other events related to new functionality (like collateral swaps) will be added later.
    event SwapConfigurationUpdated(
        address dexRouter,
        address targetStablecoin,
        address collateralRecipient
    );
    event CollateralSwapped(
        address indexed fromToken,
        address indexed toToken,
        uint256 amountSwapped,
        uint256 amountReceived,
        address recipient
    );

    constructor(IAddressesRegistry _addressesRegistry) LiquityBase(_addressesRegistry) Ownable(msg.sender) {
        // collToken, troveManager, boldToken are available via addressesRegistry passed to LiquityBase
        // No explicit initialization of P needed anymore.
        // No explicit TroveManagerAddressChanged or BoldTokenAddressChanged events needed here if not overriding.
    }

    // --- Getters ---
    function getCollBalance() external view override returns (uint256) {
        return collBalance;
    }

    function getTotalBoldDeposits() external view override returns (uint256) {
        // This now refers to the $StableM balance of this contract available for burning
        return totalBoldDeposits;
    }

    // --- Liquidation Handling ---
    function offset(uint256 _debtToOffset, uint256 _collToAdd) external override {
        _requireCallerIsTroveManager(); // Ensure this check exists or add it

        // No more P and S updates here
        _moveOffsetCollAndDebt(_collToAdd, _debtToOffset);
    }

    function _moveOffsetCollAndDebt(uint256 _collToAdd, uint256 _debtToOffset) internal {
        IBoldToken currentBoldToken = addressesRegistry.boldToken(); // Get from registry

        if (_debtToOffset > totalBoldDeposits) {
            // This case should ideally not happen if the pool is properly funded.
            // Or, it means only a partial offset is possible.
            // For now, assume totalBoldDeposits is sufficient.
            // Revert or handle partial burn if necessary.
            revert("SP: Insufficient $StableM to offset debt"); // Consider specific error code
        }

        _updateTotalBoldDeposits(0, _debtToOffset); // Decrease internal $StableM tracking

        currentBoldToken.burn(address(this), _debtToOffset); // Burn $StableM from this contract

        uint256 newCollBalance = collBalance + _collToAdd;
        collBalance = newCollBalance;

        activePool.sendColl(address(this), _collToAdd); // Receive memecoin collateral

        emit StabilityPoolCollBalanceUpdated(newCollBalance);
    }

    // --- Funding and Management (New) ---
    // Allows DAO/protocol to fund the pool with $StableM for debt offsetting
    function fundPool(uint256 _amount) external onlyOwner {
        IBoldToken currentBoldToken = addressesRegistry.boldToken();
        currentBoldToken.transferFrom(msg.sender, address(this), _amount);
        _updateTotalBoldDeposits(_amount, 0);
    }

    function setSwapConfiguration(
        address _dexRouter,
        address _targetStablecoin,
        address _collateralRecipient
    ) external onlyOwner {
        require(_dexRouter != address(0), "SP: DEX router cannot be zero");
        require(_targetStablecoin != address(0), "SP: Target stablecoin cannot be zero");
        require(_collateralRecipient != address(0), "SP: Collateral recipient cannot be zero");

        dexRouter = _dexRouter;
        targetStablecoin = _targetStablecoin;
        collateralRecipient = _collateralRecipient;

        emit SwapConfigurationUpdated(_dexRouter, _targetStablecoin, _collateralRecipient);
    }

    // Placeholder for swapping and adding liquidity - to be implemented in a later sub-task
    // function swapAndAddLiquidity(address _memecoinAddress, uint256 _amountToSwap, address _dexRouter, address _targetLPPool) external { ... }

    function swapCollateral(
        uint256 _amountToSwap,
        uint256 _amountOutMin // Minimum amount of targetStablecoin to receive
    ) external onlyOwner { // Or a new dedicated role
        require(dexRouter != address(0), "SP: DEX router not set");
        require(targetStablecoin != address(0), "SP: Target stablecoin not set");
        require(collateralRecipient != address(0), "SP: Collateral recipient not set");
        require(_amountToSwap > 0, "SP: Amount to swap must be positive");

        IERC20 currentCollToken = addressesRegistry.collToken();
        require(collBalance >= _amountToSwap, "SP: Insufficient collateral balance to swap");

        // Approve DEX router to spend the collateral
        IERC20(currentCollToken).approve(dexRouter, _amountToSwap);

        // Prepare path for the swap
        address[] memory path = new address[](2);
        path[0] = address(currentCollToken);
        path[1] = targetStablecoin;

        // Execute swap
        uint256 balanceBeforeSwap = IERC20(targetStablecoin).balanceOf(address(this));

        IDEXRouter(dexRouter).swapExactTokensForTokens(
            _amountToSwap,
            _amountOutMin,
            path,
            address(this), // Output tokens to this contract
            block.timestamp // Deadline (can be slightly in future)
        );

        uint256 amountReceived = IERC20(targetStablecoin).balanceOf(address(this)) - balanceBeforeSwap;
        require(amountReceived > 0, "SP: Swap resulted in no output tokens"); // Basic check

        // Update internal collateral balance
        collBalance -= _amountToSwap;

        // Transfer received stablecoins to the recipient
        IERC20(targetStablecoin).transfer(collateralRecipient, amountReceived);

        emit CollateralSwapped(
            address(currentCollToken),
            targetStablecoin,
            _amountToSwap,
            amountReceived,
            collateralRecipient
        );
        emit StabilityPoolCollBalanceUpdated(collBalance); // Update collateral balance event
    }

    // --- Internal $StableM Balance Tracking ---
    function _updateTotalBoldDeposits(uint256 _increase, uint256 _decrease) internal {
        uint256 oldTotalBoldDeposits = totalBoldDeposits;
        if (_decrease > oldTotalBoldDeposits) { // Should not happen if fundPool is used correctly before offset
            totalBoldDeposits = 0;
        } else {
            totalBoldDeposits = oldTotalBoldDeposits - _decrease;
        }
        totalBoldDeposits = totalBoldDeposits + _increase; // Add increase after potential decrease

        emit StabilityPoolBoldBalanceUpdated(totalBoldDeposits);
    }

    // --- 'require' functions (simplified) ---
    function _requireCallerIsTroveManager() internal view {
        // Assuming troveManager is accessible from AddressesRegistry (it is)
        require(msg.sender == address(addressesRegistry.troveManager()), "SP: Caller is not TroveManager");
    }

    // Removed _requireUserHasDeposit, _requireNonZeroAmount (if only used by removed functions)
    // Removed _requireCallerIsActivePool (if triggerBoldRewards is removed)
}
