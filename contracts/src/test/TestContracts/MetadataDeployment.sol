// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.18;

import "forge-std/Test.sol";
import "src/NFTMetadata/utils/Utils.sol";
import "src/NFTMetadata/utils/FixedAssets.sol";
import "src/NFTMetadata/MetadataNFT.sol";

contract MetadataDeployment is Test {
    FixedAssetReader public assetReader;

    struct File {
        bytes data;
        uint256 start;
        uint256 end;
    }

    mapping(bytes4 => File) public files;

    address public pointer;

    function deployMetadata() public {
        _loadFiles();
        _storeFile();
    }

    function _loadFiles() internal {
        string memory root = string.concat(vm.projectRoot(), "/utils/assets/");

        uint256 offset = 0;

        //read bold file

        bytes memory boldFile = bytes(vm.readFile(string.concat(root, "bold_logo.txt")));
        File memory bold = File(boldFile, offset, offset + boldFile.length);

        offset += boldFile.length;

        files[bytes4(keccak256("BOLD"))] = bold;

        //read eth file
        bytes memory ethFile = bytes(vm.readFile(string.concat(root, "weth_logo.txt")));
        File memory eth = File(ethFile, offset, offset + ethFile.length);

        offset += ethFile.length;

        files[bytes4(keccak256("WETH"))] = eth;

        //read wstETH file
        bytes memory wstethFile = bytes(vm.readFile(string.concat(root, "wsteth_logo.txt")));
        File memory wsteth = File(wstethFile, offset, offset + wstethFile.length);

        offset += wstethFile.length;

        files[bytes4(keccak256("wstETH"))] = wsteth;

        //read rETH file
        bytes memory rethFile = bytes(vm.readFile(string.concat(root, "reth_logo.txt")));
        File memory reth = File(rethFile, offset, offset + rethFile.length);

        offset += rethFile.length;

        files[bytes4(keccak256("rETH"))] = reth;

        //read geist font file
        bytes memory geistFile = bytes(vm.readFile(string.concat(root, "geist.txt")));
        File memory geist = File(geistFile, offset, offset + geistFile.length);

        offset += geistFile.length;

        files[bytes4(keccak256("geist"))] = geist;
    }

    function _storeFile() internal {
        bytes memory data = bytes.concat(
            files[bytes4(keccak256("bold"))].data,
            files[bytes4(keccak256("eth"))].data,
            files[bytes4(keccak256("wsteth"))].data,
            files[bytes4(keccak256("reth"))].data,
            files[bytes4(keccak256("geist"))].data
        );

        pointer = SSTORE2.write(data);
    }

}