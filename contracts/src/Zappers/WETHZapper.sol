pragma solidity ^0.8.18;

import "../Interfaces/IBorrowerOperations.sol";
import "../Interfaces/ITroveManager.sol";
import "../Interfaces/IWETH.sol";
import "../Dependencies/AddRemoveManagers.sol";
import "../Dependencies/Constants.sol";

contract WETHZapper is AddRemoveManagers {
    ITroveManager public immutable troveManager;
    IBorrowerOperations public immutable borrowerOperations; // First branch (i.e., using WETH as collateral)
    IWETH public immutable WETH;
    IBoldToken public immutable boldToken;

    constructor(ITroveManager _troveManager) AddRemoveManagers(_troveManager) {
        troveManager = _troveManager;
        IBorrowerOperations _borrowerOperations = IBorrowerOperations(_troveManager.borrowerOperationsAddress());
        borrowerOperations = _borrowerOperations;
        IWETH _WETH = _borrowerOperations.WETH();
        require(address(_WETH) == address(_borrowerOperations.collToken()), "WZ: Wrong coll branch");
        WETH = _WETH;
        boldToken = _borrowerOperations.boldToken();
    }

    struct OpenTroveParams {
        address owner;
        uint256 ownerIndex;
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
    }

    function openTroveWithRawETH(OpenTroveParams calldata _params) external payable returns (uint256) {
        require(msg.value > ETH_GAS_COMPENSATION, "WZ: Insufficient ETH");

        OpenTroveVars memory vars;
        vars.borrowerOperations = borrowerOperations;
        vars.WETH = WETH;

        // Convert ETH to WETH
        vars.WETH.deposit{value: msg.value}();

        // Approve WETH to BorrowerOperations
        vars.WETH.approve(address(vars.borrowerOperations), msg.value);

        vars.troveId = vars.borrowerOperations.openTrove(
            _params.owner,
            _params.ownerIndex,
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

        boldToken.transfer(msg.sender, _params.boldAmount);

        return vars.troveId;
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
        (bool success,) = receiver.call{value: _amount}("");
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
        address payable receiver = _adjustTrovePre(_troveId, _collChange, _isCollIncrease, _boldChange, _isDebtIncrease);
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
        address payable receiver = _adjustTrovePre(_troveId, _collChange, _isCollIncrease, _boldChange, _isDebtIncrease);
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
    ) internal returns (address payable) {
        if (_isCollIncrease) {
            require(_collChange == msg.value, "WZ: Wrong coll amount");
        } else {
            require(msg.value == 0, "WZ: Withdrawing coll, no ETH should be received");
        }
        require(!_isDebtIncrease || _boldChange > 0, "WZ: Increase bold amount should not be zero");

        address owner = troveManager.ownerOf(_troveId);
        address payable receiver = payable(owner);

        if (!_isCollIncrease || _isDebtIncrease) {
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

        return receiver;
    }

    function _adjustTrovePost(
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _boldChange,
        bool _isDebtIncrease,
        address payable _receiver
    ) internal {
        // WETH -> ETH
        if (!_isCollIncrease) {
            WETH.withdraw(_collChange);
            (bool success,) = _receiver.call{value: _collChange}("");
            require(success, "WZ: Sending ETH failed");
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

        WETH.withdraw(collLeft + ETH_GAS_COMPENSATION);
        (bool success,) = receiver.call{value: collLeft + ETH_GAS_COMPENSATION}("");
        require(success, "WZ: Sending ETH failed");
    }

    receive() external payable {}
}
