// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {DECIMAL_PRECISION, ONE_YEAR} from "src/Dependencies/Constants.sol";

using TroveMethods for Trove global;

struct Trove {
    uint256 coll;
    uint256 debt;
    uint256 interestRate;
    uint256 batchManagementRate;
    uint256 totalCollRedist;
    uint256 totalDebtRedist;
    // "Private"
    uint256 _pendingCollRedist;
    uint256 _pendingDebtRedist;
    uint256 _pendingInterest;
    uint256 _pendingBatchManagementFee;
}

library TroveMethods {
    // function clone(Trove memory trove) internal pure returns (Trove memory cloned) {
    //     cloned.coll = trove.coll;
    //     cloned.debt = trove.debt;
    //     cloned.interestRate = trove.interestRate;
    //     cloned._pendingCollRedist = trove._pendingCollRedist;
    //     cloned._pendingDebtRedist = trove._pendingDebtRedist;
    //     cloned._pendingInterest = trove._pendingInterest;
    // }

    function accrueInterest(Trove storage trove, uint256 timeDelta) internal returns (uint256 interest) {
        trove._pendingInterest += interest = trove.debt * trove.interestRate * timeDelta;
    }

    function accrueBatchManagementFee(Trove storage trove, uint256 timeDelta)
        internal
        returns (uint256 batchManagementFee)
    {
        trove._pendingBatchManagementFee += batchManagementFee = trove.debt * trove.batchManagementRate * timeDelta;
    }

    function redist(Trove memory trove, uint256 coll, uint256 debt) internal pure {
        trove._pendingCollRedist += coll;
        trove._pendingDebtRedist += debt;
    }

    function applyPendingRedist(Trove memory trove) internal pure {
        trove.coll += trove._pendingCollRedist;
        trove.debt += trove._pendingDebtRedist;

        trove.totalCollRedist += trove._pendingCollRedist;
        trove.totalDebtRedist += trove._pendingDebtRedist;

        trove._pendingCollRedist = 0;
        trove._pendingDebtRedist = 0;
    }

    function applyPendingInterest(Trove memory trove) internal pure {
        trove.debt += trove._pendingInterest / (ONE_YEAR * DECIMAL_PRECISION);
        trove._pendingInterest = 0;
    }

    function applyPendingBatchManagementFee(Trove memory trove) internal pure {
        trove.debt += trove._pendingBatchManagementFee / (ONE_YEAR * DECIMAL_PRECISION);
        trove._pendingBatchManagementFee = 0;
    }

    function applyPending(Trove memory trove) internal pure {
        trove.applyPendingRedist();
        trove.applyPendingInterest();
        trove.applyPendingBatchManagementFee();
    }
}
