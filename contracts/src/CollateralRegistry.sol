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
    uint256 public totalCollaterals;

    IERC20Metadata[10] internal collateralTokens;
    ITroveManager[10] internal troveManagers;

    IBoldToken public immutable boldToken;

    uint256 public baseRate;

    // The timestamp of the latest fee operation (redemption or new Bold issuance)
    uint256 public lastFeeOperationTime = block.timestamp;

    event BaseRateUpdated(uint256 _baseRate);
    event LastFeeOpTimeUpdated(uint256 _lastFeeOpTime);
    event NewCollateralAdded(address collateral, address troveManager);
    event CollateralRemoved(address collateral, address troveManager);

    constructor(IBoldToken _boldToken, IERC20Metadata[] memory _tokens, ITroveManager[] memory _troveManagers) {
        uint256 numTokens = _tokens.length;
        require(numTokens > 0, "Collateral list cannot be empty");
        require(numTokens <= 10, "Collateral list too long");
        totalCollaterals = numTokens;

        boldToken = _boldToken;

        for(uint8 i=0; i<numTokens; i++) {
            collateralTokens[i] = _tokens[i];
            troveManagers[i] = _troveManagers[i];
        }

        // Initialize the baseRate state variable
        baseRate = INITIAL_BASE_RATE;
        emit BaseRateUpdated(INITIAL_BASE_RATE);
    }

    function addNewCollaterals(uint256[] memory _indexes, IERC20Metadata[] memory _tokens, ITroveManager[] memory _troveManagers) external override {
        require(msg.sender == boldToken.getOwner(), "Only owner");
        
        uint256 numTokens = _indexes.length; 
        require(numTokens > 0 && numTokens == _tokens.length && numTokens == _troveManagers.length, "Invalid input");

        require(totalCollaterals + numTokens <= 10, "Max collaterals");

        // add new collaterals and trove managers 
        for(uint8 i=0; i<numTokens; i++) {
            uint256 index = _indexes[i];

            // can't overwrite an existing branch
            require(index <= 9, "Invalid index");
            require(address(collateralTokens[index]) == address(0), "Collateral already initialised");

            collateralTokens[index] = _tokens[i];
            troveManagers[index] = _troveManagers[i];

            emit NewCollateralAdded(address(_tokens[i]), address(_troveManagers[i]));
        }

        // update total Collaterals
        totalCollaterals += numTokens;
    }
 
    function removeCollaterals(uint256[] memory _indexes) external override {
        require(msg.sender == boldToken.getOwner(), "Only owner");
       
        uint256 numTokens = _indexes.length; 
        require(
            numTokens > 0 && 
            numTokens <= totalCollaterals, 
            "Invalid input"
        );

        // remove collaterals and trove managers 
        for(uint8 i=0; i<numTokens; i++) {
            uint256 index = _indexes[i];

            require(index <= 9, "Invalid index");
            require(address(collateralTokens[index]) != address(0), "Branch not initialised");

            emit CollateralRemoved(address(collateralTokens[index]), address(troveManagers[index]));

            collateralTokens[index] = IERC20Metadata(address(0));
            troveManagers[index] = ITroveManager(address(0));
        }
        
        totalCollaterals -= numTokens;
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
        _requireAmountGreaterThanZero(_boldAmount);

        RedemptionTotals memory totals;

        totals.numCollaterals = totalCollaterals;
        uint256[] memory unbackedPortions = new uint256[](totals.numCollaterals);
        uint256[] memory prices = new uint256[](totals.numCollaterals);

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

        // Gather and accumulate unbacked portions
        for (uint256 index = 0; index < totals.numCollaterals; index++) {
            ITroveManager troveManager = getTroveManager(index);
            (uint256 unbackedPortion, uint256 price, bool redeemable) =
                troveManager.getUnbackedPortionPriceAndRedeemability();
            prices[index] = price;
            if (redeemable && _isWhitelistedRedeemer(troveManager, msg.sender)) {
                totals.unbacked += unbackedPortion;
                unbackedPortions[index] = unbackedPortion;
            }
        }

        // There’s an unlikely scenario where all the normally redeemable branches (i.e. having TCR > SCR) have 0 unbacked
        // In that case, we redeem proportinally to branch size
        if (totals.unbacked == 0) {
            unbackedPortions = new uint256[](totals.numCollaterals);
            for (uint256 index = 0; index < totals.numCollaterals; index++) {
                ITroveManager troveManager = getTroveManager(index);
                (,, bool redeemable) = troveManager.getUnbackedPortionPriceAndRedeemability();
                if (redeemable && _isWhitelistedRedeemer(troveManager, msg.sender)) {
                    uint256 unbackedPortion = troveManager.getEntireBranchDebt();
                    totals.unbacked += unbackedPortion;
                    unbackedPortions[index] = unbackedPortion;
                }
            }
        }

        // Compute redemption amount for each collateral and redeem against the corresponding TroveManager
        for (uint256 index = 0; index < totals.numCollaterals; index++) {
            //uint256 unbackedPortion = unbackedPortions[index];
            if (unbackedPortions[index] > 0) {
                uint256 redeemAmount = _boldAmount * unbackedPortions[index] / totals.unbacked;
                if (redeemAmount > 0) {
                    ITroveManager troveManager = getTroveManager(index);
                    uint256 redeemedAmount = troveManager.redeemCollateral(
                        msg.sender, redeemAmount, prices[index], redemptionRate, _maxIterationsPerCollateral
                    );
                    totals.redeemedAmount += redeemedAmount;
                }
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

    function getToken(uint256 _index) external view returns (IERC20Metadata) {
        require(_index < 10, "Invalid index");

        return collateralTokens[_index];
    }

    function getTroveManager(uint256 _index) public view returns (ITroveManager) {
        require(_index < 10, "Invalid index");

        return troveManagers[_index];
    }

    // require functions

    function _isWhitelistedRedeemer(ITroveManager troveManager, address redeemer) internal view returns (bool) {
        IWhitelist whitelist = troveManager.whitelist();

        // if a branch does not implement whitelisting, the whitelist contract address is 0
        bool whitelisted = true;
        if(address(whitelist) != address(0)) {
            try whitelist.isWhitelisted(address(troveManager), redeemer) returns (bool w) {
                whitelisted = w;
            } catch {
                whitelisted = false;
            }
        }

        return whitelisted;
    }

    function _requireValidMaxFeePercentage(uint256 _maxFeePercentage) internal pure {
        require(
            _maxFeePercentage >= REDEMPTION_FEE_FLOOR && _maxFeePercentage <= DECIMAL_PRECISION,
            "Max fee percentage must be between 0.5% and 100%"
        );
    }

    function _requireAmountGreaterThanZero(uint256 _amount) internal pure {
        require(_amount > 0, "CollateralRegistry: Amount must be greater than zero");
    }
}
