//SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {svg} from "./SVG.sol";
import {utils, LibString, numUtils} from "./Utils.sol";
import "./FixedAssets.sol";

library baseSVG {
    string constant GEIST = 'style="font-family: Geist" ';
    string constant DARK_BLUE = "#121B44";
    string constant STOIC_WHITE = "#DEE4FB";

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
                    svg.prop("fill", DARK_BLUE),
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
                "M20.2 31.2C19.1 32.4 17.6 33 16 33L16 21C17.6 21 19.1 21.6 20.2 22.7C21.4 23.9 22 25.4 22 27C22 28.6 21.4 30.1 20.2 31.2Z",
                svg.prop("fill", STOIC_WHITE)
            ),
            svg.path(
                "M22 27C22 25.4 22.6 23.9 23.8 22.7C25 21.6 26.4 21 28 21V33C26.4 33 25 32.4 24 31.2C22.6 30.1 22 28.6 22 27Z",
                svg.prop("fill", STOIC_WHITE)
            )
        );
    }

    string public constant USND_LOGO = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTIwIiBoZWlnaHQ9IjUyMCIgdmlld0JveD0iMCAwIDUyMCA1MjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+DQo8ZyBjbGlwLXBhdGg9InVybCgjY2xpcDBfMjA0MF8xMjkxKSIgZmlsdGVyPSJ1cmwoI2ZpbHRlcjBfZF8yMDQwXzEyOTEpIj4NCjxwYXRoIGQ9Ik0yNjAgNTEyQzQwMS4zODUgNTEyIDUxNiAzOTcuMzg1IDUxNiAyNTZDNTE2IDExNC42MTUgNDAxLjM4NSAwIDI2MCAwQzExOC42MTUgMCA0IDExNC42MTUgNCAyNTZDNCAzOTcuMzg1IDExOC42MTUgNTEyIDI2MCA1MTJaIiBmaWxsPSIjMUQzMTE3Ii8+DQo8cGF0aCBkPSJNMzIwLjUzNCA3MC45NTc2QzMyMi43MTcgNjEuODI2MiAzMTcuMDg1IDUyLjY1MzYgMzA3Ljk1NCA1MC40N0MyOTguODIyIDQ4LjI4NjQgMjg5LjY1IDUzLjkxODcgMjg3LjQ2NiA2My4wNTAxTDI3OS41NzMgOTYuMDU4M0MyMjIuNjE3IDk3Ljg2NzMgMTc3IDE0NC42MDkgMTc3IDIwMi4wMDRDMTc3IDI0MS43NjkgMjA5LjIzNSAyNzMuMDA0IDI0OSAyNzMuMDA0QzI1Mi41NDMgMjczLjAwNCAyNTYuMDQgMjcyLjc1MyAyNTkuNTMxIDI3Mi41MDNDMjYzLjAxMiAyNzIuMjUzIDI2Ni40ODcgMjcyLjAwNCAyNzAgMjcyLjAwNEMyOTAuOTg3IDI3Mi4wMDQgMzA4IDI4OC4wMTcgMzA4IDMwOS4wMDRDMzA4IDM0OC43NjggMjc1Ljc2NSAzODEuMDA0IDIzNiAzODEuMDA0QzIxNS4wMTMgMzgxLjAwNCAxOTggMzYzLjk5MSAxOTggMzQzLjAwNEMxOTggMzQxLjc2NSAxOTguMTMzIDM0MC41NTcgMTk4LjM4NCAzMzkuMzk0QzIwMC40NTkgMzUxLjEwOCAyMTAuNjkxIDM2MC4wMDQgMjIzIDM2MC4wMDRDMjM5LjU2OSAzNjAuMDA0IDI1MyAzNDYuNTczIDI1MyAzMzAuMDA0QzI1MyAzMDkuMDE3IDIzNS45ODcgMjkyLjAwNCAyMTUgMjkyLjAwNEMxODYuODMzIDI5Mi4wMDQgMTY0IDMxNC44MzcgMTY0IDM0My4wMDRDMTY0IDM3Mi4wNjggMTgxLjIyMSAzOTcuMTA5IDIwNi4wMTUgNDA4LjQ4MkwxOTguNDY2IDQ0MC4wNUMxOTYuMjgzIDQ0OS4xODIgMjAxLjkxNSA0NTguMzU0IDIxMS4wNDYgNDYwLjUzOEMyMjAuMTc4IDQ2Mi43MjEgMjI5LjM1IDQ1Ny4wODkgMjMxLjUzNCA0NDcuOTU4TDIzOS40MjcgNDE0Ljk1QzI5Ni4zODMgNDEzLjE0MSAzNDIgMzY2LjM5OSAzNDIgMzA5LjAwNEMzNDIgMjY5LjIzOSAzMDkuNzY0IDIzOC4wMDQgMjcwIDIzOC4wMDRDMjY2LjQ0NyAyMzguMDA0IDI2Mi45NDIgMjM4LjI1NSAyNTkuNDQ3IDIzOC41MDZDMjU1Ljk2OSAyMzguNzU1IDI1Mi40OTkgMjM5LjAwNCAyNDkgMjM5LjAwNEMyMjguMDEzIDIzOS4wMDQgMjExIDIyMi45OTEgMjExIDIwMi4wMDRDMjExIDE2Mi4yNCAyNDMuMjM1IDEzMC4wMDQgMjgzIDEzMC4wMDRDMzAzLjk4NyAxMzAuMDA0IDMyMSAxNDcuMDE3IDMyMSAxNjguMDA0QzMyMSAxNjkuMjQzIDMyMC44NjcgMTcwLjQ1MSAzMjAuNjE2IDE3MS42MTRDMzE4LjU0MSAxNTkuOSAzMDguMzA5IDE1MS4wMDQgMjk2IDE1MS4wMDRDMjc5LjQzMSAxNTEuMDA0IDI2NiAxNjQuNDM1IDI2NiAxODEuMDA0QzI2NiAyMDEuOTkxIDI4My4wMTMgMjE5LjAwNCAzMDQgMjE5LjAwNEMzMzIuMTY3IDIxOS4wMDQgMzU1IDE5Ni4xNzEgMzU1IDE2OC4wMDRDMzU1IDEzOC45NCAzMzcuNzc5IDExMy44OTggMzEyLjk4NSAxMDIuNTI2TDMyMC41MzQgNzAuOTU3NloiIGZpbGw9IiNENUY2Q0EiLz4NCjwvZz4NCjxkZWZzPg0KPGZpbHRlciBpZD0iZmlsdGVyMF9kXzIwNDBfMTI5MSIgeD0iMCIgeT0iMCIgd2lkdGg9IjUyMCIgaGVpZ2h0PSI1MjAiIGZpbHRlclVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgY29sb3ItaW50ZXJwb2xhdGlvbi1maWx0ZXJzPSJzUkdCIj4NCjxmZUZsb29kIGZsb29kLW9wYWNpdHk9IjAiIHJlc3VsdD0iQmFja2dyb3VuZEltYWdlRml4Ii8+DQo8ZmVDb2xvck1hdHJpeCBpbj0iU291cmNlQWxwaGEiIHR5cGU9Im1hdHJpeCIgdmFsdWVzPSIwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAxMjcgMCIgcmVzdWx0PSJoYXJkQWxwaGEiLz4NCjxmZU9mZnNldCBkeT0iNCIvPg0KPGZlR2F1c3NpYW5CbHVyIHN0ZERldmlhdGlvbj0iMiIvPg0KPGZlQ29tcG9zaXRlIGluMj0iaGFyZEFscGhhIiBvcGVyYXRvcj0ib3V0Ii8+DQo8ZmVDb2xvck1hdHJpeCB0eXBlPSJtYXRyaXgiIHZhbHVlcz0iMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMC4yNSAwIi8+DQo8ZmVCbGVuZCBtb2RlPSJub3JtYWwiIGluMj0iQmFja2dyb3VuZEltYWdlRml4IiByZXN1bHQ9ImVmZmVjdDFfZHJvcFNoYWRvd18yMDQwXzEyOTEiLz4NCjxmZUJsZW5kIG1vZGU9Im5vcm1hbCIgaW49IlNvdXJjZUdyYXBoaWMiIGluMj0iZWZmZWN0MV9kcm9wU2hhZG93XzIwNDBfMTI5MSIgcmVzdWx0PSJzaGFwZSIvPg0KPC9maWx0ZXI+DQo8Y2xpcFBhdGggaWQ9ImNsaXAwXzIwNDBfMTI5MSI+DQo8cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0id2hpdGUiIHRyYW5zZm9ybT0idHJhbnNsYXRlKDQpIi8+DQo8L2NsaXBQYXRoPg0KPC9kZWZzPg0KPC9zdmc+";

    function _boldLogo(FixedAssetReader _assetReader) internal view returns (string memory) {
        return svg.el(
            "image",
            string.concat(
                svg.prop("x", "264"),
                svg.prop("y", "373.5"),
                svg.prop("width", "20"),
                svg.prop("height", "20"),
                svg.prop(
                    "href",
                    USND_LOGO
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
                    svg.prop("y", "389"),
                    svg.prop("font-size", "14"),
                    svg.prop("fill", "white")
                ),
                "Debt"
            ),
            svg.text(
                string.concat(
                    GEIST,
                    svg.prop("x", "16"),
                    svg.prop("y", "420"),
                    svg.prop("font-size", "14"),
                    svg.prop("fill", "white")
                ),
                "Interest Rate"
            ),
            svg.text(
                string.concat(
                    GEIST,
                    svg.prop("x", "265"),
                    svg.prop("y", "422"),
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
                svg.prop("x", "284"),
                svg.prop("y", "33"),
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
                svg.prop("text-anchor", "end"),
                svg.prop("x", "284"),
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
                svg.prop("y", "342.5"),
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

    function _dynamicTextEls(uint256 _debt, uint256 _coll, uint256 _annualInterestRate)
        internal
        pure
        returns (string memory)
    {
        return string.concat(
            _formattedDynamicEl(numUtils.toLocaleString(_coll, 18, 4), 256, 360),
            _formattedDynamicEl(numUtils.toLocaleString(_debt, 18, 2), 256, 391),
            _formattedDynamicEl(numUtils.toLocaleString(_annualInterestRate, 16, 2), 256, 422)
        );
    }
    
}
