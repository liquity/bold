// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface ITroveEvents {
    enum Operation {
        openTrove,
        closeTrove,
        adjustTrove,
        adjustTroveInterestRate,
        applyPendingDebt,
        liquidate,
        redeemCollateral,
        // batch management
        openTroveAndJoinBatch,
        setInterestBatchManager,
        removeFromBatch
    }

    event Liquidation(
        uint256 _debtOffsetBySP,
        uint256 _debtRedistributed,
        uint256 _boldGasCompensation,
        uint256 _collGasCompensation,
        uint256 _collSentToSP,
        uint256 _collRedistributed,
        uint256 _collSurplus,
        uint256 _L_ETH,
        uint256 _L_boldDebt,
        uint256 _price
    );

    event Redemption(
        uint256 _attemptedBoldAmount,
        uint256 _actualBoldAmount,
        uint256 _ETHSent,
        uint256 _ETHFee,
        uint256 _price,
        uint256 _redemptionPrice
    );

    // A snapshot of the Trove's latest state on-chain
    event TroveUpdated(
        uint256 indexed _troveId,
        uint256 _debt,
        uint256 _coll,
        uint256 _stake,
        uint256 _annualInterestRate,
        uint256 _snapshotOfTotalCollRedist,
        uint256 _snapshotOfTotalDebtRedist
    );

    // Details of an operation that modifies a Trove
    event TroveOperation(
        uint256 indexed _troveId,
        Operation _operation,
        uint256 _annualInterestRate,
        uint256 _debtIncreaseFromRedist,
        uint256 _debtIncreaseFromUpfrontFee,
        int256 _debtChangeFromOperation,
        uint256 _collIncreaseFromRedist,
        int256 _collChangeFromOperation
    );

    event RedemptionFeePaidToTrove(uint256 indexed _troveId, uint256 _ETHFee);

    // Batch management

    enum BatchOperation {
        registerBatchManager,
        lowerBatchManagerAnnualFee,
        setBatchManagerAnnualInterestRate,
        applyBatchInterestAndFee,
        joinBatch,
        exitBatch,
        // used when the batch is updated as a result of a Trove change inside the batch
        troveChange
    }

    event BatchUpdated(
        address indexed _interestBatchManager,
        BatchOperation _operation,
        uint256 _debt,
        uint256 _coll,
        uint256 _annualInterestRate,
        uint256 _annualManagementFee,
        uint256 _totalDebtShares,
        uint256 _debtIncreaseFromUpfrontFee
    );

    event BatchedTroveUpdated(
        uint256 indexed _troveId,
        address _interestBatchManager,
        uint256 _batchDebtShares,
        uint256 _coll,
        uint256 _stake,
        uint256 _snapshotOfTotalCollRedist,
        uint256 _snapshotOfTotalDebtRedist
    );
}
