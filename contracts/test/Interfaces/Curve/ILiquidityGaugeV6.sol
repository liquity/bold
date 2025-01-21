// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IERC20Metadata} from "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";

interface ILiquidityGaugeV6 {
    function add_reward(address _reward_token, address _distributor) external;
    function set_reward_distributor(address _reward_token, address _distributor) external;
    function set_gauge_manager(address _gauge_manager) external;
    function deposit_reward_token(address _reward_token, uint256 _amount, uint256 _epoch) external;
    function deposit(uint256 _amount) external;
    function claim_rewards() external;
    function lp_token() external view returns (IERC20Metadata);
    function manager() external view returns (address);
}
