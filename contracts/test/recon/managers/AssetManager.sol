// SPDX-License-Identifier: GPL-2.0
pragma solidity ^0.8.0;

import {BaseSetup} from "@chimera/BaseSetup.sol";
import {vm} from "@chimera/Hevm.sol";
import {vm} from "@chimera/Hevm.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import {MockERC20} from "../mocks/MockERC20.sol";
import {console} from "forge-std/console.sol";

abstract contract AssetManager {
    using EnumerableSet for EnumerableSet.AddressSet;

    // The current target for this set of variables
    address private __asset;

    EnumerableSet.AddressSet private _assets;

    // If the current target is address(0) then it has not been setup yet and should revert
    error NotSetup();
    // Do not allow duplicates
    error Exists();
    // Enable only added assets
    error NotAdded();

    // Note: use this function _to get the current active asset
    function _getAsset() internal view returns (address) {
        if (__asset == address(0)) {
            revert NotSetup();
        }

        return __asset;
    }

    // Note: returns an asset different from the currently set one
    function _getDifferentAsset() internal view returns (address differentAsset) {
        address[] memory assets_ = _getAssets();
        for(uint256 i; i < assets_.length; i++) {
            if(assets_[i] != __asset) {
                differentAsset = assets_[i];
            }
        }
    }

    function _getAssets() internal view returns (address[] memory) {
        return _assets.values();
    }

    function _newAsset(uint8 decimals) internal returns (address) {
        address asset_ =  address(new MockERC20("Test Token", "TST", decimals)); // If names get confusing, concatenate the decimals to the name
        _addAsset(asset_);
        _enableAsset(asset_);
        return asset_;
    }

    function _enableAsset(address target) internal {
        if (!_assets.contains(target)) {
            revert NotAdded();
        }
        __asset = target;
    }

    function _disableAsset(address asset_) internal {
        // Here there are actions that would be needed when removing a asset.
    }

    function _addAsset(address target) internal {
        if (_assets.contains(target)) {
            revert Exists();
        }

        _assets.add(target);
    }

    function _removeAsset(address target) internal {
        _assets.remove(target);
    }

    // Note: expose this function _in `TargetFunctions` for asset switching
    function _switchAsset(uint256 entropy) internal {
        _disableAsset(__asset); // NOTE: May not be necessary

        address target = _assets.at(entropy % _assets.length());
        _enableAsset(target);
    }

    // mint initial balance and approve allowances for the active asset
    function _finalizeAssetDeployment(address[] memory actorsArray, address[] memory approvalArray, uint256 amount) internal {
        _mintAssetToAllActors(actorsArray, amount);
        for(uint256 i; i < approvalArray.length; i++) {
            _approveAssetToAddressForAllActors(actorsArray, approvalArray[i]);
        }
    }

    function _mintAssetToAllActors(address[] memory actorsArray, uint256 amount) internal {
        // mint all actors
        address asset = _getAsset();
        for (uint256 i; i < actorsArray.length; i++) {
            vm.prank(actorsArray[i]);
            MockERC20(asset).mint(actorsArray[i], amount);
        }
    }

    function _approveAssetToAddressForAllActors(address[] memory actorsArray, address addressToApprove) internal {
        // approve to all actors
        address asset = _getAsset();
        for (uint256 i; i < actorsArray.length; i++) {
            vm.prank(actorsArray[i]);
            MockERC20(asset).approve(addressToApprove, type(uint256).max);
        }
    }
}
