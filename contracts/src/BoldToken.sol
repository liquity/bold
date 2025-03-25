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
    mapping(address => bool) troveManagerAddresses;
    mapping(address => bool) stabilityPoolAddresses;
    mapping(address => bool) borrowerOperationsAddresses;
    mapping(address => bool) activePoolAddresses;

    // minters
    struct MinterBurnerProposal {
        uint256 timestamp;    
        address[] minters;
        address[] burners;
    }
    MinterBurnerProposal minterBurnerProposal;
    
    mapping(address => bool) public minterAddresses;
    mapping(address => bool) public burnerAddresses;

    // --- Events ---
    event CollateralRegistryAddressChanged(address _newCollateralRegistryAddress);
    event TroveManagerAddressAdded(address _newTroveManagerAddress);
    event StabilityPoolAddressAdded(address _newStabilityPoolAddress);
    event BorrowerOperationsAddressAdded(address _newBorrowerOperationsAddress);
    event ActivePoolAddressAdded(address _newActivePoolAddress);
   
    event AddMinterBurnerProposal(uint256 timestamp);
    event MinterAdded(address _newMinter);
    event MinterRemoved(address _minterRemoved);
    event BurnerAdded(address _newBurner);
    event BurnerRemoved(address _burnerRemoved);

    error AlreadyInitialised();

    constructor(address _owner) Owned(_owner) ERC20(_NAME, _SYMBOL) ERC20Permit(_NAME) {}

    function getOwner() external override view returns (address) {
        return owner;
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
        if(collateralRegistryAddress != address(0))
            revert AlreadyInitialised();

        collateralRegistryAddress = _collateralRegistryAddress;
        emit CollateralRegistryAddressChanged(_collateralRegistryAddress);
    }

    // ----- ADDITIONAL MINTERS AND BURNERS  LOGIC ----- //
    function proposeNewMintersAndBurners(address[] memory minters, address[] memory burners) external override onlyOwner {
        minterBurnerProposal.minters = new address[](minters.length);
        minterBurnerProposal.minters = minters;
        minterBurnerProposal.burners = new address[](burners.length);
        minterBurnerProposal.burners = burners;

        minterBurnerProposal.timestamp = block.timestamp;
        
        emit AddMinterBurnerProposal(block.timestamp);
    }

    function getMinterBurnerProposal() external view override returns (uint256, address[] memory, address[] memory) {
        return (minterBurnerProposal.timestamp, minterBurnerProposal.minters, minterBurnerProposal.burners);
    }

    function acceptMinterBurnerProposal() external override onlyOwner {
        require(
            minterBurnerProposal.timestamp + 3 days <= block.timestamp && 
            minterBurnerProposal.timestamp != 0,
            "Invalid"
        );
        
        // add minters
        for(uint i=0; i<minterBurnerProposal.minters.length; i++) {
            address newMinter = minterBurnerProposal.minters[i];
            minterAddresses[newMinter] = true;
            
            emit MinterAdded(newMinter);
        }
        
        // add burners
        for(uint i=0; i<minterBurnerProposal.burners.length; i++) {
            address newBurner = minterBurnerProposal.burners[i];
            burnerAddresses[newBurner] = true;
            
            emit BurnerAdded(newBurner);
        }

        delete minterBurnerProposal;
    }

    function removeMinters(address[] memory minters) external override onlyOwner {
        for(uint i=0; i<minters.length; i++) {
            minterAddresses[minters[i]] = false;
            emit MinterRemoved(minters[i]);
        }
    }

    function removeBurners(address[] memory burners) external override onlyOwner {
        for(uint i=0; i<burners.length; i++) {
            burnerAddresses[burners[i]] = false;
            emit BurnerRemoved(burners[i]);
        }
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
        require(
            borrowerOperationsAddresses[msg.sender] || 
            activePoolAddresses[msg.sender] || 
            minterAddresses[msg.sender],
            "BoldToken: Caller is not BO or AP or a minter" 
        );
    }

    function _requireCallerIsBurner() internal view {
        require(
            msg.sender == collateralRegistryAddress || 
            borrowerOperationsAddresses[msg.sender] || 
            troveManagerAddresses[msg.sender] || 
            stabilityPoolAddresses[msg.sender] || 
            burnerAddresses[msg.sender],
            "Bold: Caller is neither CR nor BorrowerOperations nor TroveManager nor StabilityPool not a burner"
        );
    }

    function _requireCallerIsStabilityPool() internal view {
        require(stabilityPoolAddresses[msg.sender], "BoldToken: Caller is not the StabilityPool");
    }
}
