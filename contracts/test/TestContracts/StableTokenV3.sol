// // SPDX-License-Identifier: GPL-3.0-or-later
// // solhint-disable gas-custom-errors
pragma solidity 0.8.24;

import { ERC20PermitUpgradeable } from "./patched/ERC20PermitUpgradeable.sol";
import { ERC20Upgradeable } from "./patched/ERC20Upgradeable.sol";

import { IStableTokenV3 } from "src/Interfaces/IStableTokenV3.sol";


contract CalledByVm {
  modifier onlyVm() {
    require(msg.sender == address(0), "Only VM can call");
    _;
  }
}

/**
 * @title ERC20 token with minting and burning permissiones to a minter and burner roles.
 * Direct transfers between the protocol and the user are done by the operator role.
 */
contract StableTokenV3 is ERC20PermitUpgradeable, IStableTokenV3, CalledByVm {
  /* ========================================================= */
  /* ==================== State Variables ==================== */
  /* ========================================================= */

  // Deprecated storage slots for backwards compatibility with StableTokenV2
  // slither-disable-start constable-states
  // solhint-disable-next-line var-name-mixedcase
  address public deprecated_validators_storage_slot__;
  // solhint-disable-next-line var-name-mixedcase
  address public deprecated_broker_storage_slot__;
  // solhint-disable-next-line var-name-mixedcase
  address public deprecated_exchange_storage_slot__;
  // slither-disable-end constable-states

  // Mapping of allowed addresses that can mint
  mapping(address => bool) public isMinter;
  // Mapping of allowed addresses that can burn
  mapping(address => bool) public isBurner;
  // Mapping of allowed addresses that can call the operator functions
  // These functions are used to do direct transfers between the protocol and the user
  // This will be the StabilityPools
  mapping(address => bool) public isOperator;

  /* ========================================================= */
  /* ======================== Events ========================= */
  /* ========================================================= */

  event MinterUpdated(address indexed minter, bool isMinter);
  event BurnerUpdated(address indexed burner, bool isBurner);
  event OperatorUpdated(address indexed operator, bool isOperator);

  /* ========================================================= */
  /* ====================== Modifiers ======================== */
  /* ========================================================= */

  /// @dev Restricts a function so it can only be executed by an address that's allowed to mint.
  modifier onlyMinter() {
    address sender = _msgSender();
    require(isMinter[sender], "StableTokenV3: not allowed to mint");
    _;
  }

  /// @dev Restricts a function so it can only be executed by an address that's allowed to burn.
  modifier onlyBurner() {
    address sender = _msgSender();
    require(isBurner[sender], "StableTokenV3: not allowed to burn");
    _;
  }

  /// @dev Restricts a function so it can only be executed by the operator role.
  modifier onlyOperator() {
    address sender = _msgSender();
    require(isOperator[sender], "StableTokenV3: not allowed to call only by operator");
    _;
  }

  /* ========================================================= */
  /* ====================== Constructor ====================== */
  /* ========================================================= */

  /**
   * @notice The constructor for the StableTokenV3 contract.
   * @dev Should be called with disable=true in deployments when
   * it's accessed through a Proxy.
   * Call this with disable=false during testing, when used
   * without a proxy.
   * @param disable Set to true to run `_disableInitializers()` inherited from
   * openzeppelin-contracts-upgradeable/Initializable.sol
   */
  constructor(bool disable) {
    if (disable) {
      _disableInitializers();
    }
  }

  /// @inheritdoc IStableTokenV3
  function initialize(
    // slither-disable-start shadowing-local
    string memory _name,
    string memory _symbol,
    address _initialOwner,
    // slither-disable-end shadowing-local
    address[] memory initialBalanceAddresses,
    uint256[] memory initialBalanceValues,
    address[] memory _minters,
    address[] memory _burners,
    address[] memory _operators
  ) external reinitializer(3) {
    __ERC20_init_unchained(_name, _symbol);
    __ERC20Permit_init(_symbol);
    _transferOwnership(_initialOwner);

    require(initialBalanceAddresses.length == initialBalanceValues.length, "Array length mismatch");
    for (uint256 i = 0; i < initialBalanceAddresses.length; i += 1) {
      _mint(initialBalanceAddresses[i], initialBalanceValues[i]);
    }
    for (uint256 i = 0; i < _minters.length; i += 1) {
      _setMinter(_minters[i], true);
    }
    for (uint256 i = 0; i < _burners.length; i += 1) {
      _setBurner(_burners[i], true);
    }
    for (uint256 i = 0; i < _operators.length; i += 1) {
      _setOperator(_operators[i], true);
    }
  }

  /// @inheritdoc IStableTokenV3
  function initializeV3(
    address[] memory _minters,
    address[] memory _burners,
    address[] memory _operators
  ) public reinitializer(3) onlyOwner {
    for (uint256 i = 0; i < _minters.length; i += 1) {
      _setMinter(_minters[i], true);
    }
    for (uint256 i = 0; i < _burners.length; i += 1) {
      _setBurner(_burners[i], true);
    }
    for (uint256 i = 0; i < _operators.length; i += 1) {
      _setOperator(_operators[i], true);
    }
  }

  /* ============================================================ */
  /* ==================== Mutative Functions ==================== */
  /* ============================================================ */

  /// @inheritdoc IStableTokenV3
  function setOperator(address _operator, bool _isOperator) external onlyOwner {
    _setOperator(_operator, _isOperator);
  }

  /// @inheritdoc IStableTokenV3
  function setMinter(address _minter, bool _isMinter) external onlyOwner {
    _setMinter(_minter, _isMinter);
  }

  /// @inheritdoc IStableTokenV3
  function setBurner(address _burner, bool _isBurner) external onlyOwner {
    _setBurner(_burner, _isBurner);
  }

  /// @inheritdoc IStableTokenV3
  function mint(address to, uint256 value) external onlyMinter returns (bool) {
    _mint(to, value);
    return true;
  }

  /// @inheritdoc IStableTokenV3
  function burn(uint256 value) external onlyBurner returns (bool) {
    _burn(msg.sender, value);
    return true;
  }

  /// @inheritdoc IStableTokenV3
  function burn(address account, uint256 value) external onlyBurner returns (bool) {
    _burn(account, value);
    return true;
  }

  /// @inheritdoc IStableTokenV3
  function sendToPool(address _sender, address _poolAddress, uint256 _amount) external onlyOperator {
    _transfer(_sender, _poolAddress, _amount);
  }

  /// @inheritdoc IStableTokenV3
  function returnFromPool(address _poolAddress, address _receiver, uint256 _amount) external onlyOperator {
    _transfer(_poolAddress, _receiver, _amount);
  }

  /// @inheritdoc IStableTokenV3
  function transferFrom(
    address from,
    address to,
    uint256 amount
  ) public override(ERC20Upgradeable, IStableTokenV3) returns (bool) {
    return ERC20Upgradeable.transferFrom(from, to, amount);
  }

  /// @inheritdoc IStableTokenV3
  function transfer(address to, uint256 amount) public override(ERC20Upgradeable, IStableTokenV3) returns (bool) {
    return ERC20Upgradeable.transfer(to, amount);
  }

  /// @inheritdoc IStableTokenV3
  function balanceOf(address account) public view override(ERC20Upgradeable, IStableTokenV3) returns (uint256) {
    return ERC20Upgradeable.balanceOf(account);
  }

  /// @inheritdoc IStableTokenV3
  function approve(address spender, uint256 amount) public override(ERC20Upgradeable, IStableTokenV3) returns (bool) {
    return ERC20Upgradeable.approve(spender, amount);
  }

  /// @inheritdoc IStableTokenV3
  function allowance(
    address owner,
    address spender
  ) public view override(ERC20Upgradeable, IStableTokenV3) returns (uint256) {
    return ERC20Upgradeable.allowance(owner, spender);
  }

  /// @inheritdoc IStableTokenV3
  function totalSupply() public view override(ERC20Upgradeable, IStableTokenV3) returns (uint256) {
    return ERC20Upgradeable.totalSupply();
  }

  /// @inheritdoc IStableTokenV3
  function permit(
    address owner,
    address spender,
    uint256 value,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) public override(ERC20PermitUpgradeable, IStableTokenV3) {
    ERC20PermitUpgradeable.permit(owner, spender, value, deadline, v, r, s);
  }

  /// @inheritdoc IStableTokenV3
  function debitGasFees(address from, uint256 value) external onlyVm {
    _burn(from, value);
  }

  /// @inheritdoc IStableTokenV3
  function creditGasFees(
    address refundRecipient,
    address tipRecipient,
    address, // _gatewayFeeRecipient, unused
    address baseFeeRecipient,
    uint256 refundAmount,
    uint256 tipAmount,
    uint256, // _gatewayFeeAmount, unused
    uint256 baseFeeAmount
  ) external onlyVm {
    _mint(refundRecipient, refundAmount);
    _mint(tipRecipient, tipAmount);
    _mint(baseFeeRecipient, baseFeeAmount);
  }

  /// @inheritdoc IStableTokenV3
  function creditGasFees(address[] calldata recipients, uint256[] calldata amounts) external onlyVm {
    require(recipients.length == amounts.length, "StableTokenV3: recipients and amounts must be the same length.");

    for (uint256 i = 0; i < recipients.length; i++) {
      _mint(recipients[i], amounts[i]);
    }
  }

  /* =========================================================== */
  /* ==================== Private Functions ==================== */
  /* =========================================================== */

  function _setOperator(address _operator, bool _isOperator) internal {
    isOperator[_operator] = _isOperator;
    emit OperatorUpdated(_operator, _isOperator);
  }

  function _setMinter(address _minter, bool _isMinter) internal {
    isMinter[_minter] = _isMinter;
    emit MinterUpdated(_minter, _isMinter);
  }

  function _setBurner(address _burner, bool _isBurner) internal {
    isBurner[_burner] = _isBurner;
    emit BurnerUpdated(_burner, _isBurner);
  }
}