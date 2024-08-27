//SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {svg} from "./SVG.sol";
import {utils, LibString, numUtils} from "./Utils.sol";
import "./FixedAssets.sol";

library baseSVG {
    string constant GEIST = 'style="font-family: Geist" ';

    function _svgProps() internal pure returns (string memory) {
        return string.concat(
            svg.prop("width", "300"),
            svg.prop("height", "484"),
            svg.prop("viewBox", "0 0 300 484"),
            svg.prop("style", "background:none")
        );
    }

    function _baseElements(FixedAssetReader _assetReader) internal view returns (string memory) {
        return string.concat(
            svg.rect(
                string.concat(
                    svg.prop("fill", "#1C1D4F"),
                    svg.prop("rx", "8"),
                    svg.prop("width", "300"),
                    svg.prop("height", "484")
                )
            ),
            _styles(_assetReader),
            _leverageLogo(),
            _boldLogo(_assetReader),
            _staticTextEls()
        );
    }

    function _styles(FixedAssetReader _assetReader) private view returns (string memory) {
        return svg.el(
            "style",
            utils.NULL,
            string.concat(
                '@font-face { font-family: "Geist"; src: url("data:font/woff2;utf-8;base64,',
                _assetReader.readAsset(bytes4(keccak256("geist"))),
                '"); }'
            )
        );
    }

    function _leverageLogo() internal pure returns (string memory) {
        return string.concat(
            svg.path(
                "M22.2 30.2C21.1 31.4 19.6 32 18 32L18 20C19.6 20 21.1 20.6 22.2 21.7C23.4 22.9 24 24.4 24 26C24 27.6 23.4 29.1 22.2 30.2Z",
                svg.prop("fill", "#DEE4FB")
            ),
            svg.path(
                "M24 26C24 24.4 24.6 22.9 25.8 21.7C27 20.6 28.4 20 30 20V32C28.4 32 27 31.4 26 30.2C24.6 29.1 24 27.6 24 26Z",
                svg.prop("fill", "#DEE4FB")
            )
        );
    }

    function _boldLogo(FixedAssetReader _assetReader) internal view returns (string memory) {
        return svg.el(
            "image",
            string.concat(
                svg.prop("x", "264"),
                svg.prop("y", "374.5"),
                svg.prop("width", "20"),
                svg.prop("height", "20"),
                svg.prop(
                    "href",
                    string.concat("data:image/svg+xml;base64,", _assetReader.readAsset(bytes4(keccak256("BOLD"))))
                )
            )
        );
    }

    function _staticTextEls() internal pure returns (string memory) {
        return string.concat(
            svg.text(
                string.concat(
                    GEIST,
                    svg.prop("x", "16"),
                    svg.prop("y", "358"),
                    svg.prop("font-size", "14"),
                    svg.prop("fill", "white")
                ),
                "Collateral"
            ),
            svg.text(
                string.concat(
                    GEIST,
                    svg.prop("x", "16"),
                    svg.prop("y", "390"),
                    svg.prop("font-size", "14"),
                    svg.prop("fill", "white")
                ),
                "Debt"
            ),
            svg.text(
                string.concat(
                    GEIST,
                    svg.prop("x", "16"),
                    svg.prop("y", "418"),
                    svg.prop("font-size", "14"),
                    svg.prop("fill", "white")
                ),
                "Interest Rate"
            ),
            svg.text(
                string.concat(
                    GEIST,
                    svg.prop("x", "264"),
                    svg.prop("y", "418"),
                    svg.prop("font-size", "20"),
                    svg.prop("fill", "white")
                ),
                "%"
            ),
            svg.text(
                string.concat(
                    GEIST,
                    svg.prop("x", "16"),
                    svg.prop("y", "462"),
                    svg.prop("font-size", "14"),
                    svg.prop("fill", "white")
                ),
                "Owner"
            )
        );
    }

    function _formattedDynamicEl(string memory _value, uint256 _x, uint256 _y) internal pure returns (string memory) {
        return svg.text(
            string.concat(
                GEIST,
                svg.prop("text-anchor", "end"),
                svg.prop("x", LibString.toString(_x)),
                svg.prop("y", LibString.toString(_y)),
                svg.prop("font-size", "20"),
                svg.prop("fill", "white")
            ),
            _value
        );
    }

    function _formattedIdEl(string memory _id) internal pure returns (string memory) {
        return svg.text(
            string.concat(
                GEIST,
                svg.prop("text-anchor", "end"),
                svg.prop("x", "283"),
                svg.prop("y", "31"),
                svg.prop("font-size", "14"),
                svg.prop("fill", "white")
            ),
            _id
        );
    }

    function _formattedAddressEl(address _address) internal pure returns (string memory) {
        return svg.text(
            string.concat(
                GEIST,
                svg.prop("x", "196"),
                svg.prop("y", "462"),
                svg.prop("font-size", "14"),
                svg.prop("fill", "white")
            ),
            string.concat(
                LibString.slice(LibString.toHexStringChecksummed(_address), 0, 6),
                "...",
                LibString.slice(LibString.toHexStringChecksummed(_address), 38, 42)
            )
        );
    }

    function _collLogo(string memory _collName, FixedAssetReader _assetReader) internal view returns (string memory) {
        return svg.el(
            "image",
            string.concat(
                svg.prop("x", "264"),
                svg.prop("y", "343.5"),
                svg.prop("width", "20"),
                svg.prop("height", "20"),
                svg.prop(
                    "href",
                    string.concat(
                        "data:image/svg+xml;base64,", _assetReader.readAsset(bytes4(keccak256(bytes(_collName))))
                    )
                )
            )
        );
    }

    function _statusEl(string memory _status) internal pure returns (string memory) {
        return svg.text(
            string.concat(
                GEIST, svg.prop("x", "40"), svg.prop("y", "33"), svg.prop("font-size", "14"), svg.prop("fill", "white")
            ),
            _status
        );
    }

    function _dynamicTextEls(uint256, /*_debt*/ uint256 _coll, uint256 _annualInterestRate)
        internal
        pure
        returns (string memory)
    {
        return string.concat(
            _formattedDynamicEl(numUtils.toLocaleString(_coll, 18, 3), 256, 360),
            _formattedDynamicEl(numUtils.toLocaleString(_coll, 18, 3), 256, 392),
            _formattedDynamicEl(numUtils.toLocaleString(_annualInterestRate, 16, 2), 256, 420)
        );
    }
}
