// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";
import "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import "./Interfaces/ITroveNFT.sol";
import "./Interfaces/IAddressesRegistry.sol";

import {IMetadataNFT} from "./NFTMetadata/MetadataNFT.sol";
import {ITroveManager} from "./Interfaces/ITroveManager.sol";

contract TroveNFT is ERC721, ITroveNFT {
    ITroveManager public immutable troveManager;
    IERC20Metadata internal immutable collToken;
    IBoldToken internal immutable boldToken;

    IMetadataNFT public immutable metadataNFT;

    address public governor;
    address public externalNFTUriAddress = address(0);

    constructor(IAddressesRegistry _addressesRegistry, address _governor)
        ERC721(
            string.concat("Nerite - ", _addressesRegistry.collToken().name()),
            string.concat("NERITE_", _addressesRegistry.collToken().symbol())
        )
    {
        troveManager = _addressesRegistry.troveManager();
        collToken = _addressesRegistry.collToken();
        metadataNFT = _addressesRegistry.metadataNFT();
        boldToken = _addressesRegistry.boldToken();
        governor = _governor;
    }

    function tokenURI(uint256 _tokenId) public view override(ERC721, IERC721Metadata) returns (string memory) {
        
        //governor can update the URI externally at any time 
        //without effecting the NFT storage or other parts of the protocol.
        if (externalNFTUriAddress != address(0)) {
            return IExternalNFTUri(externalNFTUriAddress).tokenURI(_tokenId);
        }

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

    function governorUpdateURI(address _externalNFTUriAddress) external {
        require(msg.sender == governor, "TroveNFT: Caller is not the governor.");
        externalNFTUriAddress = _externalNFTUriAddress;
    }

    function updateGovernor(address _governor) external {
        require(msg.sender == governor, "TroveNFT: Caller is not the governor.");
        governor = _governor;
    }
}
