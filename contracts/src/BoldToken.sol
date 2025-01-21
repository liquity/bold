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
 * --- Functionality added specific to the BoldToken ---
 *
 * 1) Transfer protection: blacklist of addresses that are invalid recipients (i.e. core Liquity contracts) in external
 * transfer() and transferFrom() calls. The purpose is to protect users from losing tokens by mistakenly sending Bold directly to a Liquity
 * core contract, when they should rather call the right function.
 *
 * 2) sendToPool() and returnFromPool(): functions callable only Liquity core contracts, which move Bold tokens between Liquity <-> user.
 */

 //TODO double check the erc20 the proxy is using implements permit. Add just the permit function without the rest of erc20.
 //TODO: remove erc20 from constructor. Ask bold if removing permit breaks anything else.
 //INFO: permit involves approve, so invoke safeApproveFor in supertoken

contract BoldToken is Ownable, IBoldToken, CustomSuperTokenBase, UUPSProxy {

    string internal constant _NAME = "Bold Stablecoin";
    string internal constant _SYMBOL = "Bold";

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

    //TODO update deployment script for new constructor params.
    //TODO move supertoken init to another function possibley.
    //TODO lookup address of factory deployment and include that in the deployment scripts to int the factory.
    constructor(address _owner, ISuperTokenFactory factory) Ownable(_owner) {
        // This call to the factory invokes `UUPSProxy.initialize`, which connects the proxy to the canonical SuperToken implementation.
		// It also emits an event which facilitates discovery of this token.
		ISuperTokenFactory(factory).initializeCustomSuperToken(address(this));

		// This initializes the token storage and sets the `initialized` flag of OpenZeppelin Initializable.
		// This makes sure that it will revert if invoked more than once.
		ISuperToken(address(this)).initialize(
			IERC20(address(0)),
			18,
			"USD Nerite",
			"USDN"
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

    //TODO verify spender is correct when making pool calls.
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
            "Bold: Cannot transfer tokens directly to the Bold token contract or the zero address"
        );
    }

    function _requireCallerIsBOorAP() internal view {
        require(
            borrowerOperationsAddresses[msg.sender] || activePoolAddresses[msg.sender],
            "BoldToken: Caller is not BO or AP"
        );
    }

    function _requireCallerIsCRorBOorTMorSP() internal view {
        require(
            msg.sender == collateralRegistryAddress || borrowerOperationsAddresses[msg.sender]
                || troveManagerAddresses[msg.sender] || stabilityPoolAddresses[msg.sender],
            "Bold: Caller is neither CR nor BorrowerOperations nor TroveManager nor StabilityPool"
        );
    }

    function _requireCallerIsStabilityPool() internal view {
        require(stabilityPoolAddresses[msg.sender], "Bold: Caller is not the StabilityPool");
    }
}
