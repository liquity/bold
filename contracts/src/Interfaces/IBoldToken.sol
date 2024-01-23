// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "../Dependencies/IERC20.sol";
import "../Dependencies/IERC2612.sol";

interface IBoldToken is IERC20, IERC2612 { 
    function deploymentStartTime() external view returns (uint256);
    
    function mint(address _account, uint256 _amount) external;

    function burn(address _account, uint256 _amount) external;

    function sendToPool(address _sender,  address poolAddress, uint256 _amount) external;

    function returnFromPool(address poolAddress, address user, uint256 _amount ) external;
}
