// optimizing summaries
methods {
    function SafeERC20._callOptionalReturn(address token, bytes memory data) internal => NONDET;
    // contributes to non-linearity
    function _.fetchPrice() external => NONDET;
    // non-linearity, should be something at least current debt, if interest >= 1
    // function TroveManager.calcTroveAccruedInterest(uint256 _troveId) internal returns (uint256) => NONDET;
    // depepnds on 2 state variables totalStakesSnapshot / totalCollateralSnapshot
    function TroveManager._computeNewStake(uint _coll) internal returns (uint) => NONDET;

    // // Y.E. this function is doing a lot of logic - nondetting is unsound here
    // function BorrowerOperations.addColl(uint256 _troveId, uint256 _collAmount) external => NONDET;

    // not marked as view but it is almost one... updates a single state field lastBoldLossError_Offset
    function StabilityPool._computeCollRewardsPerUnitStaked(
        uint _collToAdd,
        uint _debtToOffset,
        uint _totalBoldDeposits
    ) internal returns (uint, uint) => NONDET;

    // I think it's okay to ignore gas compensations in the first step
    function TroveManager._sendGasCompensation(address _activePool, address _liquidator, uint _bold, uint _ETH) internal => NONDET;

    // safeTransfer* leads to some overhead
    function _.safeTransfer(address a, uint256 x) internal with (env e) => transferCVL(calledContract, e.msg.sender, a, x) expect bool;
    function _.safeTransferFrom(address a, address b, uint256 x) internal with (env e) => transferFromCVL(calledContract, e.msg.sender, a, b, x) expect bool;


    // function SortedTroves.insertIntoBatch(
    //     uint256 _troveId,
    //     SortedTroves.BatchId _batchId,
    //     uint256 _annualInterestRate,
    //     uint256 _prevId,
    //     uint256 _nextId
    // ) external => NONDET;

    // function SortedTroves.insert(uint256 _id, uint256 _annualInterestRate, uint256 _prevId, uint256 _nextId) external => NONDET;

    function SortedTroves._ external => NONDET;

}

