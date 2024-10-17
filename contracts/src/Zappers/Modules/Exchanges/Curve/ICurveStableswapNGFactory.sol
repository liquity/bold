// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./ICurveStableswapNGPool.sol";

interface ICurveStableswapNGFactory {
    /*
    function deploy_plain_pool(
        string memory name,
        string memory symbol,
        address[2] memory coins,
        uint256 A,
        uint256 fee,
        uint256 asset_type,
        uint256 implementation_id
    ) external returns (ICurvePool);
    */
    function deploy_plain_pool(
        string memory name,
        string memory symbol,
        address[] memory coins,
        uint256 A,
        uint256 fee,
        uint256 offpeg_fee_multiplier,
        uint256 ma_exp_time,
        uint256 implementation_id,
        uint8[] memory asset_types,
        bytes4[] memory method_ids,
        address[] memory oracles
    ) external returns (ICurveStableswapNGPool);
}
