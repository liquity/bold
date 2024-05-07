// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

import "./Interfaces/ITroveManager.sol";
import "./Interfaces/IBoldToken.sol";
import "./Dependencies/LiquityBase.sol";

import "./Interfaces/ICollateralRegistry.sol";

// import "forge-std/console2.sol";

contract CollateralRegistry is LiquityBase, ICollateralRegistry {
    // mapping from Collateral token address to the corresponding TroveManagers
    //mapping(address => address) troveManagers;
    // See: https://github.com/ethereum/solidity/issues/12587
    uint256 public immutable totalCollaterals;

    IERC20 internal immutable token0;
    IERC20 internal immutable token1;
    IERC20 internal immutable token2;
    IERC20 internal immutable token3;
    IERC20 internal immutable token4;
    IERC20 internal immutable token5;
    IERC20 internal immutable token6;
    IERC20 internal immutable token7;
    IERC20 internal immutable token8;
    IERC20 internal immutable token9;

    ITroveManager internal immutable troveManager0;
    ITroveManager internal immutable troveManager1;
    ITroveManager internal immutable troveManager2;
    ITroveManager internal immutable troveManager3;
    ITroveManager internal immutable troveManager4;
    ITroveManager internal immutable troveManager5;
    ITroveManager internal immutable troveManager6;
    ITroveManager internal immutable troveManager7;
    ITroveManager internal immutable troveManager8;
    ITroveManager internal immutable troveManager9;

    IBoldToken public immutable boldToken;

    uint256 public constant SECONDS_IN_ONE_MINUTE = 60;

    /*
     * Half-life of 12h. 12h = 720 min
     * (1/2) = d^720 => d = (1/2)^(1/720)
     */
    uint256 public constant MINUTE_DECAY_FACTOR = 999037758833783000;
    // To prevent redemptions unless Bold depegs below 0.95 and allow the system to take off
    uint256 public constant INITIAL_REDEMPTION_RATE = DECIMAL_PRECISION / 100 * 5; // 5%

    /*
     * BETA: 18 digit decimal. Parameter by which to divide the redeemed fraction, in order to calc the new base rate from a redemption.
     * Corresponds to (1 / ALPHA) in the white paper.
     */
    uint256 public constant BETA = 2;

    uint256 public baseRate;

    // The timestamp of the latest fee operation (redemption or new Bold issuance)
    uint256 public lastFeeOperationTime;

    event BaseRateUpdated(uint256 _baseRate);
    event LastFeeOpTimeUpdated(uint256 _lastFeeOpTime);

    constructor(IBoldToken _boldToken, IERC20[] memory _tokens, ITroveManager[] memory _troveManagers) {
        uint256 numTokens = _tokens.length;
        require(numTokens > 0, "Collateral list cannot be empty");
        require(numTokens < 10, "Collateral list too long");
        require(numTokens == _troveManagers.length, "List sizes mismatch");
        totalCollaterals = numTokens;

        boldToken = _boldToken;

        token0 = _tokens[0];
        troveManager0 = _troveManagers[0];

        token1 = numTokens > 1 ? _tokens[1] : IERC20(address(0));
        troveManager1 = numTokens > 1 ? _troveManagers[1] : ITroveManager(address(0));

        token2 = numTokens > 2 ? _tokens[2] : IERC20(address(0));
        troveManager2 = numTokens > 2 ? _troveManagers[2] : ITroveManager(address(0));

        token3 = numTokens > 3 ? _tokens[3] : IERC20(address(0));
        troveManager3 = numTokens > 3 ? _troveManagers[3] : ITroveManager(address(0));

        token4 = numTokens > 4 ? _tokens[4] : IERC20(address(0));
        troveManager4 = numTokens > 4 ? _troveManagers[4] : ITroveManager(address(0));

        token5 = numTokens > 5 ? _tokens[5] : IERC20(address(0));
        troveManager5 = numTokens > 5 ? _troveManagers[5] : ITroveManager(address(0));

        token6 = numTokens > 6 ? _tokens[6] : IERC20(address(0));
        troveManager6 = numTokens > 6 ? _troveManagers[6] : ITroveManager(address(0));

        token7 = numTokens > 7 ? _tokens[7] : IERC20(address(0));
        troveManager7 = numTokens > 7 ? _troveManagers[7] : ITroveManager(address(0));

        token8 = numTokens > 8 ? _tokens[8] : IERC20(address(0));
        troveManager8 = numTokens > 8 ? _troveManagers[8] : ITroveManager(address(0));

        token9 = numTokens > 9 ? _tokens[9] : IERC20(address(0));
        troveManager9 = numTokens > 9 ? _troveManagers[9] : ITroveManager(address(0));

        // Update the baseRate state variable
        // To prevent redemptions unless Bold depegs below 0.95 and allow the system to take off
        baseRate = INITIAL_REDEMPTION_RATE;
        emit BaseRateUpdated(INITIAL_REDEMPTION_RATE);
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
        _requireBoldBalanceCoversRedemption(boldToken, msg.sender, _boldAmount);

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
            if (redeemable) {
                totals.unbacked += unbackedPortion;
                unbackedPortions[index] = unbackedPortion;
                prices[index] = price;
            }
        }

        // The amount redeemed has to be outside SPs, and therefore unbacked
        assert(totals.unbacked >= _boldAmount);

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
        uint256 timePassed = block.timestamp - lastFeeOperationTime;

        if (timePassed >= SECONDS_IN_ONE_MINUTE) {
            lastFeeOperationTime = block.timestamp;
            emit LastFeeOpTimeUpdated(block.timestamp);
        }
    }

    function _minutesPassedSinceLastFeeOp() internal view returns (uint256) {
        return (block.timestamp - lastFeeOperationTime) / SECONDS_IN_ONE_MINUTE;
    }

    // Updates the `baseRate` state with math from `_getUpdatedBaseRateFromRedemption`
    function _updateBaseRateAndGetRedemptionRate(uint256 _boldAmount, uint256 _totalBoldSupplyAtStart) internal {
        uint256 newBaseRate = _getUpdatedBaseRateFromRedemption(_boldAmount, _totalBoldSupplyAtStart);

        //assert(newBaseRate <= DECIMAL_PRECISION); // This is already enforced in `_getUpdatedBaseRateFromRedemption`
        assert(newBaseRate > 0); // Base rate is always non-zero after redemption

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

        uint256 newBaseRate = decayedBaseRate + redeemedBoldFraction / BETA;
        newBaseRate = LiquityMath._min(newBaseRate, DECIMAL_PRECISION); // cap baseRate at a maximum of 100%

        return newBaseRate;
    }

    function _calcDecayedBaseRate() internal view returns (uint256) {
        uint256 minutesPassed = _minutesPassedSinceLastFeeOp();
        uint256 decayFactor = LiquityMath._decPow(MINUTE_DECAY_FACTOR, minutesPassed);

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

    function getRedemptionFeeWithDecay(uint256 _ETHDrawn) external view override returns (uint256) {
        return _calcRedemptionFee(getRedemptionRateWithDecay(), _ETHDrawn);
    }

    function getEffectiveRedemptionFeeInBold(uint256 _redeemAmount) public view override returns (uint256) {
        uint256 totalBoldSupply = boldToken.totalSupply();
        uint256 newBaseRate = _getUpdatedBaseRateFromRedemption(_redeemAmount, totalBoldSupply);
        return _calcRedemptionFee(_calcRedemptionRate(newBaseRate), _redeemAmount);
    }

    function getEffectiveRedemptionFee(uint256 _redeemAmount, uint256 _price)
        external
        view
        override
        returns (uint256)
    {
        return getEffectiveRedemptionFeeInBold(_redeemAmount) * DECIMAL_PRECISION / _price;
    }

    // getters

    function getTroveManager(uint256 _index) public view returns (ITroveManager) {
        if (_index == 0) return troveManager0;
        else if (_index == 1) return troveManager1;
        else if (_index == 2) return troveManager2;
        else if (_index == 3) return troveManager3;
        else if (_index == 4) return troveManager4;
        else if (_index == 5) return troveManager5;
        else if (_index == 6) return troveManager6;
        else if (_index == 7) return troveManager7;
        else if (_index == 8) return troveManager8;
        else if (_index == 9) return troveManager9;
        else revert("Invalid index");
    }

    function getToken(uint256 _index) external view returns (IERC20) {
        if (_index == 0) return token0;
        else if (_index == 1) return token1;
        else if (_index == 2) return token2;
        else if (_index == 3) return token3;
        else if (_index == 4) return token4;
        else if (_index == 5) return token5;
        else if (_index == 6) return token6;
        else if (_index == 7) return token7;
        else if (_index == 8) return token8;
        else if (_index == 9) return token9;
        else revert("Invalid index");
    }

    // require functions

    function _requireValidMaxFeePercentage(uint256 _maxFeePercentage) internal pure {
        require(
            _maxFeePercentage >= REDEMPTION_FEE_FLOOR && _maxFeePercentage <= DECIMAL_PRECISION,
            "Max fee percentage must be between 0.5% and 100%"
        );
    }

    function _requireAmountGreaterThanZero(uint256 _amount) internal pure {
        require(_amount > 0, "TroveManager: Amount must be greater than zero");
    }

    function _requireBoldBalanceCoversRedemption(IBoldToken _boldToken, address _redeemer, uint256 _amount)
        internal
        view
    {
        uint256 boldBalance = _boldToken.balanceOf(_redeemer);
        // Confirm redeemer's balance is less than total Bold supply
        assert(boldBalance <= _boldToken.totalSupply());
        require(
            boldBalance >= _amount, "TroveManager: Requested redemption amount must be <= user's Bold token balance"
        );
    }

    /*
      TODO: do we need this?
    function getTokenIndex(IERC20 _token) external view returns (uint256) {
        if (token == token0) { return 0; }
        else if (_token == token1) { return 1; }
        else if (_token == token2) { return 2; }
        else if (_token == token3) { return 3; }
        else if (_token == token4) { return 4; }
        else if (_token == token5) { return 5; }
        else if (_token == token6) { return 6; }
        else if (_token == token7) { return 7; }
        else if (_token == token8) { return 8; }
        else if (_token == token9) { return 9; }
        else {
            revert("Invalid token");
        }
    }

    function getTroveManagerIndex(ITroveManager _troveManager) external view returns (uint256) {
        if (troveManager == troveManager0) { return 0; }
        else if (_troveManager == troveManager1) { return 1; }
        else if (_troveManager == troveManager2) { return 2; }
        else if (_troveManager == troveManager3) { return 3; }
        else if (_troveManager == troveManager4) { return 4; }
        else if (_troveManager == troveManager5) { return 5; }
        else if (_troveManager == troveManager6) { return 6; }
        else if (_troveManager == troveManager7) { return 7; }
        else if (_troveManager == troveManager8) { return 8; }
        else if (_troveManager == troveManager9) { return 9; }
        else {
            revert("Invalid troveManager");
        }
    }
    */
}
