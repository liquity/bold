pragma solidity ^0.8.18;

import "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

import "../Interfaces/IBorrowerOperations.sol";
import "../Interfaces/IWETH.sol";
import "../Dependencies/AddRemoveManagers.sol";
import "../Dependencies/Constants.sol";

contract GasCompZapper is AddRemoveManagers {
    using SafeERC20 for IERC20;

    IBorrowerOperations public immutable borrowerOperations; // LST branch (i.e., not WETH as collateral)
    IWETH public immutable WETH;
    IERC20 public immutable collToken;
    IBoldToken public immutable boldToken;

    constructor(ITroveManager _troveManager) AddRemoveManagers(_troveManager) {
        IBorrowerOperations _borrowerOperations = IBorrowerOperations(_troveManager.borrowerOperationsAddress());
        borrowerOperations = _borrowerOperations;
        IWETH _WETH = _borrowerOperations.WETH();
        IERC20 _collToken = _borrowerOperations.collToken();
        require(address(_WETH) != address(_collToken), "GCZ: Wrong coll branch");
        WETH = _WETH;
        collToken = _collToken;
        boldToken = _borrowerOperations.boldToken();
    }

    struct OpenTroveParams {
        address owner;
        uint256 ownerIndex;
        uint256 collAmount;
        uint256 boldAmount;
        uint256 upperHint;
        uint256 lowerHint;
        uint256 annualInterestRate;
        uint256 maxUpfrontFee;
    }

    struct OpenTroveVars {
        uint256 troveId;
        IBorrowerOperations borrowerOperations;
        IWETH WETH;
        IERC20 collToken;
    }

    function openTroveWithRawETH(OpenTroveParams calldata _params) external payable returns (uint256) {
        require(msg.value == ETH_GAS_COMPENSATION, "GCZ: Wrong ETH");

        OpenTroveVars memory vars;
        vars.borrowerOperations = borrowerOperations;
        vars.WETH = WETH;
        vars.collToken = collToken;

        // Convert ETH to WETH
        vars.WETH.deposit{value: msg.value}();

        // Approve WETH to BorrowerOperations
        vars.WETH.approve(address(vars.borrowerOperations), msg.value);

        // Pull and approve coll
        vars.collToken.safeTransferFrom(msg.sender, address(this), _params.collAmount);
        vars.collToken.approve(address(vars.borrowerOperations), _params.collAmount);

        vars.troveId = vars.borrowerOperations.openTrove(
            _params.owner,
            _params.ownerIndex,
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

        boldToken.transfer(msg.sender, _params.boldAmount);

        return vars.troveId;
    }

    // TODO: open trove and join batch

    function addColl(uint256 _troveId, uint256 _amount) external {
        address owner = troveManager.ownerOf(_troveId);
        _requireSenderIsOwnerOrAddManager(_troveId, owner);

        IBorrowerOperations borrowerOperationsCached = borrowerOperations;

        // Pull and approve coll
        IERC20 collTokenCached = collToken;
        collTokenCached.safeTransferFrom(msg.sender, address(this), _amount);
        collTokenCached.approve(address(borrowerOperationsCached), _amount);

        borrowerOperationsCached.addColl(_troveId, _amount);
    }

    function withdrawColl(uint256 _troveId, uint256 _amount) external {
        address owner = troveManager.ownerOf(_troveId);
        address receiver = _requireSenderIsOwnerOrRemoveManager(_troveId, owner);

        borrowerOperations.withdrawColl(_troveId, _amount);

        // Send coll left
        collToken.safeTransfer(receiver, _amount);
    }

    function withdrawBold(uint256 _troveId, uint256 _boldAmount, uint256 _maxUpfrontFee) external {
        address owner = troveManager.ownerOf(_troveId);
        address receiver = _requireSenderIsOwnerOrRemoveManager(_troveId, owner);

        borrowerOperations.withdrawBold(_troveId, _boldAmount, _maxUpfrontFee);

        // Send Bold
        boldToken.transfer(receiver, _boldAmount);
    }

    function repayBold(uint256 _troveId, uint256 _boldAmount) external {
        address owner = troveManager.ownerOf(_troveId);
        _requireSenderIsOwnerOrAddManager(_troveId, owner);

        // Pull Bold
        boldToken.transferFrom(msg.sender, address(this), _boldAmount);

        borrowerOperations.repayBold(_troveId, _boldAmount);
    }

    function adjustTroveWithRawETH(
        uint256 _troveId,
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _boldChange,
        bool _isDebtIncrease,
        uint256 _maxUpfrontFee
    ) external {
        address receiver = _adjustTrovePre(_troveId, _collChange, _isCollIncrease, _boldChange, _isDebtIncrease);
        borrowerOperations.adjustTrove(
            _troveId, _collChange, _isCollIncrease, _boldChange, _isDebtIncrease, _maxUpfrontFee
        );
        _adjustTrovePost(_collChange, _isCollIncrease, _boldChange, _isDebtIncrease, receiver);
    }

    function adjustUnredeemableTroveWithRawETH(
        uint256 _troveId,
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _boldChange,
        bool _isDebtIncrease,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _maxUpfrontFee
    ) external {
        address receiver = _adjustTrovePre(_troveId, _collChange, _isCollIncrease, _boldChange, _isDebtIncrease);
        borrowerOperations.adjustUnredeemableTrove(
            _troveId, _collChange, _isCollIncrease, _boldChange, _isDebtIncrease, _upperHint, _lowerHint, _maxUpfrontFee
        );
        _adjustTrovePost(_collChange, _isCollIncrease, _boldChange, _isDebtIncrease, receiver);
    }

    function _adjustTrovePre(
        uint256 _troveId,
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _boldChange,
        bool _isDebtIncrease
    ) internal returns (address) {
        address owner = troveManager.ownerOf(_troveId);
        address receiver = owner;

        if (!_isCollIncrease || _isDebtIncrease) {
            receiver = _requireSenderIsOwnerOrRemoveManager(_troveId, owner);
        }

        if (_isCollIncrease || (!_isDebtIncrease && _boldChange > 0)) {
            _requireSenderIsOwnerOrAddManager(_troveId, owner);
        }

        // Pull and approve coll
        if (_isCollIncrease) {
            IERC20 collTokenCached = collToken;
            collTokenCached.safeTransferFrom(msg.sender, address(this), _collChange);
            collTokenCached.approve(address(borrowerOperations), _collChange);
        }

        // TODO: version with Permit
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
        address _receiver
    ) internal {
        // Send coll left
        if (!_isCollIncrease) {
            collToken.safeTransfer(_receiver, _collChange);
        }

        // Send Bold
        if (_isDebtIncrease) {
            boldToken.transfer(_receiver, _boldChange);
        }
    }

    function closeTroveToRawETH(uint256 _troveId) external {
        address owner = troveManager.ownerOf(_troveId);
        address payable receiver = payable(_requireSenderIsOwnerOrRemoveManager(_troveId, owner));

        // pull Bold for repayment
        boldToken.transferFrom(msg.sender, address(this), troveManager.getTroveEntireDebt(_troveId));

        uint256 collLeft = borrowerOperations.closeTrove(_troveId);

        // Send coll left
        collToken.safeTransfer(receiver, collLeft);

        // Send gas compensation
        WETH.withdraw(ETH_GAS_COMPENSATION);
        (bool success,) = receiver.call{value: ETH_GAS_COMPENSATION}("");
        require(success, "GCZ: Sending ETH failed");
    }

    receive() external payable {}
}
