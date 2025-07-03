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

    function deploy_metapool(
        address _base_pool,
        string memory _name,
        string memory _symbol,
        address _coin,
        uint256 _A,
        uint256 _fee,
        uint256 _offpeg_fee_multiplier,
        uint256 _ma_exp_time,
        uint256 _implementation_id,
        uint8 _asset_type,
        bytes4 _method_id,
        address _oracle
    ) external returns (ICurveStableswapNGPool);
}
