// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";
import "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import "./Interfaces/ITroveNFT.sol";
import "./Interfaces/IAddressesRegistry.sol";
import "./Interfaces/IExternalURIgetter.sol";

import {IMetadataNFT} from "./NFTMetadata/MetadataNFT.sol";
import {ITroveManager} from "./Interfaces/ITroveManager.sol";

import "./Types/LatestTroveData.sol";

contract TroveNFT is ERC721, ITroveNFT {
    ITroveManager public immutable troveManager;
    IERC20Metadata internal immutable collToken;
    IBoldToken internal immutable boldToken;

    IMetadataNFT public immutable metadataNFT;

    address public governor;
    bool public uriUpdated = false;
    address public externalURIgetter;



    constructor(IAddressesRegistry _addressesRegistry, address governor)
        ERC721(
            string.concat("Liquity V2 - ", _addressesRegistry.collToken().name()),
            string.concat("LV2_", _addressesRegistry.collToken().symbol())
        )
    {
        troveManager = _addressesRegistry.troveManager();
        collToken = _addressesRegistry.collToken();
        metadataNFT = _addressesRegistry.metadataNFT();
        boldToken = _addressesRegistry.boldToken();
    }

    function tokenURI(uint256 _tokenId) public view override(ERC721, IERC721Metadata) returns (string memory) {
        if (uriUpdated) {
            return IExternalURIgetter(externalURIgetter).tokenURI(_tokenId);
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

    function updateGovernor(address _governor) external {
        require(msg.sender == governor, "TroveNFT: Caller is not the governor");
        governor = _governor;
    }

    function updateUri(address _externalURIgetter) external {
        require(msg.sender == governor, "TroveNFT: Caller is not the governor");
        uriUpdated = true;
        externalURIgetter = _externalURIgetter;
    }
}
