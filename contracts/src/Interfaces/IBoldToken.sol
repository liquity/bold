// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "openzeppelin-contracts/contracts/interfaces/IERC5267.sol";

import "./IOwned.sol";

interface IBoldToken is IERC20Metadata, IERC20Permit, IOwned, IERC5267 {
    function mint(address _account, uint256 _amount) external;

    function burn(address _account, uint256 _amount) external;

    function sendToPool(address _sender, address poolAddress, uint256 _amount) external;

    function returnFromPool(address poolAddress, address user, uint256 _amount) external;

    function setCollateralRegistry(address _collateralRegistryAddress) external;

    function setMinter(address minter, bool isMinter) external;

    function setBurner(address burner, bool isBurner) external;

    function setStabilityPool(address stabilityPool, bool isStabilityPool) external;

    function isMinter(address minter) external view returns (bool);

    function isBurner(address burner) external view returns (bool);

    function isStabilityPool(address stabilityPool) external view returns (bool);
}
