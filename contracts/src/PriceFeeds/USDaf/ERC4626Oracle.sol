// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC4626} from "openzeppelin-contracts/contracts/interfaces/IERC4626.sol";

import {AggregatorV3Interface, BaseOracle} from "./BaseOracle.sol";

abstract contract ERC4626Oracle is BaseOracle {

    uint256 public immutable PRIMARY_ORACLE_HEARTBEAT;

    AggregatorV3Interface public immutable FALLBACK_ORACLE;
    AggregatorV3Interface public immutable PRIMARY_ORACLE;

    IERC4626 public immutable TOKEN;

    constructor(string memory _description, uint256 _heartbeat, address _token, address _primary, address _fallback)
        BaseOracle(_description) {
            PRIMARY_ORACLE_HEARTBEAT = _heartbeat;
            TOKEN = IERC4626(_token);

            if (_primary != address(0)) {
                PRIMARY_ORACLE = AggregatorV3Interface(_primary);
                require(PRIMARY_ORACLE.decimals() == 8, "!primary");
            }

            if (_fallback != address(0)) {
                FALLBACK_ORACLE = AggregatorV3Interface(_fallback);
                require(FALLBACK_ORACLE.decimals() == 8, "!fallback");
            }
    }

    // assuming PRIMARY_ORACLE will never revert. If it does, the branch will be shut down
    function latestRoundData()
        external
        view
        virtual
        override
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        (roundId, answer, startedAt, updatedAt, answeredInRound) = PRIMARY_ORACLE.latestRoundData();
        if (_isStale(answer, updatedAt, PRIMARY_ORACLE_HEARTBEAT) && address(FALLBACK_ORACLE) != address(0)) {
            (roundId, answer, startedAt, updatedAt, answeredInRound) = FALLBACK_ORACLE.latestRoundData();
        }

        // assumes that `TOKEN` has 18 decimals
        answer = answer * int256(TOKEN.convertToAssets(_WAD)) / int256(_WAD);
        return (roundId, answer, startedAt, updatedAt, answeredInRound);
    }
}