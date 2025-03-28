// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import "openzeppelin-contracts/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "./Dependencies/Owned.sol";
import "./Interfaces/IBoldToken.sol";

/*
 * --- Functionality added specific to the BoldToken ---
 *
 * 1) Transfer protection: blacklist of addresses that are invalid recipients (i.e. core Liquity contracts) in external
 * transfer() and transferFrom() calls. The purpose is to protect users from losing tokens by mistakenly sending BOLD directly to a Liquity
 * core contract, when they should rather call the right function.
 *
 * 2) sendToPool() and returnFromPool(): functions callable only Liquity core contracts, which move BOLD tokens between Liquity <-> user.
 */
contract BoldToken is Owned, IBoldToken, ERC20Permit {
    string internal constant _NAME = "BOLD Stablecoin";
    string internal constant _SYMBOL = "BOLD";

    // --- Addresses ---

    address public collateralRegistryAddress;
    mapping(address => bool) public isMinter;
    mapping(address => bool) public isBurner;
    mapping(address => bool) public isStabilityPool;

    // --- Events ---
    event MinterSet(address _newMinter, bool _isMinter);
    event BurnerSet(address _newBurner, bool _isBurner);
    event StabilityPoolSet(address _newStabilityPool, bool _isStabilityPool);
    event CollateralRegistryAddressChanged(address _newCollateralRegistryAddress);

    // --- Errors ---
    error AlreadyInitialised();

    // --- Constructor ---
    constructor(address _owner) Owned(_owner) ERC20(_NAME, _SYMBOL) ERC20Permit(_NAME) {}

    // --- Setters ---
    function setMinter(address _minter, bool _isMinter) external onlyOwner {
        isMinter[_minter] = _isMinter;
        emit MinterSet(_minter, _isMinter);
    }

    function setBurner(address _burner, bool _isBurner) external onlyOwner {
        isBurner[_burner] = _isBurner;
        emit BurnerSet(_burner, _isBurner);
    }

    function setStabilityPool(address _stabilityPool, bool _isStabilityPool) external onlyOwner {
        isStabilityPool[_stabilityPool] = _isStabilityPool;
        emit StabilityPoolSet(_stabilityPool, _isStabilityPool);
    }

    function setCollateralRegistry(address _collateralRegistryAddress) external onlyOwner {
        if (collateralRegistryAddress != address(0)) {
            revert AlreadyInitialised();
        }

        collateralRegistryAddress = _collateralRegistryAddress;
        emit CollateralRegistryAddressChanged(_collateralRegistryAddress);
    }

    // --- Functions for intra-Liquity calls ---

    function mint(address _account, uint256 _amount) external override {
        _requireCallerIsMinter();
        _mint(_account, _amount);
    }

    function burn(address _account, uint256 _amount) external override {
        _requireCallerIsBurner();
        _burn(_account, _amount);
    }

    function sendToPool(address _sender, address _poolAddress, uint256 _amount) external override {
        _requireCallerIsStabilityPool();
        _transfer(_sender, _poolAddress, _amount);
    }

    function returnFromPool(address _poolAddress, address _receiver, uint256 _amount) external override {
        _requireCallerIsStabilityPool();
        _transfer(_poolAddress, _receiver, _amount);
    }

    // --- External functions ---

    function transfer(address recipient, uint256 amount) public override(ERC20, IERC20) returns (bool) {
        _requireValidRecipient(recipient);
        return super.transfer(recipient, amount);
    }

    function transferFrom(address sender, address recipient, uint256 amount)
        public
        override(ERC20, IERC20)
        returns (bool)
    {
        _requireValidRecipient(recipient);
        return super.transferFrom(sender, recipient, amount);
    }

    // --- 'require' functions ---

    function _requireValidRecipient(address _recipient) internal view {
        require(
            _recipient != address(0) && _recipient != address(this),
            "BoldToken: Cannot transfer tokens directly to the Bold token contract or the zero address"
        );
    }

    function _requireCallerIsMinter() internal view {
        require(isMinter[msg.sender], "BoldToken: Caller is not a minter");
    }

    function _requireCallerIsBurner() internal view {
        require(msg.sender == collateralRegistryAddress || isBurner[msg.sender], "Bold: Caller is not a burner");
    }

    function _requireCallerIsStabilityPool() internal view {
        require(isStabilityPool[msg.sender], "BoldToken: Caller is not the StabilityPool");
    }
}
