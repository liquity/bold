// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable, Ownable2Step} from "openzeppelin-contracts/contracts/access/Ownable2Step.sol";

import {AggregatorV3Interface, BaseOracle} from "../BaseOracle.sol";

interface ICurvePriceAggregator {
    function price() external view returns (uint256);
}

abstract contract BaseFallbackOracle is BaseOracle, Ownable2Step {

    bool public useFallback;

    uint256 internal constant _PRECISION_DIFF = 1e10;

    ICurvePriceAggregator public immutable AGG;

    address private constant _OWNER = 0x263b03BbA0BbbC320928B6026f5eAAFAD9F1ddeb;

    constructor(string memory _description, address _agg) BaseOracle(_description) {
        _transferOwnership(_OWNER);
        useFallback = true;
        AGG = ICurvePriceAggregator(_agg);
    }

    function latestRoundData()
        public
        view
        virtual
        override
        returns (uint80, int256, uint256, uint256, uint80)
    {
        if (!useFallback) return (0, 0, 0, 0, 0);
        return (0, int256(AGG.price() / _PRECISION_DIFF), 0, block.timestamp, 0);
    }

    function disableFallback() external onlyOwner {
        useFallback = false;
    }
}