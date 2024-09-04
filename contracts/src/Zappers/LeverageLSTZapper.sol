// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

import "../Interfaces/IBorrowerOperations.sol";
import "../Interfaces/IWETH.sol";
import "./GasCompZapper.sol";
import "../Dependencies/AddRemoveManagers.sol";
import "../Dependencies/Constants.sol";
import "./Interfaces/IFlashLoanProvider.sol";
import "./Interfaces/IFlashLoanReceiver.sol";
import "./Interfaces/IExchange.sol";
import "./Interfaces/ILeverageZapper.sol";

// import "forge-std/console2.sol";

contract LeverageLSTZapper is GasCompZapper, IFlashLoanReceiver, ILeverageZapper {
    using SafeERC20 for IERC20;

    IPriceFeed public immutable priceFeed;
    IFlashLoanProvider public immutable flashLoanProvider;
    IExchange public immutable exchange;

    uint256 private initialBoldBalance;
    uint256 private initialCollBalance;
    address private initialSender;

    constructor(IAddressesRegistry _addressesRegistry, IFlashLoanProvider _flashLoanProvider, IExchange _exchange)
        GasCompZapper(_addressesRegistry)
    {
        // Cache contracts
        IBorrowerOperations _borrowerOperations = borrowerOperations;
        IERC20 _collToken = collToken;
        IWETH _WETH = WETH;

        priceFeed = _addressesRegistry.priceFeed();

        flashLoanProvider = _flashLoanProvider;
        exchange = _exchange;

        // Approve Coll and Bold to exchange module
        _collToken.approve(address(_exchange), type(uint256).max);
        boldToken.approve(address(_exchange), type(uint256).max);
        // Approve WETH to BorrowerOperations
        _WETH.approve(address(_borrowerOperations), type(uint256).max);
        // Approve coll to BorrowerOperations
        _collToken.approve(address(_borrowerOperations), type(uint256).max);
    }

    struct OpenLeveragedTroveVars {
        uint256 troveId;
        IBorrowerOperations borrowerOperations;
        IERC20 collToken;
        uint256 boldAmount;
    }

    function openLeveragedTroveWithRawETH(OpenLeveragedTroveParams calldata _params) external payable {
        require(msg.value == ETH_GAS_COMPENSATION, "LZ: Wrong ETH");

        IERC20 collTokenCached = collToken;

        // Set initial balances to make sure there are not lefovers
        _setInitialBalances(collTokenCached);

        // Convert ETH to WETH
        WETH.deposit{value: msg.value}();

        // Pull own coll
        collTokenCached.safeTransferFrom(msg.sender, address(this), _params.collAmount);

        // Flash loan coll
        flashLoanProvider.makeFlashLoan(
            collTokenCached, _params.flashLoanAmount, IFlashLoanProvider.Operation.OpenTrove, abi.encode(_params)
        );
    }

    // Callback from the flash loan provider
    function receiveFlashLoanOnOpenLeveragedTrove(
        OpenLeveragedTroveParams calldata _params,
        uint256 _effectiveFlashLoanAmount
    ) external {
        require(msg.sender == address(flashLoanProvider), "LZ: Caller not FlashLoan provider");

        OpenLeveragedTroveVars memory vars;
        vars.borrowerOperations = borrowerOperations;
        vars.collToken = collToken;

        uint256 totalCollAmount = _params.collAmount + _effectiveFlashLoanAmount;
        // We compute boldAmount off-chain for efficiency

        // Open trove
        vars.troveId = vars.borrowerOperations.openTrove(
            _params.owner,
            _params.ownerIndex,
            totalCollAmount,
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

        // Set add/remove managers
        _setAddManager(vars.troveId, _params.addManager);
        _setRemoveManagerAndReceiver(vars.troveId, _params.removeManager, _params.receiver);

        // Swap Bold to Coll
        exchange.swapFromBold(_params.boldAmount, _params.flashLoanAmount, address(this));

        // Send coll back to return flash loan
        vars.collToken.safeTransfer(address(flashLoanProvider), _params.flashLoanAmount);

        // return leftovers to user
        _returnLeftovers(vars.collToken, boldToken);
    }

    function leverUpTrove(LeverUpTroveParams calldata _params) external {
        address owner = troveNFT.ownerOf(_params.troveId);
        _requireSenderIsOwnerOrRemoveManagerAndGetReceiver(_params.troveId, owner);

        IERC20 collTokenCached = collToken;

        // Set initial balances to make sure there are not lefovers
        _setInitialBalances(collTokenCached);

        // Flash loan coll
        flashLoanProvider.makeFlashLoan(
            collTokenCached, _params.flashLoanAmount, IFlashLoanProvider.Operation.LeverUpTrove, abi.encode(_params)
        );
    }

    // Callback from the flash loan provider
    function receiveFlashLoanOnLeverUpTrove(LeverUpTroveParams calldata _params, uint256 _effectiveFlashLoanAmount)
        external
    {
        require(msg.sender == address(flashLoanProvider), "LZ: Caller not FlashLoan provider");

        IERC20 collTokenCached = collToken;

        // Adjust trove
        // With the received coll from flash loan, we increase both the trove coll and debt
        borrowerOperations.adjustTrove(
            _params.troveId,
            _effectiveFlashLoanAmount, // flash loan amount minus fee
            true, // _isCollIncrease
            _params.boldAmount,
            true, // _isDebtIncrease
            _params.maxUpfrontFee
        );

        // Swap Bold to Coll
        // No need to use a min: if the obtained amount is not enough, the flash loan return below won’t be enough
        // And the flash loan provider will revert after this function exits
        // The frontend should calculate in advance the `_params.boldAmount` needed for this to work
        exchange.swapFromBold(_params.boldAmount, _params.flashLoanAmount, address(this));

        // Send coll back to return flash loan
        collTokenCached.safeTransfer(address(flashLoanProvider), _params.flashLoanAmount);

        // return leftovers to user
        _returnLeftovers(collTokenCached, boldToken);
    }

    function leverDownTrove(LeverDownTroveParams calldata _params) external {
        address owner = troveNFT.ownerOf(_params.troveId);
        _requireSenderIsOwnerOrRemoveManagerAndGetReceiver(_params.troveId, owner);

        IERC20 collTokenCached = collToken;

        // Set initial balances to make sure there are not lefovers
        _setInitialBalances(collTokenCached);

        // Flash loan coll
        flashLoanProvider.makeFlashLoan(
            collTokenCached, _params.flashLoanAmount, IFlashLoanProvider.Operation.LeverDownTrove, abi.encode(_params)
        );
    }

    // Callback from the flash loan provider
    function receiveFlashLoanOnLeverDownTrove(LeverDownTroveParams calldata _params, uint256 _effectiveFlashLoanAmount)
        external
    {
        require(msg.sender == address(flashLoanProvider), "LZ: Caller not FlashLoan provider");

        IERC20 collTokenCached = collToken;

        // Swap Coll from flash loan to Bold, so we can repay and downsize trove
        // We swap the flash loan minus the flash loan fee
        // The frontend should calculate in advance the `_params.minBoldAmount` to achieve the desired leverage ratio
        // (with some slippage tolerance)
        uint256 receivedBoldAmount =
            exchange.swapToBold(_effectiveFlashLoanAmount, _params.minBoldAmount, address(this));

        // Adjust trove
        borrowerOperations.adjustTrove(
            _params.troveId,
            _params.flashLoanAmount,
            false, // _isCollIncrease
            receivedBoldAmount,
            false, // _isDebtIncrease
            0
        );

        // Send coll back to return flash loan
        collTokenCached.safeTransfer(address(flashLoanProvider), _params.flashLoanAmount);

        // return leftovers to user
        _returnLeftovers(collTokenCached, boldToken);
    }

    function _setInitialBalances(IERC20 _collToken) internal {
        initialBoldBalance = boldToken.balanceOf(address(this));
        initialCollBalance = _collToken.balanceOf(address(this));
        initialSender = msg.sender;
    }

    function _returnLeftovers(IERC20 _collToken, IBoldToken _boldToken) internal {
        uint256 currentCollBalance = _collToken.balanceOf(address(this));
        if (currentCollBalance > initialCollBalance) {
            _collToken.transfer(initialSender, currentCollBalance - initialCollBalance);
        }
        uint256 currentBoldBalance = _boldToken.balanceOf(address(this));
        if (currentBoldBalance > initialBoldBalance) {
            _boldToken.transfer(initialSender, currentBoldBalance - initialBoldBalance);
        }
        initialSender = address(0);
    }

    // As formulas are symmetrical, it can be used in both ways
    function leverageRatioToCollateralRatio(uint256 _inputRatio) external pure returns (uint256) {
        return _inputRatio * DECIMAL_PRECISION / (_inputRatio - DECIMAL_PRECISION);
    }
}
