// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

// This abstract contract provides storage padding for the proxy
import { CustomSuperTokenBase } from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/CustomSuperTokenBase.sol";
// Implementation of UUPSProxy (see https://eips.ethereum.org/EIPS/eip-1822)
import { UUPSProxy } from "@superfluid-finance/ethereum-contracts/contracts/upgradability/UUPSProxy.sol";
// Superfluid framework interfaces we need
import { ISuperToken, ISuperTokenFactory, IERC20 } from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";


import "openzeppelin-contracts/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "./Dependencies/Ownable.sol";
import "./Interfaces/IBoldToken.sol";

/*
 * --- Functionality added specific to the USDNer ---
 *
 * 1) Transfer protection: blacklist of addresses that are invalid recipients (i.e. core Liquity contracts) in external
 * transfer() and transferFrom() calls. The purpose is to protect users from losing tokens by mistakenly sending USDNer directly to a Liquity
 * core contract, when they should rather call the right function.
 *
 * 2) sendToPool() and returnFromPool(): functions callable only Liquity core contracts, which move USDNer tokens between Liquity <-> user.
 */

 //INFO: permit involves approve, so invoke safeApproveFor in supertoken

contract BoldToken is CustomSuperTokenBase, Ownable, IBoldTokenCustom, UUPSProxy {

    string internal constant _NAME = "USD Nerite";
    string internal constant _SYMBOL = "USDNer";


    // --- Addresses ---

    address public collateralRegistryAddress;
    mapping(address => bool) troveManagerAddresses;
    mapping(address => bool) stabilityPoolAddresses;
    mapping(address => bool) borrowerOperationsAddresses;
    mapping(address => bool) activePoolAddresses;

    // --- Events ---
    event CollateralRegistryAddressChanged(address _newCollateralRegistryAddress);
    event TroveManagerAddressAdded(address _newTroveManagerAddress);
    event StabilityPoolAddressAdded(address _newStabilityPoolAddress);
    event BorrowerOperationsAddressAdded(address _newBorrowerOperationsAddress);
    event ActivePoolAddressAdded(address _newActivePoolAddress);

    constructor(address _owner, ISuperTokenFactory factory) Ownable(_owner) {}

    function initialize(ISuperTokenFactory factory) external {
        // This call to the factory invokes `UUPSProxy.initialize`, which connects the proxy to the canonical SuperToken implementation.
		// It also emits an event which facilitates discovery of this token.
		ISuperTokenFactory(factory).initializeCustomSuperToken(address(this));

		// This initializes the token storage and sets the `initialized` flag of OpenZeppelin Initializable.
		// This makes sure that it will revert if invoked more than once.
		ISuperToken(address(this)).initialize(
			IERC20(address(0)),
			18,
			_NAME,
			_SYMBOL
		);
    }

    function setBranchAddresses(
        address _troveManagerAddress,
        address _stabilityPoolAddress,
        address _borrowerOperationsAddress,
        address _activePoolAddress
    ) external override onlyOwner {
        troveManagerAddresses[_troveManagerAddress] = true;
        emit TroveManagerAddressAdded(_troveManagerAddress);

        stabilityPoolAddresses[_stabilityPoolAddress] = true;
        emit StabilityPoolAddressAdded(_stabilityPoolAddress);

        borrowerOperationsAddresses[_borrowerOperationsAddress] = true;
        emit BorrowerOperationsAddressAdded(_borrowerOperationsAddress);

        activePoolAddresses[_activePoolAddress] = true;
        emit ActivePoolAddressAdded(_activePoolAddress);
    }

    function setCollateralRegistry(address _collateralRegistryAddress) external override onlyOwner {
        collateralRegistryAddress = _collateralRegistryAddress;
        emit CollateralRegistryAddressChanged(_collateralRegistryAddress);

        _renounceOwnership();
    }

    // --- Functions for intra-Liquity calls ---

    function mint(address _account, uint256 _amount) external override {
        _requireCallerIsBOorAP();
        ISuperToken(address(this)).selfMint(_account, _amount, "");
    }

    function burn(address _account, uint256 _amount) external override {
        _requireCallerIsCRorBOorTMorSP();
        ISuperToken(address(this)).selfBurn(_account, _amount, "");
    }

    function sendToPool(address _sender, address _poolAddress, uint256 _amount) external override {
        _requireCallerIsStabilityPool();
        ISuperToken(address(this)).selfTransferFrom(_sender, _sender, _poolAddress, _amount);
    }

    function returnFromPool(address _poolAddress, address _receiver, uint256 _amount) external override {
        _requireCallerIsStabilityPool();
        ISuperToken(address(this)).selfTransferFrom(_poolAddress, _poolAddress, _receiver, _amount);
    }

    // TODO: check that SF already checks for no sending to 0 or this contract.

    // --- 'require' functions ---

    function _requireValidRecipient(address _recipient) internal view {
        require(
            _recipient != address(0) && _recipient != address(this),
            "USDNer: Cannot transfer tokens directly to the Bold token contract or the zero address"
        );
    }

    function _requireCallerIsBOorAP() internal view {
        require(
            borrowerOperationsAddresses[msg.sender] || activePoolAddresses[msg.sender],
            "USDNer: Caller is not BO or AP"
        );
    }

    function _requireCallerIsCRorBOorTMorSP() internal view {
        require(
            msg.sender == collateralRegistryAddress || borrowerOperationsAddresses[msg.sender]
                || troveManagerAddresses[msg.sender] || stabilityPoolAddresses[msg.sender],
            "USDNer: Caller is neither CR nor BorrowerOperations nor TroveManager nor StabilityPool"
        );
    }

    function _requireCallerIsStabilityPool() internal view {
        require(stabilityPoolAddresses[msg.sender], "USDNer: Caller is not the StabilityPool");
    }

    //[================================]
    //Permit functions
    //[================================]

    /// @dev Returns the EIP-712 domain separator for the EIP-2612 permit.
    // Required to implement ERC20Permit.
    // solhint-disable-next-line func-name-mixedcase
    function DOMAIN_SEPARATOR() public view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(ISuperToken(address(this)).name())),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    // Storage slot for nonces (from ERC20Permit)
    mapping(address => uint256) private _nonces;

    function eip712Domain() external view override returns (
        bytes1 fields,
        string memory name712,
        string memory version,
        uint256 chainId,
        address verifyingContract,
        bytes32 salt,
        uint256[] memory extensions
    ) {
        return (
            hex"0f", // 01111 (all fields except salt and extensions)
            ISuperToken(address(this)).name(),
            "1", // version
            block.chainid,
            address(this),
            bytes32(0),
            new uint256[](0)
        );
    }

    function nonces(address owner) external view override returns (uint256) {
        return _nonces[owner];
    }

    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external override {
        if (deadline < block.timestamp) revert("PERMIT_DEADLINE_EXPIRED");
        
        // Compute the digest
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                owner,
                spender,
                value,
                _nonces[owner]++,
                deadline
            )
        );
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR(),
                structHash
            )
        );
        
        address signer = ecrecover(digest, v, r, s);
        if (signer == address(0)) revert("INVALID_SIGNATURE");
        if (signer != owner) revert("INVALID_SIGNER");

        // Finally, approve the spender
        ISuperToken(address(this)).selfApproveFor(owner, spender, value);
    }

}
