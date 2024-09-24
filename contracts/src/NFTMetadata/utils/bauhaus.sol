//SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "./SVG.sol";

library bauhaus {

    string constant GOLDEN = "#F5D93A";
    string constant CORAL = "#FB7C59";
    string constant GREEN = "#63D77D";
    string constant CYAN = "#95CBF3";
    string constant BLUE = "#405AE5";
    string constant DARK_BLUE = "#1C1D4F";
    string constant BROWN = "#DBB79B";


    function _bauhaus(string memory _collName, uint256 _troveId) internal pure returns (string memory) {
        bytes32 collSig = keccak256(bytes(_collName));
        uint256 variant = _troveId % 4;

        if(collSig == keccak256("WETH")) {

        } else if(collSig == keccak256("wstETH")) {

        } else {
            // assume rETH
            return string.concat(_rects3(), _circles3());
        }
        
    }

    function _rects1() internal pure returns (string memory) {

    }

    function _circles1() internal pure returns (string memory) {

    }   

    function _rects3() internal pure returns (string memory) {
        return string.concat(
            svg.rect(
                string.concat(
                    svg.prop("x", "16"),
                    svg.prop("y", "55"),
                    svg.prop("width", "268"),
                    svg.prop("height", "268"),
                    svg.prop("fill", DARK_BLUE)
                )
            ),
            svg.rect(
                string.concat(
                    svg.prop("x", "16"),
                    svg.prop("y", "205"),
                    svg.prop("width", "75"),
                    svg.prop("height", "118"),
                    svg.prop("fill", BLUE)
                )
            ),
            svg.rect(
                string.concat(
                    svg.prop("x", "91"),
                    svg.prop("y", "205"),
                    svg.prop("width", "136"),
                    svg.prop("height", "59"),
                    svg.prop("fill", CORAL)
                )
            ),
            svg.rect(
                string.concat(
                    svg.prop("x", "166"),
                    svg.prop("y", "180"),
                    svg.prop("width", "118"),
                    svg.prop("height", "25"),
                    svg.prop("fill", BLUE)
                )
            ),
            svg.rect(
                string.concat(
                    svg.prop("x", "166"),
                    svg.prop("y", "55"),
                    svg.prop("width", "118"),
                    svg.prop("height", "126"),
                    svg.prop("fill", GREEN)
                )
            )
        );
    }

    function _circles3() internal pure returns (string memory) {
        return string.concat(
            svg.circle(
                string.concat(
                    svg.prop("cx", "91"), svg.prop("cy", "130"), svg.prop("r", "75"), svg.prop("fill", GOLDEN)
                )
            ),
            svg.path(
                "M284 264 166 264 166 263C166 232 193 206 225 205C258 206 284 232 284 264C284 264 284 264 284 264Z",
                svg.prop("fill", CYAN)
            ),
            svg.path(
                "M284 323 166 323 166 323C166 290 193 265 225 264C258 265 284 290 284 323C284 323 284 323 284 323Z",
                svg.prop("fill", GOLDEN)
            )
        );
    }
}
