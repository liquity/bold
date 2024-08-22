// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.18;

import "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";
import "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

import "./Interfaces/ITroveNFT.sol";
import "./Interfaces/IAddressesRegistry.sol";

// import "forge-std/console2.sol";

contract TroveNFT is ERC721, ITroveNFT {

    ITroveManager public troveManager;
    IERC20 internal immutable collToken;

    constructor(IAddressesRegistry _addressesRegistry) ERC721(
        string.concat("Liquity v2 Trove - ", _addressesRegistry.collToken().name()), 
        string.concat("Lv2T_", _addressesRegistry.collToken().symbol())
    ) {
        troveManager = _addressesRegistry.troveManager();
        collToken = _addressesRegistry.collToken();
    }

    function mint(address _owner, uint256 _troveId) external override {
        _requireCallerIsTroveManager();
        _mint(_owner, _troveId);
    }

    function burn(uint256 _troveId) external override {
        _requireCallerIsTroveManager();
        _burn(_troveId);
    }

    function _requireCallerIsTroveManager() internal view {
        require(msg.sender == address(troveManager), "TroveNFT: Caller is not the TroveManager contract");
    }
}
