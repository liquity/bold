// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

import "./BaseZapper.sol";
import "../Dependencies/Constants.sol";

contract GasCompZapper is BaseZapper {
    using SafeERC20 for IERC20;

    IERC20 public immutable collToken;

    constructor(IAddressesRegistry _addressesRegistry, IFlashLoanProvider _flashLoanProvider, IExchange _exchange)
        BaseZapper(_addressesRegistry, _flashLoanProvider, _exchange)
    {
        collToken = _addressesRegistry.collToken();
        require(address(WETH) != address(collToken), "GCZ: Wrong coll branch");

        // Approve WETH to BorrowerOperations
        WETH.approve(address(borrowerOperations), type(uint256).max);
        // Approve coll to BorrowerOperations
        collToken.approve(address(borrowerOperations), type(uint256).max);
        // Approve Coll to exchange module (for closeTroveFromCollateral)
        collToken.approve(address(_exchange), type(uint256).max);
    }

    function openTroveWithRawETH(OpenTroveParams calldata _params) external payable returns (uint256) {
        require(msg.value == ETH_GAS_COMPENSATION, "GCZ: Wrong ETH");
        require(
            _params.batchManager == address(0) || _params.annualInterestRate == 0,
            "GCZ: Cannot choose interest if joining a batch"
        );

        // Convert ETH to WETH
        WETH.deposit{value: msg.value}();

        // Pull coll
        collToken.safeTransferFrom(msg.sender, address(this), _params.collAmount);

        uint256 troveId;
        // Include sender in index
        uint256 index = _getTroveIndex(_params.ownerIndex);
        if (_params.batchManager == address(0)) {
            troveId = borrowerOperations.openTrove(
                _params.owner,
                index,
                _params.collAmount,
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
                    collAmount: _params.collAmount,
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

    function addColl(uint256 _troveId, uint256 _amount) external {
        address owner = troveNFT.ownerOf(_troveId);
        _requireSenderIsOwnerOrAddManager(_troveId, owner);

        IBorrowerOperations borrowerOperationsCached = borrowerOperations;

        // Pull coll
        collToken.safeTransferFrom(msg.sender, address(this), _amount);

        borrowerOperationsCached.addColl(_troveId, _amount);
    }

    function withdrawColl(uint256 _troveId, uint256 _amount) external {
        address owner = troveNFT.ownerOf(_troveId);
        address receiver = _requireSenderIsOwnerOrRemoveManagerAndGetReceiver(_troveId, owner);
        _requireZapperIsReceiver(_troveId);

        borrowerOperations.withdrawColl(_troveId, _amount);

        // Send coll left
        collToken.safeTransfer(receiver, _amount);
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
        _setInitialTokensAndBalances(collToken, boldToken, initialBalances);

        // Pull Bold
        boldToken.transferFrom(msg.sender, address(this), _boldAmount);

        borrowerOperations.repayBold(_troveId, _boldAmount);

        // return leftovers to user
        _returnLeftovers(initialBalances);
    }

    function adjustTrove(
        uint256 _troveId,
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _boldChange,
        bool _isDebtIncrease,
        uint256 _maxUpfrontFee
    ) external {
        InitialBalances memory initialBalances;
        address receiver =
            _adjustTrovePre(_troveId, _collChange, _isCollIncrease, _boldChange, _isDebtIncrease, initialBalances);
        borrowerOperations.adjustTrove(
            _troveId, _collChange, _isCollIncrease, _boldChange, _isDebtIncrease, _maxUpfrontFee
        );
        _adjustTrovePost(_collChange, _isCollIncrease, _boldChange, _isDebtIncrease, receiver, initialBalances);
    }

    function adjustZombieTrove(
        uint256 _troveId,
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _boldChange,
        bool _isDebtIncrease,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _maxUpfrontFee
    ) external {
        InitialBalances memory initialBalances;
        address receiver =
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
    ) internal returns (address) {
        address receiver = _checkAdjustTroveManagers(_troveId, _collChange, _isCollIncrease, _isDebtIncrease);

        // Set initial balances to make sure there are not lefovers
        _setInitialTokensAndBalances(collToken, boldToken, _initialBalances);

        // Pull coll
        if (_isCollIncrease) {
            collToken.safeTransferFrom(msg.sender, address(this), _collChange);
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
        address _receiver,
        InitialBalances memory _initialBalances
    ) internal {
        // Send coll left
        if (!_isCollIncrease) {
            collToken.safeTransfer(_receiver, _collChange);
        }

        // Send Bold
        if (_isDebtIncrease) {
            boldToken.transfer(_receiver, _boldChange);
        }

        // return leftovers to user
        _returnLeftovers(_initialBalances);
    }

    function closeTroveToRawETH(uint256 _troveId) external {
        address owner = troveNFT.ownerOf(_troveId);
        address payable receiver = payable(_requireSenderIsOwnerOrRemoveManagerAndGetReceiver(_troveId, owner));
        _requireZapperIsReceiver(_troveId);

        // pull Bold for repayment
        LatestTroveData memory trove = troveManager.getLatestTroveData(_troveId);
        boldToken.transferFrom(msg.sender, address(this), trove.entireDebt);

        borrowerOperations.closeTrove(_troveId);

        // Send coll left
        collToken.safeTransfer(receiver, trove.entireColl);

        // Send gas compensation
        WETH.withdraw(ETH_GAS_COMPENSATION);
        (bool success,) = receiver.call{value: ETH_GAS_COMPENSATION}("");
        require(success, "GCZ: Sending ETH failed");
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
        initialBalances.tokens[0] = collToken;
        initialBalances.tokens[1] = boldToken;
        _setInitialBalancesAndReceiver(initialBalances, receiver);

        // Flash loan coll
        flashLoanProvider.makeFlashLoan(
            collToken, _flashLoanAmount, IFlashLoanProvider.Operation.CloseTrove, abi.encode(params)
        );

        // return leftovers to user
        _returnLeftovers(initialBalances);
    }

    function receiveFlashLoanOnCloseTroveFromCollateral(
        CloseTroveParams calldata _params,
        uint256 _effectiveFlashLoanAmount
    ) external {
        require(msg.sender == address(flashLoanProvider), "GCZ: Caller not FlashLoan provider");

        LatestTroveData memory trove = troveManager.getLatestTroveData(_params.troveId);
        uint256 collLeft = trove.entireColl - _params.flashLoanAmount;
        require(collLeft >= _params.minExpectedCollateral, "GCZ: Not enough collateral received");

        // Swap Coll from flash loan to Bold, so we can repay and close trove
        // We swap the flash loan minus the flash loan fee
        exchange.swapToBold(_effectiveFlashLoanAmount, trove.entireDebt);

        // We asked for a min of entireDebt in swapToBold call above, so we don’t check again here:
        //uint256 receivedBoldAmount = exchange.swapToBold(_effectiveFlashLoanAmount, trove.entireDebt);
        //require(receivedBoldAmount >= trove.entireDebt, "GCZ: Not enough BOLD obtained to repay");

        borrowerOperations.closeTrove(_params.troveId);

        // Send coll back to return flash loan
        collToken.safeTransfer(address(flashLoanProvider), _params.flashLoanAmount);

        // Send coll left
        collToken.safeTransfer(_params.receiver, collLeft);

        // Send gas compensation
        WETH.withdraw(ETH_GAS_COMPENSATION);
        (bool success,) = _params.receiver.call{value: ETH_GAS_COMPENSATION}("");
        require(success, "GCZ: Sending ETH failed");
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
