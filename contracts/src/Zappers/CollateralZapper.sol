// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "./BaseCollateralZapper.sol";
import "../Dependencies/Constants.sol";
import "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

// zapper for collaterals with no wrappers
contract CollateralZapper is BaseCollateralZapper {
    using SafeERC20 for IERC20;

    constructor(IAddressesRegistry _addressesRegistry, IERC20 _collateralToken)
        BaseCollateralZapper(_addressesRegistry, _collateralToken)
    {
        require(address(_collateralToken) == address(_addressesRegistry.collToken()), "WZ: Wrong coll branch");

        // Approve coll to BorrowerOperations
        _collateralToken.approve(address(borrowerOperations), type(uint256).max);

        // Approve WETH to BorrowerOperations
        WETH.approve(address(borrowerOperations), type(uint256).max);
    }

    receive() external payable {}

    // open a trove using the 18 decimals collateral token
    // wraps ETH into WETH for ETH_GAS_COMPENSATION
    function openTroveWithRawETH(OpenTroveParams calldata _params) external payable returns (uint256) {
        require(msg.value == ETH_GAS_COMPENSATION, "WZ: Insufficient ETH");
        require(
            _params.batchManager == address(0) || _params.annualInterestRate == 0,
            "WZ: Cannot choose interest if joining a batch"
        );

        // Convert ETH to WETH
        WETH.deposit{value: ETH_GAS_COMPENSATION}();

        // Pull wrapped coll
        IERC20(address(collateralToken)).safeTransferFrom(msg.sender, address(this), _params.collAmount);

        uint256 troveId;
        if (_params.batchManager == address(0)) {
            troveId = borrowerOperations.openTrove(
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
        } else {
            IBorrowerOperations.OpenTroveAndJoinInterestBatchManagerParams memory
                openTroveAndJoinInterestBatchManagerParams = IBorrowerOperations
                    .OpenTroveAndJoinInterestBatchManagerParams({
                    owner: _params.owner,
                    ownerIndex: _params.ownerIndex,
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

    // tokenAmount in underlying token decimals
    function addCollWithRawETH(uint256 _troveId, uint256 tokenAmount) external {
        address owner = troveNFT.ownerOf(_troveId);
        _requireSenderIsOwnerOrAddManager(_troveId, owner);

        // Pull wrapped coll
        IERC20(address(collateralToken)).safeTransferFrom(msg.sender, address(this), tokenAmount);
    
        borrowerOperations.addColl(_troveId, tokenAmount);
    }

    // _amount in 18 decimals
    function withdrawCollToRawETH(uint256 _troveId, uint256 _amount) external {
        address owner = troveNFT.ownerOf(_troveId);
        address receiver = _requireSenderIsOwnerOrRemoveManagerAndGetReceiver(_troveId, owner);

        borrowerOperations.withdrawColl(_troveId, _amount);

        // transfer to receiver 
        SafeERC20.safeTransfer(collateralToken, receiver, _amount);
    }

    function withdrawBold(uint256 _troveId, uint256 _boldAmount, uint256 _maxUpfrontFee) external {
        address owner = troveNFT.ownerOf(_troveId);
        address receiver = _requireSenderIsOwnerOrRemoveManagerAndGetReceiver(_troveId, owner);

        borrowerOperations.withdrawBold(_troveId, _boldAmount, _maxUpfrontFee);

        // Send Bold
        boldToken.transfer(receiver, _boldAmount);
    }

    function repayBold(uint256 _troveId, uint256 _boldAmount) external {
        address owner = troveNFT.ownerOf(_troveId);
        _requireSenderIsOwnerOrAddManager(_troveId, owner);

        // Set initial balances to make sure there are not lefovers
        InitialBalances memory initialBalances;
        _setInitialTokensAndBalances(IERC20(collateralToken), boldToken, initialBalances);

        // Pull Bold
        boldToken.transferFrom(msg.sender, address(this), _boldAmount);

        borrowerOperations.repayBold(_troveId, _boldAmount);

        // return leftovers to user
        _returnLeftovers(initialBalances);
    }

    function adjustTroveWithRawETH(
        uint256 _troveId,
        uint256 _collChange, // 18 decimals
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

        _adjustTrovePost(
            _collChange, _isCollIncrease, _boldChange, _isDebtIncrease, receiver, initialBalances
        );
    }

    // close a trove and unwrap collateral into token
    // unwrap ETH_GAS_COMPENSATION amount of WETH and trasfer ETH
    function closeTroveToRawETH(uint256 _troveId) external {
        address owner = troveNFT.ownerOf(_troveId);
        address payable receiver = payable(_requireSenderIsOwnerOrRemoveManagerAndGetReceiver(_troveId, owner));

        // pull Bold for repayment
        LatestTroveData memory trove = troveManager.getLatestTroveData(_troveId);
        boldToken.transferFrom(msg.sender, address(this), trove.entireDebt);

        borrowerOperations.closeTrove(_troveId);

        // transfer to receiver 
        SafeERC20.safeTransfer(collateralToken, receiver, trove.entireColl);

        // unwrap and sends ETH_GAS_COMPENSATION
        WETH.withdraw(ETH_GAS_COMPENSATION);
        (bool success,) = receiver.call{value: ETH_GAS_COMPENSATION}("");
        require(success, "WZ: Sending ETH failed");
    }

    function adjustZombieTroveWithRawETH(
        uint256 _troveId,
        uint256 _collChange, // 18 decimals
        bool _isCollIncrease,
        uint256 _boldChange,
        bool _isDebtIncrease,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _maxUpfrontFee
    ) external payable {
        InitialBalances memory initialBalances;
        address receiver =
            _adjustTrovePre(_troveId, _collChange, _isCollIncrease, _boldChange, _isDebtIncrease, initialBalances);

        borrowerOperations.adjustZombieTrove(
            _troveId,
            _collChange,
            _isCollIncrease,
            _boldChange,
            _isDebtIncrease,
            _upperHint,
            _lowerHint,
            _maxUpfrontFee
        );

        _adjustTrovePost(
            _collChange, _isCollIncrease, _boldChange, _isDebtIncrease, receiver, initialBalances
        );
    }

    function _adjustTrovePre(
        uint256 _troveId,
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _boldChange,
        bool _isDebtIncrease,
        InitialBalances memory _initialBalances
    ) internal returns (address) {
        address receiver =
            _checkAdjustTroveManagers(_troveId, _collChange, _isCollIncrease, _boldChange, _isDebtIncrease);

        // Set initial balances to make sure there are not lefovers
        _setInitialTokensAndBalances(collateralToken, boldToken, _initialBalances);

        if (_isCollIncrease) {
            // pull colll
            SafeERC20.safeTransferFrom(collateralToken, msg.sender, address(this), _collChange);
        } 

        // Pull Bold
        if (!_isDebtIncrease) {
            boldToken.transferFrom(msg.sender, address(this), _boldChange);
        }

        return receiver;
    }

    function _adjustTrovePost(
        uint256 _collChange, // in wrapped token (ie collateral) decimals (18)
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
        // But Collateral Token balance can be non-zero if someone accidentally send it to this contract

        // transfer leftover collateral
        if (!_isCollIncrease && _collChange > 0) {
            SafeERC20.safeTransfer(collateralToken, _receiver, _collChange);
        }
    }
}
