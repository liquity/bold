//SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "./SVG.sol";

library bauhaus {
    function _bauhaus() internal pure returns (string memory) {
        return string.concat(_rects(), _circles());
    }

    function _circles() internal pure returns (string memory) {
        return string.concat(
            svg.circle(
                string.concat(
                    svg.prop("cx", "91"), svg.prop("cy", "130"), svg.prop("r", "75"), svg.prop("fill", "#F5D93A")
                )
            ),
            svg.path(
                "M284 264 166 264 166 263C166 232 193 206 225 205C258 206 284 232 284 264C284 264 284 264 284 264Z",
                svg.prop("fill", "#95CBF3")
            ),
            svg.path(
                "M284 323 166 323 166 323C166 290 193 265 225 264C258 265 284 290 284 323C284 323 284 323 284 323Z",
                svg.prop("fill", "#F5D93A")
            )
        );
    }

    function _rects() internal pure returns (string memory) {
        return string.concat(
            svg.rect(
                string.concat(
                    svg.prop("x", "16"),
                    svg.prop("y", "205"),
                    svg.prop("width", "75"),
                    svg.prop("height", "118"),
                    svg.prop("fill", "#405AE5")
                )
            ),
            svg.rect(
                string.concat(
                    svg.prop("x", "91"),
                    svg.prop("y", "205"),
                    svg.prop("width", "136"),
                    svg.prop("height", "59"),
                    svg.prop("fill", "#FB7C59")
                )
            ),
            svg.rect(
                string.concat(
                    svg.prop("x", "166"),
                    svg.prop("y", "180"),
                    svg.prop("width", "118"),
                    svg.prop("height", "25"),
                    svg.prop("fill", "#405AE5")
                )
            ),
            svg.rect(
                string.concat(
                    svg.prop("x", "166"),
                    svg.prop("y", "55"),
                    svg.prop("width", "118"),
                    svg.prop("height", "126"),
                    svg.prop("fill", "#63D77D")
                )
            ) /*,
            //box to check the size of the bauhaus image
            svg.rect(
                string.concat(
                    svg.prop("x", "16)),
                    svg.prop("y", "55)),
                    svg.prop("width", "268)),
                    svg.prop("height", "268)),
                    svg.prop("fill", "none"),
                    svg.prop("stroke", "white")
                ),
                LibString.NULL
            )*/
        );
    }
}
