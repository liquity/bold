// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC4626Oracle, IERC4626} from "./ERC4626Oracle.sol";

contract StyBoldOracle is ERC4626Oracle {

    address private constant _STAKED_YEARN_BOLD = 0x23346B04a7f55b8760E5860AA5A77383D63491cD; // st-yBOLD

    IERC4626 public immutable NON_STAKED_TOKEN; // yBOLD

    constructor()
        ERC4626Oracle(
            "st-yBOLD / USD", // description
            uint256(0), // heartbeat
            _STAKED_YEARN_BOLD, // token
            address(0), // primary
            address(0) // fallback
        ) {
            NON_STAKED_TOKEN = IERC4626(TOKEN.asset());
        }

    // Assumes BOLD will always be solvent
    function latestRoundData()
        external
        view
        virtual
        override
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        return (
            0,
            int256(NON_STAKED_TOKEN.convertToAssets(TOKEN.convertToAssets(10 ** decimals()))),
            0,
            block.timestamp,
            0
        );
    }
}