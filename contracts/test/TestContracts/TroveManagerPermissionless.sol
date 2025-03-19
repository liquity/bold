// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import "src/TroveManager.sol";

contract TroveManagerPermissionless is TroveManager {
    constructor(IAddressesRegistry _addressesRegistry) TroveManager(_addressesRegistry) {}

    function _requireCallerIsBorrowerOperations() internal view override {}
    function _requireCallerIsCollateralRegistry() internal view override {}

    function getTroveDebt(uint256 _troveId) external view returns (uint256) {
        Trove memory trove = Troves[_troveId];
        address batchAddress = _getBatchManager(trove);
        if (batchAddress != address(0)) {
            Batch memory batch = batches[batchAddress];
            if (batch.totalDebtShares == 0) return 0;
            return batch.debt * trove.batchDebtShares / batch.totalDebtShares;
        }
        return trove.debt;
    }

    function getTroveWeightedRecordedDebt(uint256 _troveId) external view returns (uint256) {
        Trove memory trove = Troves[_troveId];
        address batchAddress = _getBatchManager(trove);
        if (batchAddress != address(0)) {
            Batch memory batch = batches[batchAddress];
            if (batch.totalDebtShares == 0) return 0;
            return batch.debt * trove.batchDebtShares / batch.totalDebtShares * batch.annualInterestRate;
        }
        return trove.debt * trove.annualInterestRate;
    }

    function getTroveColl(uint256 _troveId) external view returns (uint256) {
        Trove memory trove = Troves[_troveId];
        return trove.coll;
    }

}
