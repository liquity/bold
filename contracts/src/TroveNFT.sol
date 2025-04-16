// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";
import "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import "./Interfaces/ITroveNFT.sol";
import "./Interfaces/IAddressesRegistry.sol";
import "./Dependencies/HasWhitelist.sol";

import {IMetadataNFT} from "./NFTMetadata/MetadataNFT.sol";
import {ITroveManager} from "./Interfaces/ITroveManager.sol";

contract TroveNFT is HasWhitelist, ERC721, ITroveNFT {
    ITroveManager public immutable troveManager;
    IERC20Metadata internal immutable collToken;
    IBoldToken internal immutable boldToken;
    IAddressesRegistry internal immutable addressRegistry;

    IMetadataNFT public immutable metadataNFT;
    
    error CallerNotAddressesRegistry();

    constructor(IAddressesRegistry _addressesRegistry)
        ERC721(
            string.concat("Liquity V2 - ", _addressesRegistry.collToken().name()),
            string.concat("LV2_", _addressesRegistry.collToken().symbol())
        )
    {
        troveManager = _addressesRegistry.troveManager();
        collToken = _addressesRegistry.collToken();
        metadataNFT = _addressesRegistry.metadataNFT();
        boldToken = _addressesRegistry.boldToken();
        whitelist = _addressesRegistry.whitelist();
        addressRegistry = _addressesRegistry;
    }

    function tokenURI(uint256 _tokenId) public view override(ERC721, IERC721Metadata) returns (string memory) {
        LatestTroveData memory latestTroveData = troveManager.getLatestTroveData(_tokenId);

        IMetadataNFT.TroveData memory troveData = IMetadataNFT.TroveData({
            _tokenId: _tokenId,
            _owner: ownerOf(_tokenId),
            _collToken: address(collToken),
            _boldToken: address(boldToken),
            _collAmount: latestTroveData.entireColl,
            _debtAmount: latestTroveData.entireDebt,
            _interestRate: latestTroveData.annualInterestRate,
            _status: troveManager.getTroveStatus(_tokenId)
        });

        return metadataNFT.uri(troveData);
    }

    function setWhitelist(IWhitelist _whitelist) external override(ITroveNFT) {
        _requireCallerIsAddressesRegistry();
        
        super._setWhitelist(_whitelist);
    }

    // adds receiver whitelist check
    function transferFrom(address from, address to, uint256 tokenId) public override(ERC721, IERC721) {
        _requireWhitelisted(whitelist, to);
        super.transferFrom(from, to, tokenId);
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

    function _requireCallerIsAddressesRegistry() internal view {
        if (msg.sender != address(addressRegistry)) {
            revert CallerNotAddressesRegistry();
        }
    }
}
