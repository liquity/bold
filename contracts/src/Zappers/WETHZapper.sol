pragma solidity ^0.8.18;

import "../Interfaces/IBorrowerOperations.sol";
import "../Interfaces/ITroveManager.sol";
import "../Interfaces/IWETH.sol";
import "../Dependencies/AddRemoveManagers.sol";
import "../Dependencies/Constants.sol";


contract WETHZapper is AddRemoveManagers {
    IBorrowerOperations public immutable borrowerOperations; // First branch (i.e., using WETH as collateral)
    IWETH public immutable WETH;
    IBoldToken public immutable boldToken;

    constructor(ITroveManager _troveManager) AddRemoveManagers(_troveManager) {
        IBorrowerOperations _borrowerOperations = IBorrowerOperations(_troveManager.borrowerOperationsAddress());
        borrowerOperations = _borrowerOperations;
        IWETH _WETH = _borrowerOperations.WETH();
        require(address(_WETH) == address(_borrowerOperations.collToken()), "WZ: Wrong coll branch");
        WETH = _WETH;
        boldToken = _borrowerOperations.boldToken();
    }

    function openTroveWithRawETH(
        address _owner,
        uint256 _ownerIndex,
        uint256 _boldAmount,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _annualInterestRate,
        uint256 _maxUpfrontFee
    ) external payable returns (uint256) {
        require(msg.value > ETH_GAS_COMPENSATION, "WZ: Insufficient ETH");

        // Convert ETH to WETH
        WETH.deposit{value: msg.value}();

        // Approve WETH to BorrowerOperations
        IBorrowerOperations borrowerOperationsCached = borrowerOperations;
        WETH.approve(address(borrowerOperationsCached), msg.value);

        uint256 troveId = borrowerOperationsCached.openTrove(
            address(this),
            _ownerIndex,
            msg.value - ETH_GAS_COMPENSATION,
            _boldAmount,
            _upperHint,
            _lowerHint,
            _annualInterestRate,
            _maxUpfrontFee
        );

        // Add this contract as add/receive manager to be able to fully adjust trove,
        // while keeping the same management functionality
        borrowerOperationsCached.setAddManager(troveId, address(this));
        borrowerOperationsCached.setRemoveManager(troveId, address(this), address(this));

        // Send trove to owner
        troveManager.transferFrom(address(this), _owner, troveId);

        boldToken.transfer(msg.sender, _boldAmount);

        return troveId;
    }

    // TODO: open trove and join batch

    function addCollWithRawETH(uint256 _troveId) external payable {
        address owner = troveManager.ownerOf(_troveId);
        _requireSenderIsOwnerOrAddManager(_troveId, owner);
        // Convert ETH to WETH
        WETH.deposit{value: msg.value}();

        // Approve WETH to BorrowerOperations
        IBorrowerOperations borrowerOperationsCached = borrowerOperations;
        WETH.approve(address(borrowerOperationsCached), msg.value);

        borrowerOperationsCached.addColl(_troveId, msg.value);
    }

    function withdrawCollToRawETH(uint256 _troveId, uint256 _amount) external {
        address owner = troveManager.ownerOf(_troveId);
        address payable receiver = payable(_requireSenderIsOwnerOrRemoveManager(_troveId, owner));

        borrowerOperations.withdrawColl(_troveId, _amount);

        // Convert WETH to ETH
        WETH.withdraw(_amount);
        (bool success, ) = receiver.call{value: _amount}("");
        require(success, "WZ: Sending ETH failed");
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
    ) external payable {
        if (_isCollIncrease) {
            require(_collChange == msg.value, "WZ: Wrong coll amount");
        } else {
            require(msg.value == 0, "WZ: Withdrawing coll, no ETH should be received");
        }
        require(!_isDebtIncrease || _boldChange > 0, "WZ: Increase bold amount should not be zero");

        address owner = troveManager.ownerOf(_troveId);
        address payable receiver = payable(owner);

        if (! _isCollIncrease || _isDebtIncrease) {
            receiver = payable(_requireSenderIsOwnerOrRemoveManager(_troveId, owner));
        }

        if (_isCollIncrease || (!_isDebtIncrease && _boldChange > 0)) {
            _requireSenderIsOwnerOrAddManager(_troveId, owner);
        }

        // ETH -> WETH
        if (_isCollIncrease) {
            WETH.deposit{value: _collChange}();
        }

        // TODO: version with Permit
        // Pull Bold
        if (!_isDebtIncrease) {
            boldToken.transferFrom(msg.sender, address(this), _boldChange);
        }

        borrowerOperations.adjustTrove(_troveId, _collChange, _isCollIncrease, _boldChange, _isDebtIncrease, _maxUpfrontFee);

        // WETH -> ETH
        if (!_isCollIncrease) {
            WETH.withdraw(_collChange);
            (bool success, ) = receiver.call{value: _collChange}("");
            require(success, "WZ: Sending ETH failed");
        }
        // Send Bold
        if (_isDebtIncrease) {
            boldToken.transfer(receiver, _boldChange);
        }
    }

    // TODO: adjust unredeemable trove

    // TODO: ETH_GAS_COMPENSATION?
    function closeTroveToRawETH(uint256 _troveId) external {
        address owner = troveManager.ownerOf(_troveId);
        address payable receiver = payable(_requireSenderIsOwnerOrRemoveManager(_troveId, owner));

        uint256 collLeft = borrowerOperations.closeTrove(_troveId);

        WETH.withdraw(collLeft);
        (bool success, ) = receiver.call{value: collLeft + ETH_GAS_COMPENSATION}("");
        require(success, "WZ: Sending ETH failed");
    }
}
