// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IStabilityPoolEvents {
    enum Operation {
        provideToSP,
        withdrawFromSP,
        claimAllCollGains
    }

    event StabilityPoolCollBalanceUpdated(uint256 _newBalance);
    event StabilityPoolBoldBalanceUpdated(uint256 _newBalance);

    event P_Updated(uint256 _P);
    event S_Updated(uint256 _S, uint256 _scale);
    event B_Updated(uint256 _B, uint256 _scale);
    event ScaleUpdated(uint256 _currentScale);

    event DepositUpdated(
        address indexed _depositor,
        uint256 _newDeposit,
        uint256 _stashedColl,
        uint256 _snapshotP,
        uint256 _snapshotS,
        uint256 _snapshotB,
        uint256 _snapshotScale
    );

    event DepositOperation(
        address indexed _depositor,
        Operation _operation,
        uint256 _depositLossSinceLastOperation,
        int256 _topUpOrWithdrawal,
        uint256 _yieldGainSinceLastOperation,
        uint256 _yieldGainClaimed,
        uint256 _ethGainSinceLastOperation,
        uint256 _ethGainClaimed
    );
}
