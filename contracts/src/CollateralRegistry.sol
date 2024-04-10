// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

import "./Interfaces/ITroveManager.sol";
import "./Interfaces/IBoldToken.sol";
import "./Dependencies/LiquityBase.sol";

import "./Interfaces/ICollateralRegistry.sol";

// import "forge-std/console.sol";

contract CollateralRegistry is LiquityBase, ICollateralRegistry {
    // mapping from Collateral token address to the corresponding TroveManagers
    //mapping(address => address) troveManagers;
    // See: https://github.com/ethereum/solidity/issues/12587
    uint256 public immutable totalCollaterals;

    IERC20 internal immutable _token0;
    IERC20 internal immutable _token1;
    IERC20 internal immutable _token2;
    IERC20 internal immutable _token3;
    IERC20 internal immutable _token4;
    IERC20 internal immutable _token5;
    IERC20 internal immutable _token6;
    IERC20 internal immutable _token7;
    IERC20 internal immutable _token8;
    IERC20 internal immutable _token9;

    ITroveManager internal immutable _troveManager0;
    ITroveManager internal immutable _troveManager1;
    ITroveManager internal immutable _troveManager2;
    ITroveManager internal immutable _troveManager3;
    ITroveManager internal immutable _troveManager4;
    ITroveManager internal immutable _troveManager5;
    ITroveManager internal immutable _troveManager6;
    ITroveManager internal immutable _troveManager7;
    ITroveManager internal immutable _troveManager8;
    ITroveManager internal immutable _troveManager9;

    IBoldToken public immutable boldToken;

    constructor(IBoldToken _boldToken, IERC20[] memory _tokens, ITroveManager[] memory _troveManagers) {
        //checkContract(address(_boldToken));

        uint256 numTokens = _tokens.length;
        require(numTokens > 0, "Collateral list cannot be empty");
        require(numTokens < 10, "Collateral list too long");
        require(numTokens == _troveManagers.length, "List sizes mismatch");
        totalCollaterals = numTokens;

        boldToken = _boldToken;

        _token0 = _tokens[0];
        _troveManager0 = _troveManagers[0];

        _token1 = numTokens > 1 ? _tokens[1] : IERC20(address(0));
        _troveManager1 = numTokens > 1 ? _troveManagers[1] : ITroveManager(address(0));

        _token2 = numTokens > 2 ? _tokens[2] : IERC20(address(0));
        _troveManager2 = numTokens > 2 ? _troveManagers[2] : ITroveManager(address(0));

        _token3 = numTokens > 3 ? _tokens[3] : IERC20(address(0));
        _troveManager3 = numTokens > 3 ? _troveManagers[3] : ITroveManager(address(0));

        _token4 = numTokens > 4 ? _tokens[4] : IERC20(address(0));
        _troveManager4 = numTokens > 4 ? _troveManagers[4] : ITroveManager(address(0));

        _token5 = numTokens > 5 ? _tokens[5] : IERC20(address(0));
        _troveManager5 = numTokens > 5 ? _troveManagers[5] : ITroveManager(address(0));

        _token6 = numTokens > 6 ? _tokens[6] : IERC20(address(0));
        _troveManager6 = numTokens > 6 ? _troveManagers[6] : ITroveManager(address(0));

        _token7 = numTokens > 7 ? _tokens[7] : IERC20(address(0));
        _troveManager7 = numTokens > 7 ? _troveManagers[7] : ITroveManager(address(0));

        _token8 = numTokens > 8 ? _tokens[8] : IERC20(address(0));
        _troveManager8 = numTokens > 8 ? _troveManagers[8] : ITroveManager(address(0));

        _token9 = numTokens > 9 ? _tokens[9] : IERC20(address(0));
        _troveManager9 = numTokens > 9 ? _troveManagers[9] : ITroveManager(address(0));
    }

    function redeemCollateral(uint256 _boldAmount, uint256 _maxIterations, uint256 _maxFeePercentage) external {
        _requireValidMaxFeePercentage(_maxFeePercentage);
        _requireAmountGreaterThanZero(_boldAmount);
        _requireBoldBalanceCoversRedemption(boldToken, msg.sender, _boldAmount);

        uint256 numCollaterals = totalCollaterals;
        uint256[] memory unbackedPortions = new uint256[](numCollaterals);
        uint256 totalUnbacked;

        // Gather and accumulate unbacked portions
        for (uint256 index = 0; index < numCollaterals; index++) {
            ITroveManager troveManager = getTroveManager(index);
            uint256 unbackedPortion = troveManager.getUnbackedPortion();
            totalUnbacked += unbackedPortion;
            unbackedPortions[index] = unbackedPortion;
        }

        // The amount redeemed has to be outside SPs, and therefore unbacked
        assert(totalUnbacked > _boldAmount);

        // Compute redemption amount for each collateral and redeem against the corresponding TroveManager
        uint256 totalFeePercentage;
        uint256 totalRedeemedAmount; // TODO: get rid of totalRedeemedAmount and just use _boldAmount
        for (uint256 index = 0; index < numCollaterals; index++) {
            uint256 unbackedPortion = unbackedPortions[index];
            if (unbackedPortion > 0) {
                uint256 redeemAmount = _boldAmount * unbackedPortion / totalUnbacked;
                if (redeemAmount > 0) {
                    ITroveManager troveManager = getTroveManager(index);
                    uint256 feePercentage = troveManager.redeemCollateral(msg.sender, redeemAmount, _maxIterations);
                    totalFeePercentage += feePercentage * redeemAmount;
                    totalRedeemedAmount += redeemAmount;
                }
            }
        }
        // TODO: get rid of totalRedeemedAmount and just use _boldAmount
        assert(totalRedeemedAmount * DECIMAL_PRECISION / _boldAmount > 1e18 - 1e14); // 0.01% error
        totalFeePercentage = totalFeePercentage / totalRedeemedAmount;
        require(totalFeePercentage <= _maxFeePercentage, "Fee exceeded provided maximum");
    }

    function getTroveManager(uint256 _index) public view returns (ITroveManager) {
        if (_index == 0) return _troveManager0;
        else if (_index == 1) return _troveManager1;
        else if (_index == 2) return _troveManager2;
        else if (_index == 3) return _troveManager3;
        else if (_index == 4) return _troveManager4;
        else if (_index == 5) return _troveManager5;
        else if (_index == 6) return _troveManager6;
        else if (_index == 7) return _troveManager7;
        else if (_index == 8) return _troveManager8;
        else if (_index == 9) return _troveManager9;
        else revert("Invalid index");
    }

    function getToken(uint256 _index) external view returns (IERC20) {
        if (_index == 0) return _token0;
        else if (_index == 1) return _token1;
        else if (_index == 2) return _token2;
        else if (_index == 3) return _token3;
        else if (_index == 4) return _token4;
        else if (_index == 5) return _token5;
        else if (_index == 6) return _token6;
        else if (_index == 7) return _token7;
        else if (_index == 8) return _token8;
        else if (_index == 9) return _token9;
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
            boldBalance >= _amount,
            "TroveManager: Requested redemption amount must be <= user's Bold token balance"
        );
    }

    /*
      TODO: do we need this?
    function getTokenIndex(IERC20 token) external view returns (uint256) {
        if (token == _token0) { return 0; }
        else if (token == _token1) { return 1; }
        else if (token == _token2) { return 2; }
        else if (token == _token3) { return 3; }
        else if (token == _token4) { return 4; }
        else if (token == _token5) { return 5; }
        else if (token == _token6) { return 6; }
        else if (token == _token7) { return 7; }
        else if (token == _token8) { return 8; }
        else if (token == _token9) { return 9; }
        else {
            revert("Invalid token");
        }
    }

    function getTroveManagerIndex(ITroveManager troveManager) external view returns (uint256) {
        if (troveManager == _troveManager0) { return 0; }
        else if (troveManager == _troveManager1) { return 1; }
        else if (troveManager == _troveManager2) { return 2; }
        else if (troveManager == _troveManager3) { return 3; }
        else if (troveManager == _troveManager4) { return 4; }
        else if (troveManager == _troveManager5) { return 5; }
        else if (troveManager == _troveManager6) { return 6; }
        else if (troveManager == _troveManager7) { return 7; }
        else if (troveManager == _troveManager8) { return 8; }
        else if (troveManager == _troveManager9) { return 9; }
        else {
            revert("Invalid troveManager");
        }
    }
    */
}
