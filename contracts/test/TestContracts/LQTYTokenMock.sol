// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

//import "src/Dependencies/IERC20.sol";
//import "src/Dependencies/IERC2612.sol";

contract LQTYTokenMock { /*is IERC20, IERC2612*/
    function sendToLQTYStaking(address _sender, uint256 _amount) external {}

    function getDeploymentStartTime() external view returns (uint256) {}

    function getLpRewardsEntitlement() external view returns (uint256) {}
}
