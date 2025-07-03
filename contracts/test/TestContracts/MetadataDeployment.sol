// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

import "forge-std/Script.sol";
//import "forge-std/StdAssertions.sol";
import "src/NFTMetadata/MetadataNFT.sol";
import "src/NFTMetadata/utils/Utils.sol";
import "src/NFTMetadata/utils/FixedAssets.sol";

contract MetadataDeployment is Script /* , StdAssertions */ {
    struct File {
        bytes data;
        uint256 start;
        uint256 end;
    }

    mapping(bytes4 => File) public files;

    address public pointer;

    FixedAssetReader public initializedFixedAssetReader;

    function deployMetadata(bytes32 _salt) public returns (MetadataNFT) {
        _loadFiles();
        _storeFile();
        _deployFixedAssetReader(_salt);

        MetadataNFT metadataNFT = new MetadataNFT{salt: _salt}(initializedFixedAssetReader);

        return metadataNFT;
    }

    // @AF
    // function _loadFiles() internal {
    //     string memory root = string.concat(vm.projectRoot(), "/utils/assets/");

    //     //emit log_string(root);

    //     uint256 offset = 0;

    //     //read bold file

    //     bytes memory boldFile = bytes(vm.readFile(string.concat(root, "bold_logo.txt")));
    //     File memory bold = File(boldFile, offset, offset + boldFile.length);

    //     offset += boldFile.length;

    //     files[bytes4(keccak256("BOLD"))] = bold;

    //     //read eth file
    //     bytes memory ethFile = bytes(vm.readFile(string.concat(root, "weth_logo.txt")));
    //     File memory eth = File(ethFile, offset, offset + ethFile.length);

    //     offset += ethFile.length;

    //     files[bytes4(keccak256("WETH"))] = eth;

    //     //read wstETH file
    //     bytes memory wstethFile = bytes(vm.readFile(string.concat(root, "wsteth_logo.txt")));
    //     File memory wsteth = File(wstethFile, offset, offset + wstethFile.length);

    //     offset += wstethFile.length;

    //     files[bytes4(keccak256("wstETH"))] = wsteth;

    //     //read rETH file
    //     bytes memory rethFile = bytes(vm.readFile(string.concat(root, "reth_logo.txt")));
    //     File memory reth = File(rethFile, offset, offset + rethFile.length);

    //     offset += rethFile.length;

    //     files[bytes4(keccak256("rETH"))] = reth;

    //     //read geist font file
    //     bytes memory geistFile = bytes(vm.readFile(string.concat(root, "geist.txt")));
    //     File memory geist = File(geistFile, offset, offset + geistFile.length);

    //     offset += geistFile.length;

    //     files[bytes4(keccak256("geist"))] = geist;
    // }
    // @AF
    function _loadFiles() internal {
        string memory root = string.concat(vm.projectRoot(), "/utils/assets/");
        uint256 offset;

        // Debt token (USDaf replacing BOLD)
        offset = _addAsset("USDaf", "USDaf.txt", root, offset);

        // BTC-related collaterals
        offset = _addAsset("WBTC18", "wBTC.txt", root, offset);
        offset = _addAsset("tBTC", "tBTC.txt", root, offset);
        // offset = _addAsset("cbBTC18", "cbBTC.txt", root, offset);

        // USD-related collaterals
        // offset = _addAsset("sUSDe", "sUSDE.txt", root, offset);
        offset = _addAsset("sUSDS", "sUSDS.txt", root, offset);
        offset = _addAsset("scrvUSD", "scrvUSD.txt", root, offset);
        offset = _addAsset("sfrxUSD", "sfrxUSD.txt", root, offset);
        offset = _addAsset("ysyBOLD", "ysyBOLD.txt", root, offset);
        // offset = _addAsset("sDAI", "sDAI.txt", root, offset);

        // Font
        offset = _addAsset("geist", "DM_Sans.txt", root, offset);

        // ASF
        offset = _addAsset("ASF", "ASF-logo.txt", root, offset);
    }
    function _addAsset(
        string memory _sig,
        string memory _fileName,
        string memory _root,
        uint256 _offset
    ) internal returns (uint256 nextOffset) {
        bytes memory data = bytes(vm.readFile(string.concat(_root, _fileName)));
        files[bytes4(keccak256(bytes(_sig)))] = File(data, _offset, _offset + data.length);
        return _offset + data.length;
    }

    // @AF
    // function _storeFile() internal {
    //     bytes memory data = bytes.concat(
    //         files[bytes4(keccak256("BOLD"))].data,
    //         files[bytes4(keccak256("WETH"))].data,
    //         files[bytes4(keccak256("wstETH"))].data,
    //         files[bytes4(keccak256("rETH"))].data,
    //         files[bytes4(keccak256("geist"))].data
    //     );

    //     //emit log_named_uint("data length", data.length);

    //     pointer = SSTORE2.write(data);
    // }
    // @AF
    function _storeFile() internal {
        bytes memory part1 = bytes.concat(
            files[bytes4(keccak256("USDaf"))].data,
            files[bytes4(keccak256("WBTC18"))].data,
            files[bytes4(keccak256("tBTC"))].data
            // files[bytes4(keccak256("cbBTC18"))].data,
            // files[bytes4(keccak256("sUSDe"))].data
        );

        bytes memory part2 = bytes.concat(
            files[bytes4(keccak256("sUSDS"))].data,
            files[bytes4(keccak256("scrvUSD"))].data,
            files[bytes4(keccak256("sfrxUSD"))].data,
            // files[bytes4(keccak256("sDAI"))].data,
            files[bytes4(keccak256("ysyBOLD"))].data,
            files[bytes4(keccak256("geist"))].data,
            files[bytes4(keccak256("ASF"))].data
        );

        bytes memory data = bytes.concat(part1, part2);

        require(data.length <= 24 * 1024, "Data too large for SSTORE2");
        pointer = SSTORE2.write(data);
    }

    // @AF
    // function _deployFixedAssetReader(bytes32 _salt) internal {
    //     bytes4[] memory sigs = new bytes4[](5);
    //     sigs[0] = bytes4(keccak256("BOLD"));
    //     sigs[1] = bytes4(keccak256("WETH"));
    //     sigs[2] = bytes4(keccak256("wstETH"));
    //     sigs[3] = bytes4(keccak256("rETH"));
    //     sigs[4] = bytes4(keccak256("geist"));

    //     FixedAssetReader.Asset[] memory FixedAssets = new FixedAssetReader.Asset[](5);
    //     FixedAssets[0] = FixedAssetReader.Asset(
    //         uint128(files[bytes4(keccak256("BOLD"))].start), uint128(files[bytes4(keccak256("BOLD"))].end)
    //     );
    //     FixedAssets[1] = FixedAssetReader.Asset(
    //         uint128(files[bytes4(keccak256("WETH"))].start), uint128(files[bytes4(keccak256("WETH"))].end)
    //     );
    //     FixedAssets[2] = FixedAssetReader.Asset(
    //         uint128(files[bytes4(keccak256("wstETH"))].start), uint128(files[bytes4(keccak256("wstETH"))].end)
    //     );
    //     FixedAssets[3] = FixedAssetReader.Asset(
    //         uint128(files[bytes4(keccak256("rETH"))].start), uint128(files[bytes4(keccak256("rETH"))].end)
    //     );
    //     FixedAssets[4] = FixedAssetReader.Asset(
    //         uint128(files[bytes4(keccak256("geist"))].start), uint128(files[bytes4(keccak256("geist"))].end)
    //     );

    //     initializedFixedAssetReader = new FixedAssetReader{salt: _salt}(pointer, sigs, FixedAssets);
    // }
    // @AF
    function _deployFixedAssetReader(bytes32 _salt) internal {
        // Prepare the same signature order used in _storeFile()
        bytes4[9] memory sigOrder = [
            bytes4(keccak256("USDaf")),
            bytes4(keccak256("WBTC18")),
            bytes4(keccak256("tBTC")),
            // bytes4(keccak256("cbBTC18")),
            // bytes4(keccak256("sUSDe")),
            bytes4(keccak256("sUSDS")),
            bytes4(keccak256("scrvUSD")),
            bytes4(keccak256("sfrxUSD")),
            // bytes4(keccak256("sDAI")),
            bytes4(keccak256("ysyBOLD")),
            bytes4(keccak256("geist")),
            bytes4(keccak256("ASF"))
        ];

        bytes4[] memory sigs = new bytes4[](sigOrder.length);
        FixedAssetReader.Asset[] memory assets = new FixedAssetReader.Asset[](sigOrder.length);

        for (uint256 i; i < sigOrder.length; ++i) {
            bytes4 sig = sigOrder[i];
            sigs[i] = sig;
            assets[i] = FixedAssetReader.Asset(
                uint128(files[sig].start),
                uint128(files[sig].end)
            );
        }

        initializedFixedAssetReader = new FixedAssetReader{salt: _salt}(pointer, sigs, assets);
    }
}
