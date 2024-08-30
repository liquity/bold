// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./ICurvePool.sol";

interface ICurveFactory {
    function deploy_pool(
        string memory name,
        string memory symbol,
        address[2] memory coins,
        uint256 implementation_id,
        uint256 A,
        uint256 gamma,
        uint256 mid_fee,
        uint256 out_fee,
        uint256 fee_gamma,
        uint256 allowed_extra_profit,
        uint256 adjustment_step,
        uint256 ma_exp_time,
        uint256 initial_price
    ) external returns (ICurvePool);
}
