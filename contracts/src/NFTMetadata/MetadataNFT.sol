//SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "Solady/utils/SSTORE2.sol";
import "./utils/JSON.sol";

import "./utils/baseSVG.sol";
import "./utils/bauhaus.sol";

contract MetadataNFT {

    FixedAssetReader public immutable assetReader;

    constructor(FixedAssetReader _assetReader) {
        assetReader = _assetReader;
    }

    function uri(uint256 _tokenId) public view returns (string memory) {
        return string.concat("data:image/svg+xml;base64,", json.encode(bytes(renderSVGImage(_tokenId))));
    }

    function renderSVGImage(uint256 _tokenId) internal view returns (string memory) {
        return svg._svg(
            baseSVG._svgProps(),
            string.concat(baseSVG._baseElements(assetReader), bauhaus._bauhaus(), dynamicTextComponents(_tokenId))
        );
    }

    function dynamicTextComponents(uint256 _tokenId) public view returns (string memory) {
        string memory id = LibString.toHexString(_tokenId);
        id = string.concat(LibString.slice(id, 0, 6), "...", LibString.slice(id, 38, 42));

        return string.concat(
            baseSVG._formattedIdEl(id),
            baseSVG._formattedAddressEl(address(msg.sender)), //dummy
            baseSVG._collLogo("rETH", assetReader) //dummy
        );
    }

}