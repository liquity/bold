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
        uint256 _liquidatedDebt, uint256 _liquidatedColl, uint256 _collGasCompensation, uint256 _boldGasCompensation
    );
    event Redemption(uint256 _attemptedBoldAmount, uint256 _actualBoldAmount, uint256 _ETHSent, uint256 _ETHFee);
    event TroveCreated(address indexed _owner, uint256 _troveId);
    event TroveUpdated(uint256 indexed _troveId, uint256 _debt, uint256 _coll, Operation _operation);
    event TroveLiquidated(uint256 indexed _troveId, uint256 _debt, uint256 _coll, Operation _operation);
    event TotalStakesUpdated(uint256 _newTotalStakes);
    event SystemSnapshotsUpdated(uint256 _totalStakesSnapshot, uint256 _totalCollateralSnapshot);
    event LTermsUpdated(uint256 _L_ETH, uint256 _L_boldDebt);
    event TroveSnapshotsUpdated(uint256 _L_ETH, uint256 _L_boldDebt);
    event TroveIndexUpdated(uint256 _troveId, uint256 _newIndex);
    event RedemptionFeePaidToTrove(uint256 indexed _troveId, uint256 _ETHFee);
}
