// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

import "../../src/TroveManager.sol";

// Same as TroveManager but with a public call for
// redeemCollateralFromTrove
contract TroveManagerHarness is TroveManager {
    constructor(IAddressesRegistry _addressesRegistry) TroveManager(_addressesRegistry) {}

    function redeemCollateralFromTroveHarnessed (
        IDefaultPool _defaultPool,
        SingleRedemptionValues memory _singleRedemption,
        uint256 _maxBoldamount,
        uint256 _price,
        uint256 _redemptionRate
    ) external returns (uint256) {
        _redeemCollateralFromTrove(_defaultPool, _singleRedemption,
            _maxBoldamount, _price, _redemptionRate);
        return _singleRedemption.boldLot;
    }
}