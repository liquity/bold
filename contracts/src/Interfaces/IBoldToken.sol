// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "openzeppelin-contracts/contracts/interfaces/IERC5267.sol";

interface IBoldToken is IERC20Metadata, IERC20Permit, IERC5267 {
    function setBranchAddresses(
        address _troveManagerAddress,
        address _stabilityPoolAddress,
        address _borrowerOperationsAddress,
        address _activePoolAddress
    ) external;

    function setCollateralRegistry(address _collateralRegistryAddress) external;

    function getMinterProposal() external view returns (uint256 timestamp, address[] memory minters);
    function proposeNewMinters(address[] memory minters) external;
    function acceptNewMinters() external;
    function removeMinters(address[] memory minters) external;
   
    function getBurnerProposal() external view returns (uint256 timestamp, address[] memory burners);
    function proposeNewBurners(address[] memory burners) external;
    function acceptNewBurners() external;
    function removeBurners(address[] memory burners) external;

    function mint(address _account, uint256 _amount) external;

    function burn(address _account, uint256 _amount) external;

    function sendToPool(address _sender, address poolAddress, uint256 _amount) external;

    function returnFromPool(address poolAddress, address user, uint256 _amount) external;

    function getOwner() external view returns (address);
}
