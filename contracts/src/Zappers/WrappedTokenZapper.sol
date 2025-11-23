// SPDX-License-Identifier: MIT

pragma solidity 0.8.23;

import "./BaseZapper.sol";
import "../Dependencies/Constants.sol";
import "../Interfaces/IWrappedToken.sol";
import "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract WrappedTokenZapper is BaseZapper {
    using SafeERC20 for IERC20;
    using SafeERC20 for IWrappedToken;

    IWrappedToken public immutable wrappedToken;

    IERC20 internal immutable _underlyingToken;

    uint256 internal immutable _decimalDiff;

    constructor(
        IWrappedToken _wrappedToken,
        IAddressesRegistry _addressesRegistry, 
        IFlashLoanProvider _flashLoanProvider, 
        IExchange _exchange
    )
        BaseZapper(_addressesRegistry, _flashLoanProvider, _exchange)
    {
        require(address(_wrappedToken) == address(_addressesRegistry.collToken()), "WTZ: Wrong coll branch");

        _underlyingToken = _wrappedToken.underlying();

        _decimalDiff = _wrappedToken.decimals() - IERC20Metadata(address(_underlyingToken)).decimals();

        wrappedToken = _wrappedToken;

        // Approve coll to BorrowerOperations
        _wrappedToken.approve(address(borrowerOperations), type(uint256).max);
        // Approve Coll to exchange module (for closeTroveFromCollateral)
        // _wrappedToken.approve(address(_exchange), type(uint256).max); // Not using exchange at the moment
    }

    function convertUnderlyingToWrapped(uint256 _amount) public view returns (uint256) {
        return _amount * 10**_decimalDiff;
    }
    
    function convertWrappedToUnderlying(uint256 _wrappedAmount) public view returns (uint256) {
        return _wrappedAmount / 10**_decimalDiff;
    }

    // The collAmount is the amount of underlying token. Its decimals will be converted to the wrapped token decimals.
    function openTroveWithRawETH(OpenTroveParams calldata _params) external payable returns (uint256) {
        // No need to check ETH_GAS_COMPENSATION as there is no gas on transactions on Saga EVM
        require(msg.value == 0, "WTZ: ETH not allowed");
        require(
            _params.batchManager == address(0) || _params.annualInterestRate == 0,
            "WTZ: Cannot choose interest if joining a batch"
        );

        // Transfer underlying token from user to this contract        
        _underlyingToken.safeTransferFrom(msg.sender, address(this), _params.collAmount);

        // Wrap underlying token to wrapped token
        _underlyingToken.approve(address(wrappedToken), _params.collAmount);
        wrappedToken.depositFor(address(this), _params.collAmount);
        
        uint256 wrappedCollAmount = convertUnderlyingToWrapped(_params.collAmount);

        // Approve coll to BorrowerOperations
        wrappedToken.approve(address(borrowerOperations), wrappedCollAmount);

        uint256 troveId;
        // Include sender in index
        uint256 index = _getTroveIndex(_params.ownerIndex);
        if (_params.batchManager == address(0)) {
            troveId = borrowerOperations.openTrove(
                _params.owner,
                index,
                wrappedCollAmount,
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
                    collAmount: wrappedCollAmount,
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

    /**
     * 
     * @param _troveId The trove ID
     * @param _amount The amount of underlying token to add. Its decimals will be converted to the wrapped token decimals.
     */
    function addCollWithRawETH(uint256 _troveId, uint256 _amount) external {
        address owner = troveNFT.ownerOf(_troveId);
        _requireSenderIsOwnerOrAddManager(_troveId, owner);

        // Transfer underlying token from user to this contract
        _underlyingToken.safeTransferFrom(msg.sender, address(this), _amount);

        // Wrap underlying token to wrapped token
        _underlyingToken.approve(address(wrappedToken), _amount);
        wrappedToken.depositFor(address(this), _amount);

        uint256 wrappedCollAmount = convertUnderlyingToWrapped(_amount);

        // Approve coll to BorrowerOperations
        wrappedToken.approve(address(borrowerOperations), wrappedCollAmount);

        borrowerOperations.addColl(_troveId, wrappedCollAmount);
    }

    /**
     * 
     * @param _troveId The trove ID
     * @param _amount The amount of underlying token to withdraw. Its decimals will be converted to the wrapped token decimals.
     */
    function withdrawCollToRawETH(uint256 _troveId, uint256 _amount) external {
        address owner = troveNFT.ownerOf(_troveId);
        address receiver = _requireSenderIsOwnerOrRemoveManagerAndGetReceiver(_troveId, owner);
        _requireZapperIsReceiver(_troveId);

        uint256 wrappedAmount = convertUnderlyingToWrapped(_amount);
        borrowerOperations.withdrawColl(_troveId, wrappedAmount);

        // Unwrap and send underlying token to receiver
        wrappedToken.withdrawTo(receiver, wrappedAmount);
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
        uint256 _collChange, // underlying token amount. Its decimals will be converted to the wrapped token decimals.
        bool _isCollIncrease,
        uint256 _boldChange,
        bool _isDebtIncrease,
        uint256 _maxUpfrontFee
    ) external payable {
        InitialBalances memory initialBalances;
        (address receiver, uint256 wrappedCollChange) =
            _adjustTrovePre(_troveId, _collChange, _isCollIncrease, _boldChange, _isDebtIncrease, initialBalances);
        borrowerOperations.adjustTrove(
            _troveId, wrappedCollChange, _isCollIncrease, _boldChange, _isDebtIncrease, _maxUpfrontFee
        );
        _adjustTrovePost(wrappedCollChange, _isCollIncrease, _boldChange, _isDebtIncrease, receiver, initialBalances);
    }

    function adjustZombieTroveWithRawETH(
        uint256 _troveId,
        uint256 _collChange, // underlying token amount. Its decimals will be converted to the wrapped token decimals.
        bool _isCollIncrease,
        uint256 _boldChange,
        bool _isDebtIncrease,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _maxUpfrontFee
    ) external payable {
        InitialBalances memory initialBalances;
        (address receiver, uint256 wrappedCollChange) =
            _adjustTrovePre(_troveId, _collChange, _isCollIncrease, _boldChange, _isDebtIncrease, initialBalances);
        borrowerOperations.adjustZombieTrove(
            _troveId, wrappedCollChange, _isCollIncrease, _boldChange, _isDebtIncrease, _upperHint, _lowerHint, _maxUpfrontFee
        );
        _adjustTrovePost(wrappedCollChange, _isCollIncrease, _boldChange, _isDebtIncrease, receiver, initialBalances);
    }

    function _adjustTrovePre(
        uint256 _troveId,
        uint256 _collChange, // underlying token amount. Its decimals will be converted to the wrapped token decimals.
        bool _isCollIncrease,
        uint256 _boldChange,
        bool _isDebtIncrease,
        InitialBalances memory _initialBalances
    ) internal returns (address receiver, uint256 wrappedCollChange) {
        wrappedCollChange = convertUnderlyingToWrapped(_collChange);

        receiver = _checkAdjustTroveManagers(_troveId, wrappedCollChange, _isCollIncrease, _isDebtIncrease);

        // Set initial balances to make sure there are not lefovers
        _setInitialTokensAndBalances(wrappedToken, boldToken, _initialBalances);

        // ETH -> WETH
        if (_isCollIncrease) {
            // Transfer underlying token from user to this contract        
            _underlyingToken.safeTransferFrom(msg.sender, address(this), _collChange);

            // Wrap underlying token to wrapped token
            _underlyingToken.approve(address(wrappedToken), _collChange);
            wrappedToken.depositFor(address(this), _collChange);

            // Approve coll to BorrowerOperations
            wrappedToken.approve(address(borrowerOperations), wrappedCollChange);
        }

        // Pull Bold
        if (!_isDebtIncrease) {
            boldToken.transferFrom(msg.sender, address(this), _boldChange);
        }

        return (receiver, wrappedCollChange);
    }

    function _adjustTrovePost(
        uint256 _wrappedCollChange, // wrapped token amount. Its decimals will be converted to the underlying token decimals.
        bool _isCollIncrease,
        uint256 _boldChange,
        bool _isDebtIncrease,
        address _receiver,
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

        // Wrapped token -> underlying token
        if (!_isCollIncrease && _wrappedCollChange > 0) {
            wrappedToken.withdrawTo(_receiver, _wrappedCollChange);
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

        // Unwrap and send underlying token to receiver
        wrappedToken.withdrawTo(receiver, trove.entireColl);
    }

    // TODO: Switch flashloan token and amount to underlying token.
    // Wrapped token will (most likely) only be used by the protocol.
    // This should be considered in a future implementation when wanting to enable this feature.
    function closeTroveFromCollateral(uint256 _troveId, uint256 _flashLoanAmount, uint256 _minExpectedCollateral)
        external
        override
    {
        address owner = troveNFT.ownerOf(_troveId);
        address receiver = _requireSenderIsOwnerOrRemoveManagerAndGetReceiver(_troveId, owner);
        _requireZapperIsReceiver(_troveId);

        CloseTroveParams memory params = CloseTroveParams({
            troveId: _troveId,
            flashLoanAmount: _flashLoanAmount,
            minExpectedCollateral: _minExpectedCollateral,
            receiver: receiver
        });

        // Set initial balances to make sure there are not lefovers
        InitialBalances memory initialBalances;
        initialBalances.tokens[0] = wrappedToken;
        initialBalances.tokens[1] = boldToken;
        _setInitialBalancesAndReceiver(initialBalances, receiver);

        // Flash loan coll
        flashLoanProvider.makeFlashLoan(
            wrappedToken, _flashLoanAmount, IFlashLoanProvider.Operation.CloseTrove, abi.encode(params)
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
        wrappedToken.safeTransfer(address(flashLoanProvider), _params.flashLoanAmount);

        // Unwrap and send coll left to receiver
        wrappedToken.withdrawTo(_params.receiver, collLeft);
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
