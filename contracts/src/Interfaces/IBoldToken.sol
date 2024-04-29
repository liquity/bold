// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Permit.sol";

interface IBoldToken is IERC20, IERC20Metadata, IERC20Permit {
    function setBranchAddresses(
        address _troveManagerAddress,
        address _stabilityPoolAddress,
        address _borrowerOperationsAddress,
        address _activePoolAddress
    ) external;

    function setCollateralRegistry(address _collateralRegistryAddress) external;

    function version() external pure returns (string memory);

    function deploymentStartTime() external view returns (uint256);

    function mint(address _account, uint256 _amount) external;

    function burn(address _account, uint256 _amount) external;

    function increaseAllowance(address spender, uint256 addedValue) external returns (bool);

    function decreaseAllowance(address spender, uint256 subtractedValue) external returns (bool);

    function sendToPool(address _sender, address poolAddress, uint256 _amount) external;

    function returnFromPool(address poolAddress, address user, uint256 _amount) external;
}
