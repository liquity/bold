// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "./BaseZapper.sol";
import "../Dependencies/Constants.sol";

contract WETHZapper is BaseZapper {
    constructor(IAddressesRegistry _addressesRegistry, IFlashLoanProvider _flashLoanProvider, IExchange _exchange)
        BaseZapper(_addressesRegistry, _flashLoanProvider, _exchange)
    {
        require(address(WETH) == address(_addressesRegistry.collToken()), "WZ: Wrong coll branch");

        // Approve coll to BorrowerOperations
        WETH.approve(address(borrowerOperations), type(uint256).max);
        // Approve Coll to exchange module (for closeTroveFromCollateral)
        WETH.approve(address(_exchange), type(uint256).max);
    }

    function openTroveWithRawETH(OpenTroveParams calldata _params) external payable returns (uint256) {
        require(msg.value > ETH_GAS_COMPENSATION, "WZ: Insufficient ETH");
        require(
            _params.batchManager == address(0) || _params.annualInterestRate == 0,
            "WZ: Cannot choose interest if joining a batch"
        );

        // Convert ETH to WETH
        WETH.deposit{value: msg.value}();

        uint256 troveId;
        // Include sender in index
        uint256 index = _getTroveIndex(_params.ownerIndex);
        if (_params.batchManager == address(0)) {
            troveId = borrowerOperations.openTrove(
                _params.owner,
                index,
                msg.value - ETH_GAS_COMPENSATION,
                _params.boldAmount,
                _params.upperHint,
                _params.lowerHint,
                _params.annualInterestRate,
                _params.maxUpfrontFee,
                // Add this contract as add/receive manager to be able to fully adjust trove,
                // while keeping the same management functionality
                address(this), // add manager
                address(this), // remove manager
                address(this) // receiver for remove manager
            );
        } else {
            IBorrowerOperations.OpenTroveAndJoinInterestBatchManagerParams memory
                openTroveAndJoinInterestBatchManagerParams = IBorrowerOperations
                    .OpenTroveAndJoinInterestBatchManagerParams({
                    owner: _params.owner,
                    ownerIndex: index,
                    collAmount: msg.value - ETH_GAS_COMPENSATION,
                    boldAmount: _params.boldAmount,
                    upperHint: _params.upperHint,
                    lowerHint: _params.lowerHint,
                    interestBatchManager: _params.batchManager,
                    maxUpfrontFee: _params.maxUpfrontFee,
                    // Add this contract as add/receive manager to be able to fully adjust trove,
                    // while keeping the same management functionality
                    addManager: address(this), // add manager
                    removeManager: address(this), // remove manager
                    receiver: address(this) // receiver for remove manager
                });
            troveId =
                borrowerOperations.openTroveAndJoinInterestBatchManager(openTroveAndJoinInterestBatchManagerParams);
        }

        boldToken.transfer(msg.sender, _params.boldAmount);

        // Set add/remove managers
        _setAddManager(troveId, _params.addManager);
        _setRemoveManagerAndReceiver(troveId, _params.removeManager, _params.receiver);

        return troveId;
    }

    function addCollWithRawETH(uint256 _troveId) external payable {
        address owner = troveNFT.ownerOf(_troveId);
        _requireSenderIsOwnerOrAddManager(_troveId, owner);
        // Convert ETH to WETH
        WETH.deposit{value: msg.value}();

        borrowerOperations.addColl(_troveId, msg.value);
    }

    function withdrawCollToRawETH(uint256 _troveId, uint256 _amount) external {
        address owner = troveNFT.ownerOf(_troveId);
        address payable receiver = payable(_requireSenderIsOwnerOrRemoveManagerAndGetReceiver(_troveId, owner));
        _requireZapperIsReceiver(_troveId);

        borrowerOperations.withdrawColl(_troveId, _amount);

        // Convert WETH to ETH
        WETH.withdraw(_amount);
        (bool success,) = receiver.call{value: _amount}("");
        require(success, "WZ: Sending ETH failed");
    }

    function withdrawBold(uint256 _troveId, uint256 _boldAmount, uint256 _maxUpfrontFee) external {
        address owner = troveNFT.ownerOf(_troveId);
        address receiver = _requireSenderIsOwnerOrRemoveManagerAndGetReceiver(_troveId, owner);
        _requireZapperIsReceiver(_troveId);

        borrowerOperations.withdrawBold(_troveId, _boldAmount, _maxUpfrontFee);

        // Send Bold
        boldToken.transfer(receiver, _boldAmount);
    }

    function repayBold(uint256 _troveId, uint256 _boldAmount) external {
        address owner = troveNFT.ownerOf(_troveId);
        _requireSenderIsOwnerOrAddManager(_troveId, owner);

        // Set initial balances to make sure there are not lefovers
        InitialBalances memory initialBalances;
        _setInitialTokensAndBalances(WETH, boldToken, initialBalances);

        // Pull Bold
        boldToken.transferFrom(msg.sender, address(this), _boldAmount);

        borrowerOperations.repayBold(_troveId, _boldAmount);

        // return leftovers to user
        _returnLeftovers(initialBalances);
    }

    function adjustTroveWithRawETH(
        uint256 _troveId,
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _boldChange,
        bool _isDebtIncrease,
        uint256 _maxUpfrontFee
    ) external payable {
        InitialBalances memory initialBalances;
        address payable receiver =
            _adjustTrovePre(_troveId, _collChange, _isCollIncrease, _boldChange, _isDebtIncrease, initialBalances);
        borrowerOperations.adjustTrove(
            _troveId, _collChange, _isCollIncrease, _boldChange, _isDebtIncrease, _maxUpfrontFee
        );
        _adjustTrovePost(_collChange, _isCollIncrease, _boldChange, _isDebtIncrease, receiver, initialBalances);
    }

    function adjustZombieTroveWithRawETH(
        uint256 _troveId,
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _boldChange,
        bool _isDebtIncrease,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _maxUpfrontFee
    ) external payable {
        InitialBalances memory initialBalances;
        address payable receiver =
            _adjustTrovePre(_troveId, _collChange, _isCollIncrease, _boldChange, _isDebtIncrease, initialBalances);
        borrowerOperations.adjustZombieTrove(
            _troveId, _collChange, _isCollIncrease, _boldChange, _isDebtIncrease, _upperHint, _lowerHint, _maxUpfrontFee
        );
        _adjustTrovePost(_collChange, _isCollIncrease, _boldChange, _isDebtIncrease, receiver, initialBalances);
    }

    function _adjustTrovePre(
        uint256 _troveId,
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _boldChange,
        bool _isDebtIncrease,
        InitialBalances memory _initialBalances
    ) internal returns (address payable) {
        if (_isCollIncrease) {
            require(_collChange == msg.value, "WZ: Wrong coll amount");
        } else {
            require(msg.value == 0, "WZ: Not adding coll, no ETH should be received");
        }

        address payable receiver =
            payable(_checkAdjustTroveManagers(_troveId, _collChange, _isCollIncrease, _isDebtIncrease));

        // Set initial balances to make sure there are not lefovers
        _setInitialTokensAndBalances(WETH, boldToken, _initialBalances);

        // ETH -> WETH
        if (_isCollIncrease) {
            WETH.deposit{value: _collChange}();
        }

        // Pull Bold
        if (!_isDebtIncrease) {
            boldToken.transferFrom(msg.sender, address(this), _boldChange);
        }

        return receiver;
    }

    function _adjustTrovePost(
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _boldChange,
        bool _isDebtIncrease,
        address payable _receiver,
        InitialBalances memory _initialBalances
    ) internal {
        // Send Bold
        if (_isDebtIncrease) {
            boldToken.transfer(_receiver, _boldChange);
        }

        // return BOLD leftovers to user (trying to repay more than possible)
        uint256 currentBoldBalance = boldToken.balanceOf(address(this));
        if (currentBoldBalance > _initialBalances.balances[1]) {
            boldToken.transfer(_initialBalances.receiver, currentBoldBalance - _initialBalances.balances[1]);
        }
        // There shouldn’t be Collateral leftovers, everything sent should end up in the trove
        // But ETH and WETH balance can be non-zero if someone accidentally send it to this contract

        // WETH -> ETH
        if (!_isCollIncrease && _collChange > 0) {
            WETH.withdraw(_collChange);
            (bool success,) = _receiver.call{value: _collChange}("");
            require(success, "WZ: Sending ETH failed");
        }
    }

    function closeTroveToRawETH(uint256 _troveId) external {
        address owner = troveNFT.ownerOf(_troveId);
        address payable receiver = payable(_requireSenderIsOwnerOrRemoveManagerAndGetReceiver(_troveId, owner));
        _requireZapperIsReceiver(_troveId);

        // pull Bold for repayment
        LatestTroveData memory trove = troveManager.getLatestTroveData(_troveId);
        boldToken.transferFrom(msg.sender, address(this), trove.entireDebt);

        borrowerOperations.closeTrove(_troveId);

        WETH.withdraw(trove.entireColl + ETH_GAS_COMPENSATION);
        (bool success,) = receiver.call{value: trove.entireColl + ETH_GAS_COMPENSATION}("");
        require(success, "WZ: Sending ETH failed");
    }

    function closeTroveFromCollateral(uint256 _troveId, uint256 _flashLoanAmount, uint256 _minExpectedCollateral)
        external
        override
    {
        address owner = troveNFT.ownerOf(_troveId);
        address payable receiver = payable(_requireSenderIsOwnerOrRemoveManagerAndGetReceiver(_troveId, owner));
        _requireZapperIsReceiver(_troveId);

        CloseTroveParams memory params = CloseTroveParams({
            troveId: _troveId,
            flashLoanAmount: _flashLoanAmount,
            minExpectedCollateral: _minExpectedCollateral,
            receiver: receiver
        });

        // Set initial balances to make sure there are not lefovers
        InitialBalances memory initialBalances;
        initialBalances.tokens[0] = WETH;
        initialBalances.tokens[1] = boldToken;
        _setInitialBalancesAndReceiver(initialBalances, receiver);

        // Flash loan coll
        flashLoanProvider.makeFlashLoan(
            WETH, _flashLoanAmount, IFlashLoanProvider.Operation.CloseTrove, abi.encode(params)
        );

        // return leftovers to user
        _returnLeftovers(initialBalances);
    }

    function receiveFlashLoanOnCloseTroveFromCollateral(
        CloseTroveParams calldata _params,
        uint256 _effectiveFlashLoanAmount
    ) external {
        require(msg.sender == address(flashLoanProvider), "WZ: Caller not FlashLoan provider");

        LatestTroveData memory trove = troveManager.getLatestTroveData(_params.troveId);
        uint256 collLeft = trove.entireColl - _params.flashLoanAmount;
        require(collLeft >= _params.minExpectedCollateral, "WZ: Not enough collateral received");

        // Swap Coll from flash loan to Bold, so we can repay and close trove
        // We swap the flash loan minus the flash loan fee
        exchange.swapToBold(_effectiveFlashLoanAmount, trove.entireDebt);

        // We asked for a min of entireDebt in swapToBold call above, so we don’t check again here:
        // uint256 receivedBoldAmount = exchange.swapToBold(_effectiveFlashLoanAmount, trove.entireDebt);
        //require(receivedBoldAmount >= trove.entireDebt, "WZ: Not enough BOLD obtained to repay");

        borrowerOperations.closeTrove(_params.troveId);

        // Send coll back to return flash loan
        WETH.transfer(address(flashLoanProvider), _params.flashLoanAmount);

        uint256 ethToSendBack = collLeft + ETH_GAS_COMPENSATION;
        // Send coll left and gas compensation
        WETH.withdraw(ethToSendBack);
        (bool success,) = _params.receiver.call{value: ethToSendBack}("");
        require(success, "WZ: Sending ETH failed");
    }

    receive() external payable {}

    // Unimplemented flash loan receive functions for leverage
    function receiveFlashLoanOnOpenLeveragedTrove(
        ILeverageZapper.OpenLeveragedTroveParams calldata _params,
        uint256 _effectiveFlashLoanAmount
    ) external virtual override {}
    function receiveFlashLoanOnLeverUpTrove(
        ILeverageZapper.LeverUpTroveParams calldata _params,
        uint256 _effectiveFlashLoanAmount
    ) external virtual override {}
    function receiveFlashLoanOnLeverDownTrove(
        ILeverageZapper.LeverDownTroveParams calldata _params,
        uint256 _effectiveFlashLoanAmount
    ) external virtual override {}
}
