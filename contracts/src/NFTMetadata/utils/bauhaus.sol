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

    enum colorCode {
        GOLDEN,
        CORAL,
        GREEN,
        CYAN,
        BLUE,
        DARK_BLUE,
        BROWN
    }

    function _bauhaus(string memory _collName, uint256 _troveId) internal pure returns (string memory) {
        bytes32 collSig = keccak256(bytes(_collName));
        uint256 variant = _troveId % 4;

        if(collSig == keccak256("WETH")) {
            return _img1(variant);
        } else if(collSig == keccak256("wstETH")) {
            return _img2(variant);
        } else {
            // assume rETH
            return _img3(variant);
        }
        
    }

    function _colorCode2Hex(colorCode _color) private pure returns (string memory) {
        if(_color == colorCode.GOLDEN) {
            return GOLDEN;
        } else if(_color == colorCode.CORAL) {
            return CORAL;
        } else if(_color == colorCode.GREEN) {
            return GREEN;
        } else if(_color == colorCode.CYAN) {
            return CYAN;
        } else if(_color == colorCode.BLUE) {
            return BLUE;
        } else if(_color == colorCode.DARK_BLUE) {
            return DARK_BLUE;
        } else {
            return BROWN;
        }
    }

    struct COLORS_1 {
        colorCode rect1; // large right rect
        colorCode rect2; // small upper right rect
        colorCode rect3; // large central left rect 
        colorCode rect4; // small lower left rect
        colorCode rect5; // small lower right rect
        colorCode poly; // triangles
        colorCode circle1; // large central circle
        colorCode circle2; // small right circle
        colorCode circle3; // small right half circle
    }

    function _colors1(uint256 _variant) internal pure returns (COLORS_1 memory) {
        if(_variant == 0) {
            return COLORS_1(
                colorCode.BLUE, // rect1
                colorCode.GOLDEN, // rect2
                colorCode.GOLDEN, // rect3
                colorCode.BROWN, // rect4
                colorCode.CORAL, // rect5
                colorCode.CYAN, // poly
                colorCode.GREEN, // circle1
                colorCode.DARK_BLUE, // circle2
                colorCode.GOLDEN // circle3
            );
        } else if(_variant == 1) {
            return COLORS_1(
                colorCode.GREEN, // rect1
                colorCode.BLUE, // rect2
                colorCode.GOLDEN, // rect3
                colorCode.BROWN, // rect4
                colorCode.GOLDEN, // rect5
                colorCode.CORAL, // poly
                colorCode.BLUE, // circle1
                colorCode.DARK_BLUE, // circle2
                colorCode.BLUE // circle3
            );
        } else if(_variant == 2) {
            return COLORS_1(
                colorCode.BLUE, // rect1
                colorCode.GOLDEN, // rect2
                colorCode.CYAN, // rect3
                colorCode.GOLDEN, // rect4
                colorCode.BROWN, // rect5
                colorCode.GREEN, // poly
                colorCode.CORAL, // circle1
                colorCode.DARK_BLUE, // circle2
                colorCode.BROWN // circle3
            );
        } else {
            return COLORS_1(
                colorCode.CYAN, // rect1
                colorCode.BLUE, // rect2
                colorCode.BLUE, // rect3
                colorCode.BROWN, // rect4
                colorCode.BLUE, // rect5
                colorCode.GREEN, // poly
                colorCode.GOLDEN, // circle1
                colorCode.DARK_BLUE, // circle2
                colorCode.BLUE // circle3
            );
        }
    }

    function _img1(uint256 _variant) internal pure returns (string memory) {
        COLORS_1 memory colors = _colors1(_variant);
        return string.concat(_rects1(colors), _polygons1(colors), _circles1(colors));
    }

    

    function _rects1(COLORS_1 memory _colors) internal pure returns (string memory) {
        return string.concat(
            //background
            svg.rect(
                string.concat(
                    svg.prop("x", "16"),
                    svg.prop("y", "55"),
                    svg.prop("width", "268"),
                    svg.prop("height", "268"),
                    svg.prop("fill", DARK_BLUE)
                )
            ),
            // large right rect | rect1
            svg.rect(
                string.concat(
                    svg.prop("x", "128"),
                    svg.prop("y", "55"),
                    svg.prop("width", "156"),
                    svg.prop("height", "268"),
                    svg.prop("fill", _colorCode2Hex(_colors.rect1))
                )
            ),
            // small upper right rect | rect2
            svg.rect(
                string.concat(
                    svg.prop("x", "228"),
                    svg.prop("y", "55"),
                    svg.prop("width", "56"),
                    svg.prop("height", "56"),
                    svg.prop("fill", _colorCode2Hex(_colors.rect2))
                )
            ),
            // large central left rect | rect3
            svg.rect(
                string.concat(
                    svg.prop("x", "16"),
                    svg.prop("y", "111"),
                    svg.prop("width", "134"),
                    svg.prop("height", "156"),
                    svg.prop("fill", _colorCode2Hex(_colors.rect3))
                )
            ),
            // small lower left rect | rect4
            svg.rect(
                string.concat(
                    svg.prop("x", "16"),
                    svg.prop("y", "267"),
                    svg.prop("width", "112"),
                    svg.prop("height", "56"),
                    svg.prop("fill", _colorCode2Hex(_colors.rect4))
                )
            ),
            // small lower right rect | rect5
            svg.rect(
                string.concat(
                    svg.prop("x", "228"),
                    svg.prop("y", "267"),
                    svg.prop("width", "56"),
                    svg.prop("height", "56"),
                    svg.prop("fill", _colorCode2Hex(_colors.rect5))
                )
            )
        );
    }

    function _polygons1(COLORS_1 memory _colors) internal pure returns (string memory) {
        return string.concat(
            // left triangle | poly1
            svg.polygon(
                string.concat(
                    svg.prop("points","16,55 72,55 16,111"),
                    svg.prop("fill", _colorCode2Hex(_colors.poly))
                )
            ),
            // right triangle | poly2
            svg.polygon(
                string.concat(
                    svg.prop("points","72,55 128,55 72,111"),
                    svg.prop("fill", _colorCode2Hex(_colors.poly))
                )
            )
        );
    }

    function _circles1(COLORS_1 memory _colors) internal pure returns (string memory) {
        return string.concat(
            //large central circle | circle1
            svg.circle(
                string.concat(
                    svg.prop("cx", "150"), svg.prop("cy", "189"), svg.prop("r", "78"), svg.prop("fill", _colorCode2Hex(_colors.circle1))
                )
            ),
            //small right circle | circle2
            svg.circle(
                string.concat(
                    svg.prop("cx", "228"), svg.prop("cy", "295"), svg.prop("r", "28"), svg.prop("fill", _colorCode2Hex(_colors.circle2))
                )
            ),
            //small right half circle | circle3
            svg.path(
                "M228 267C220.574 267 213.452 269.95 208.201 275.201C202.95 280.452 200 287.574 200 295C200 302.426 202.95 309.548 208.201 314.799C213.452 320.05 220.574 323 228 323L228 267Z",
                svg.prop("fill", _colorCode2Hex(_colors.circle3))
            )
        );
    }   

    function _img2(uint256 _variant) internal pure returns (string memory) {
        return string.concat(_rects2(), _circles2());
    }

    function _rects2() internal pure returns (string memory) {
        return string.concat(
            //background
            svg.rect(
                string.concat(
                    svg.prop("x", "16"),
                    svg.prop("y", "55"),
                    svg.prop("width", "268"),
                    svg.prop("height", "268"),
                    svg.prop("fill", DARK_BLUE)
                )
            ),
            // large upper right rect
            svg.rect(
                string.concat(
                    svg.prop("x", "128"),
                    svg.prop("y", "55"),
                    svg.prop("width", "156"),
                    svg.prop("height", "156"),
                    svg.prop("fill", BROWN)
                )
            ),
            // large central left rect
            svg.rect(
                string.concat(
                    svg.prop("x", "16"),
                    svg.prop("y", "111"),
                    svg.prop("width", "134"),
                    svg.prop("height", "100"),
                    svg.prop("fill", GOLDEN)
                )
            ),
            // large lower left rect
            svg.rect(
                string.concat(
                    svg.prop("x", "16"),
                    svg.prop("y", "211"),
                    svg.prop("width", "212"),
                    svg.prop("height", "56"),
                    svg.prop("fill", BLUE)
                )
            ),
            // small lower central rect
            svg.rect(
                string.concat(
                    svg.prop("x", "72"),
                    svg.prop("y", "267"),
                    svg.prop("width", "78"),
                    svg.prop("height", "56"),
                    svg.prop("fill", GREEN)
                )
            ),
            // small lower right rect
            svg.rect(
                string.concat(
                    svg.prop("x", "150"),
                    svg.prop("y", "267"),
                    svg.prop("width", "134"),
                    svg.prop("height", "56"),
                    svg.prop("fill", CORAL)
                )
            )
        );
    }

    function _circles2() internal pure returns (string memory) {
        return string.concat(
            //lower left circle
            svg.circle(
                string.concat(
                    svg.prop("cx", "44"), svg.prop("cy", "295"), svg.prop("r", "28"), svg.prop("fill", GOLDEN)
                )
            ),
            //upper left half circle
            svg.path(
                "M16 55C16 62.4 17.4 69.6 20.3 76.4C23.1 83.2 27.2 89.4 32.4 94.6C37.6 99.8 43.8 103.9 50.6 106.7C57.4 109.6 64.6 111 72 111C79.4 111 86.6 109.6 93.4 106.7C100.2 103.9 106.4 99.8 111.6 94.6C116.8 89.4 120.9 83.2 123.7 76.4C126.6 69.6 128 62.4 128 55L16 55Z",
                svg.prop("fill", CYAN)
            ),
            //central right half circle
            svg.path(
                "M284 211C284 190.3 275.8 170.5 261.2 155.8C246.5 141.2 226.7 133 206 133C185.3 133 165.5 141.2 150.9 155.86C136.2 170.5 128 190.3 128 211L284 211Z",
                svg.prop("fill", GREEN)
            )
        );
    }

    function _img3(uint256 _variant) internal pure returns (string memory) {
        return string.concat(_rects3(), _circles3());
    }

    function _rects3() internal pure returns (string memory) {
        return string.concat(
            //background
            svg.rect(
                string.concat(
                    svg.prop("x", "16"),
                    svg.prop("y", "55"),
                    svg.prop("width", "268"),
                    svg.prop("height", "268"),
                    svg.prop("fill", DARK_BLUE)
                )
            ),
            // lower left rect
            svg.rect(
                string.concat(
                    svg.prop("x", "16"),
                    svg.prop("y", "205"),
                    svg.prop("width", "75"),
                    svg.prop("height", "118"),
                    svg.prop("fill", BLUE)
                )
            ),
            // central rect
            svg.rect(
                string.concat(
                    svg.prop("x", "91"),
                    svg.prop("y", "205"),
                    svg.prop("width", "136"),
                    svg.prop("height", "59"),
                    svg.prop("fill", CORAL)
                )
            ),
            // central right rect
            svg.rect(
                string.concat(
                    svg.prop("x", "166"),
                    svg.prop("y", "180"),
                    svg.prop("width", "118"),
                    svg.prop("height", "25"),
                    svg.prop("fill", BLUE)
                )
            ),
            // lower right rect
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
            //upper left circle
            svg.circle(
                string.concat(
                    svg.prop("cx", "91"), svg.prop("cy", "130"), svg.prop("r", "75"), svg.prop("fill", GOLDEN)
                )
            ),
            //upper right half circle
            svg.path(
                "M284 264 166 264 166 263C166 232 193 206 225 205C258 206 284 232 284 264C284 264 284 264 284 264Z",
                svg.prop("fill", CYAN)
            ),
            //lower right half circle
            svg.path(
                "M284 323 166 323 166 323C166 290 193 265 225 264C258 265 284 290 284 323C284 323 284 323 284 323Z",
                svg.prop("fill", GOLDEN)
            )
        );
    }
}
