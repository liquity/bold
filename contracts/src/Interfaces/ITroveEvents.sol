// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

interface ITroveEvents {
    enum Operation {
        openTrove,
        closeTrove,
        adjustTrove,
        adjustTroveInterestRate,
        applyTroveInterestPermissionless,
        liquidate,
        redeemCollateral
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
        uint256 _attemptedBoldAmount, uint256 _actualBoldAmount, uint256 _ETHSent, uint256 _ETHFee, uint256 _price
    );

    // A snapshot of the Trove's latest state on-chain
    event TroveUpdated(
        uint256 indexed _troveId,
        uint256 _debt,
        uint256 _coll,
        uint256 _stake,
        uint256 _annualInterestRate,
        uint256 _snapshotOfTotalDebtRedist,
        uint256 _snapshotOfTotalCollRedist
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
}
