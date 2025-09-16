// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import "./Interfaces/ITroveManager.sol";
import "./Interfaces/IBoldToken.sol";
import "./Dependencies/Constants.sol";
import "./Dependencies/LiquityMath.sol";

import "./Interfaces/ICollateralRegistry.sol";

contract CollateralRegistry is ICollateralRegistry {
    // See: https://github.com/ethereum/solidity/issues/12587
    // uint256 public totalCollaterals; // 10

    address public governor;

    uint256 public branches; // Total number of branches ever added. This value only increments up.

    mapping(uint256 branchId => IERC20Metadata collateralToken) public allCollateralTokenAddresses;
    
    mapping(uint256 branchId => ITroveManager troveManager) public allTroveManagerAddresses;

    mapping(uint256 branchId => bool isActive) public isActiveCollateral;

    uint256[] internal _activeBranchIds;

    uint256[] internal _removedBranchIds;

    // NOTE: 
    // Used to get the index of a branch in the removedBranchIds array
    // in a more gas efficient way than iterating through the array.
    mapping(uint256 branchId => uint256 indexInRemovedBranchIds) internal _removedBranchIdsIndex;

    IBoldToken public immutable boldToken;

    uint256 public baseRate;

    // The timestamp of the latest fee operation (redemption or new Bold issuance)
    uint256 public lastFeeOperationTime = block.timestamp;

    event BaseRateUpdated(uint256 _baseRate);
    event LastFeeOpTimeUpdated(uint256 _lastFeeOpTime);

    modifier onlyGovernor() {
        require(msg.sender == governor, "CollateralRegistry: Only governor can call this function");
        _;
    }

    constructor(IBoldToken _boldToken, IERC20Metadata[] memory _tokens, ITroveManager[] memory _troveManagers, address _governor) {
        uint256 numTokens = _tokens.length;
        require(numTokens > 0, "Collateral list cannot be empty");
        require(numTokens <= 10, "Collateral list too long");
        require(numTokens == _troveManagers.length, "Collateral list and trove manager list must have the same length");
        // totalCollaterals = numTokens;

        boldToken = _boldToken;
        governor = _governor;

        for (uint256 i; i < numTokens; i++) {
            allCollateralTokenAddresses[i] = _tokens[i];
            allTroveManagerAddresses[i] = _troveManagers[i];
            isActiveCollateral[i] = true;
            _activeBranchIds.push(i);
        }

        branches = numTokens;

        // Initialize the baseRate state variable
        baseRate = INITIAL_BASE_RATE;
        emit BaseRateUpdated(INITIAL_BASE_RATE);
    }

    struct RedemptionTotals {
        uint256 numCollaterals;
        uint256 boldSupplyAtStart;
        uint256 unbacked;
        uint256 redeemedAmount;
    }

    function redeemCollateral(uint256 _boldAmount, uint256 _maxIterationsPerCollateral, uint256 _maxFeePercentage)
        external
    {
        _requireValidMaxFeePercentage(_maxFeePercentage);
        _requireAmountGreaterThanOne(_boldAmount);

        RedemptionTotals memory totals;

        totals.numCollaterals = _activeBranchIds.length + _removedBranchIds.length;
        uint256[] memory unbackedPortions = new uint256[](totals.numCollaterals);
        uint256[] memory prices = new uint256[](totals.numCollaterals);

        // Gather and accumulate unbacked portions
        for (uint256 index = 0; index < totals.numCollaterals; index++) {
            // ITroveManager troveManager = getTroveManager(index);
            ITroveManager troveManager;
            if (index < _removedBranchIds.length) {
                troveManager = getRemovedTroveManager(index);
            } else {
                troveManager = getTroveManager(index - _removedBranchIds.length);
            }
            (uint256 unbackedPortion, uint256 price, bool redeemable) =
                troveManager.getUnbackedPortionPriceAndRedeemability();
            prices[index] = price;
            if (redeemable) {
                totals.unbacked += unbackedPortion;
                unbackedPortions[index] = unbackedPortion;
            }
        }

        // There’s an unlikely scenario where all the normally redeemable branches (i.e. having TCR > SCR) have 0 unbacked
        // In that case, we redeem proportionally to branch size
        if (totals.unbacked == 0) {
            unbackedPortions = new uint256[](totals.numCollaterals);
            for (uint256 index = 0; index < totals.numCollaterals; index++) {
                // ITroveManager troveManager = getTroveManager(index);
                ITroveManager troveManager;
                if (index < _removedBranchIds.length) {
                    troveManager = getRemovedTroveManager(index);
                } else {
                    troveManager = getTroveManager(index - _removedBranchIds.length);
                }
                (,, bool redeemable) = troveManager.getUnbackedPortionPriceAndRedeemability();
                if (redeemable) {
                    uint256 unbackedPortion = troveManager.getEntireBranchDebt();
                    totals.unbacked += unbackedPortion;
                    unbackedPortions[index] = unbackedPortion;
                }
            }
        } else {
            // Don't allow redeeming more than the total unbacked in one go, as that would result in a disproportionate
            // redemption (see CS-BOLD-013). Instead, truncate the redemption to total unbacked. If this happens, the
            // redeemer can call `redeemCollateral()` a second time to redeem the remainder of their BOLD.
            if (_boldAmount > totals.unbacked) {
                _boldAmount = totals.unbacked;
            }
        }

        totals.boldSupplyAtStart = boldToken.totalSupply();
        // Decay the baseRate due to time passed, and then increase it according to the size of this redemption.
        // Use the saved total Bold supply value, from before it was reduced by the redemption.
        // We only compute it here, and update it at the end,
        // because the final redeemed amount may be less than the requested amount
        // Redeemers should take this into account in order to request the optimal amount to not overpay
        uint256 redemptionRate =
            _calcRedemptionRate(_getUpdatedBaseRateFromRedemption(_boldAmount, totals.boldSupplyAtStart));
        require(redemptionRate <= _maxFeePercentage, "CR: Fee exceeded provided maximum");
        // Implicit by the above and the _requireValidMaxFeePercentage checks
        //require(newBaseRate < DECIMAL_PRECISION, "CR: Fee would eat up all collateral");

        // Compute redemption amount for each collateral and redeem against the corresponding TroveManager
        for (uint256 index = 0; index < totals.numCollaterals; index++) {
            //uint256 unbackedPortion = unbackedPortions[index];
            if (unbackedPortions[index] > 0) {
                uint256 redeemAmount = _boldAmount * unbackedPortions[index] / totals.unbacked;
                if (redeemAmount > 0) {
                    // ITroveManager troveManager = getTroveManager(index);
                    ITroveManager troveManager;
                    if (index < _removedBranchIds.length) {
                        troveManager = getRemovedTroveManager(index);
                    } else {
                        troveManager = getTroveManager(index - _removedBranchIds.length);
                    }
                    uint256 redeemedAmount = troveManager.redeemCollateral(
                        msg.sender, redeemAmount, prices[index], redemptionRate, _maxIterationsPerCollateral
                    );
                    totals.redeemedAmount += redeemedAmount;
                }

                // Ensure that per-branch redeems add up to `_boldAmount` exactly
                _boldAmount -= redeemAmount;
                totals.unbacked -= unbackedPortions[index];
            }
        }

        _updateBaseRateAndGetRedemptionRate(totals.redeemedAmount, totals.boldSupplyAtStart);

        // Burn the total Bold that is cancelled with debt
        if (totals.redeemedAmount > 0) {
            boldToken.burn(msg.sender, totals.redeemedAmount);
        }
    }

    // --- Internal fee functions ---

    // Update the last fee operation time only if time passed >= decay interval. This prevents base rate griefing.
    function _updateLastFeeOpTime() internal {
        uint256 minutesPassed = _minutesPassedSinceLastFeeOp();

        if (minutesPassed > 0) {
            lastFeeOperationTime += ONE_MINUTE * minutesPassed;
            emit LastFeeOpTimeUpdated(lastFeeOperationTime);
        }
    }

    function _minutesPassedSinceLastFeeOp() internal view returns (uint256) {
        return (block.timestamp - lastFeeOperationTime) / ONE_MINUTE;
    }

    // Updates the `baseRate` state with math from `_getUpdatedBaseRateFromRedemption`
    function _updateBaseRateAndGetRedemptionRate(uint256 _boldAmount, uint256 _totalBoldSupplyAtStart) internal {
        uint256 newBaseRate = _getUpdatedBaseRateFromRedemption(_boldAmount, _totalBoldSupplyAtStart);

        //assert(newBaseRate <= DECIMAL_PRECISION); // This is already enforced in `_getUpdatedBaseRateFromRedemption`

        // Update the baseRate state variable
        baseRate = newBaseRate;
        emit BaseRateUpdated(newBaseRate);

        _updateLastFeeOpTime();
    }

    /*
     * This function calculates the new baseRate in the following way:
     * 1) decays the baseRate based on time passed since last redemption or Bold borrowing operation.
     * then,
     * 2) increases the baseRate based on the amount redeemed, as a proportion of total supply
     */
    function _getUpdatedBaseRateFromRedemption(uint256 _redeemAmount, uint256 _totalBoldSupply)
        internal
        view
        returns (uint256)
    {
        // decay the base rate
        uint256 decayedBaseRate = _calcDecayedBaseRate();

        // get the fraction of total supply that was redeemed
        uint256 redeemedBoldFraction = _redeemAmount * DECIMAL_PRECISION / _totalBoldSupply;

        uint256 newBaseRate = decayedBaseRate + redeemedBoldFraction / REDEMPTION_BETA;
        newBaseRate = LiquityMath._min(newBaseRate, DECIMAL_PRECISION); // cap baseRate at a maximum of 100%

        return newBaseRate;
    }

    function _calcDecayedBaseRate() internal view returns (uint256) {
        uint256 minutesPassed = _minutesPassedSinceLastFeeOp();
        uint256 decayFactor = LiquityMath._decPow(REDEMPTION_MINUTE_DECAY_FACTOR, minutesPassed);

        return baseRate * decayFactor / DECIMAL_PRECISION;
    }

    function _calcRedemptionRate(uint256 _baseRate) internal pure returns (uint256) {
        return LiquityMath._min(
            REDEMPTION_FEE_FLOOR + _baseRate,
            DECIMAL_PRECISION // cap at a maximum of 100%
        );
    }

    function _calcRedemptionFee(uint256 _redemptionRate, uint256 _amount) internal pure returns (uint256) {
        uint256 redemptionFee = _redemptionRate * _amount / DECIMAL_PRECISION;
        return redemptionFee;
    }

    // external redemption rate/fee getters

    function getRedemptionRate() external view override returns (uint256) {
        return _calcRedemptionRate(baseRate);
    }

    function getRedemptionRateWithDecay() public view override returns (uint256) {
        return _calcRedemptionRate(_calcDecayedBaseRate());
    }

    function getRedemptionRateForRedeemedAmount(uint256 _redeemAmount) external view returns (uint256) {
        uint256 totalBoldSupply = boldToken.totalSupply();
        uint256 newBaseRate = _getUpdatedBaseRateFromRedemption(_redeemAmount, totalBoldSupply);
        return _calcRedemptionRate(newBaseRate);
    }

    function getRedemptionFeeWithDecay(uint256 _ETHDrawn) external view override returns (uint256) {
        return _calcRedemptionFee(getRedemptionRateWithDecay(), _ETHDrawn);
    }

    function getEffectiveRedemptionFeeInBold(uint256 _redeemAmount) external view override returns (uint256) {
        uint256 totalBoldSupply = boldToken.totalSupply();
        uint256 newBaseRate = _getUpdatedBaseRateFromRedemption(_redeemAmount, totalBoldSupply);
        return _calcRedemptionFee(_calcRedemptionRate(newBaseRate), _redeemAmount);
    }

    // getters

    function totalCollaterals() external view returns (uint256) {
        return _activeBranchIds.length;
    }

    function activeBranchIds() external view returns (uint256[] memory) {
        return _activeBranchIds;
    }

    function removedBranchIds() external view returns (uint256[] memory) {
        return _removedBranchIds;
    }

    function getToken(uint256 _index) external view returns (IERC20Metadata) {
        if (_index >= _activeBranchIds.length) {
            revert("Invalid index");
        } else {
            uint256 branchId = _activeBranchIds[_index];
            return allCollateralTokenAddresses[branchId];
        }
    }

    function getTroveManager(uint256 _index) public view returns (ITroveManager) {
        if (_index >= _activeBranchIds.length) {
            revert("Invalid index");
        } else {
            uint256 branchId = _activeBranchIds[_index];
            return allTroveManagerAddresses[branchId];
        }
    }

    function getRemovedToken(uint256 _index) external view returns (IERC20Metadata) {
        if (_index >= _removedBranchIds.length) {
            revert("Invalid index");
        } else {
            uint256 branchId = _removedBranchIds[_index];
            return allCollateralTokenAddresses[branchId];
        }
    }

    function getRemovedTroveManager(uint256 _index) public view returns (ITroveManager) {
        if (_index >= _removedBranchIds.length) {
            revert("Invalid index");
        } else {
            uint256 branchId = _removedBranchIds[_index];
            return allTroveManagerAddresses[branchId];
        }
    }

    // require functions

    function _requireValidMaxFeePercentage(uint256 _maxFeePercentage) internal pure {
        require(
            _maxFeePercentage >= REDEMPTION_FEE_FLOOR && _maxFeePercentage <= DECIMAL_PRECISION,
            "Max fee percentage must be between 0.5% and 100%"
        );
    }

    function _requireAmountGreaterThanOne(uint256 _amount) internal pure {
        require(_amount >= 1e18, "CollateralRegistry: Amount must be greater than 1 Stablecoin.");
    }

    function getDebtLimit(uint256 _indexTroveManager) external view returns (uint256) {
        return getTroveManager(_indexTroveManager).getDebtLimit();
    }

    function updateDebtLimit(uint256 _indexTroveManager, uint256 _newDebtLimit) external onlyGovernor {
        //limited to increasing by 2x at a time, maximum. Decrease by any amount.
        uint256 currentDebtLimit = getTroveManager(_indexTroveManager).getDebtLimit();
        if (_newDebtLimit > currentDebtLimit) {
            require(_newDebtLimit <= currentDebtLimit * 2 || _newDebtLimit <= getTroveManager(_indexTroveManager).getInitialDebtLimit(), "CollateralRegistry: Debt limit increase by more than 2x is not allowed");
        }
        getTroveManager(_indexTroveManager).setDebtLimit(_newDebtLimit);
    }

    function updateCCR(uint256 _branchId, uint256 _newCCR) external onlyGovernor {
        allTroveManagerAddresses[_branchId].addressesRegistry().updateCCR(_newCCR);
    }

    // Use the branchId, not the array index
    function updateMCR(uint256 _branchId, uint256 _newMCR) external onlyGovernor {
        allTroveManagerAddresses[_branchId].addressesRegistry().updateMCR(_newMCR);
    }

    function updateBCR(uint256 _branchId, uint256 _newBCR) external onlyGovernor {
        allTroveManagerAddresses[_branchId].addressesRegistry().updateBCR(_newBCR);
    }

    function updateSCR(uint256 _branchId, uint256 _newSCR) external onlyGovernor {
        allTroveManagerAddresses[_branchId].addressesRegistry().updateSCR(_newSCR);
    }

    // ==== Add a new collateral ==== 
    /**
     * @dev This function adds new collateral branch at the end of the collateral list.
     * The collateral branch will have a unique index in mapping of all collateral branches that differs from the index of the collateral branch in the collateral list.
     * The unique index is used to get the collateral branch during redemptions and such. The index in the collateral list does not matter.
     * @param _token token address of collateral
     * @param _troveManager trove manager address of collateral
     */
    function addCollateral(IERC20Metadata _token, ITroveManager _troveManager) external onlyGovernor {
        //validate input
        require(address(_token) != address(0), "CollateralRegistry: Token cannot be address(0)");
        require(address(_troveManager) != address(0), "CollateralRegistry: TroveManager cannot be address(0)");

        uint256 branchId = _troveManager.branchId();
        require(branchId == branches, "CollateralRegistry: TroveManager branchId does not match master index");
        require(address(allCollateralTokenAddresses[branchId]) == address(0), "CollateralRegistry: Collateral already exists.");
        require(address(allTroveManagerAddresses[branchId]) == address(0), "CollateralRegistry: TroveManager already exists.");

        //add collateral
        allCollateralTokenAddresses[branchId] = _token;
        allTroveManagerAddresses[branchId] = _troveManager;
        _activeBranchIds.push(branchId);
        isActiveCollateral[branchId] = true;
        branches++;

        //emit event
        emit CollateralAdded(branchId, address(_token), address(_troveManager));
    }

    // ==== Remove a collateral ==== 
    //When removing a collateral, we need to:
    //1. Remove the collateral from the CollateralRegistry
    //2. allow users to pay back their debt, but not take out new debt, while maintaining existing BCR.

    /**
     * 
     * @param _index The index of collateral in the collateral list. Not the master index.
     */
    function removeCollateral(uint256 _index) external onlyGovernor {
        require(_index >= 0 && _index < _activeBranchIds.length, "CollateralRegistry: Invalid index"); // 0-9

        uint256 branchId = _activeBranchIds[_index];

        IERC20Metadata collateralToken = allCollateralTokenAddresses[branchId];
        ITroveManager troveManager = allTroveManagerAddresses[branchId];

        //validate existing collateral
        require(address(collateralToken) != address(0), "CollateralRegistry: Collateral does not exist.");
        require(address(troveManager) != address(0), "CollateralRegistry: TroveManager does not exist.");
        require(branchId == troveManager.branchId(), "CollateralRegistry: Wrong branchId");

        // remove collateral from active collateral list
        isActiveCollateral[branchId] = false;
        _activeBranchIds[_index] = _activeBranchIds[_activeBranchIds.length - 1];
        _activeBranchIds.pop();

        // add to removed collateral tokens and trove managers lists
        uint256 index = _removedBranchIds.length;
        _removedBranchIds.push(branchId);
        _removedBranchIdsIndex[branchId] = index;

        // emit event
        emit CollateralRemoved(branchId, address(collateralToken), address(troveManager));
    }

    // Once all troves are closed/redeemed/liquidated, we can permanently delete the collateral from the removed collateral tokens and trove managers lists
    function _permanentlyDeleteFromRemovedCollaterals(uint256 _index) internal {
        uint256 branchId = _removedBranchIds[_index];
        uint256 lastBranchId = _removedBranchIds[_removedBranchIds.length - 1];
        _removedBranchIds[_index] = lastBranchId;
        _removedBranchIds.pop();
        
        _removedBranchIdsIndex[lastBranchId] = _index;
        delete _removedBranchIdsIndex[branchId];
    }

    // Anyone can call this function which deletes first dead branch found in removed collaterals list.
    function cleanRemovedCollaterals(uint256 _index) external {
        require(_removedBranchIds.length > 0, "CollateralRegistry: No removed collaterals exist");
        require(_index >= 0 && _index < _removedBranchIds.length, "CollateralRegistry: Invalid index");

        ITroveManager troveManager = getRemovedTroveManager(_index);
        require(troveManager.getTroveIdsCount() == 0, "CollateralRegistry: Trove manager has troves");

        _permanentlyDeleteFromRemovedCollaterals(_index);
        emit CollateralDeletedForever(_index);
    }
}
