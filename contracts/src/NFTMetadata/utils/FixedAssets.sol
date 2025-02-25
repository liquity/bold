//SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "Solady/utils/SSTORE2.sol";

contract FixedAssetReader {
    struct Asset {
        uint128 start;
        uint128 end;
    }

    address public immutable pointer;

    mapping(bytes4 => Asset) public assets;

    function readAsset(bytes4 _sig) public view returns (string memory) {
        return string(SSTORE2.read(pointer, uint256(assets[_sig].start), uint256(assets[_sig].end)));
    }

    constructor(address _pointer, bytes4[] memory _sigs, Asset[] memory _assets) {
        pointer = _pointer;
        require(_sigs.length == _assets.length, "FixedAssetReader: Invalid input");
        for (uint256 i = 0; i < _sigs.length; i++) {
            assets[_sigs[i]] = _assets[i];
        }
    }
}
