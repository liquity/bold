// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "openzeppelin-contracts/contracts/token/ERC721/extensions/IERC721Metadata.sol";

import "./ITroveManager.sol";

interface ITroveNFT is IERC721Metadata {
    function mint(address _owner, uint256 _troveId) external;
    function burn(uint256 _troveId) external;
    function updateGovernor(address _governor) external;
    function governorUpdateURI(address _externalNFTUriAddress) external;
}

interface IExternalNFTUri {
    function tokenURI(uint256 _tokenId) external view returns (string memory);
}
