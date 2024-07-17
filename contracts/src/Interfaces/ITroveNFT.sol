// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "openzeppelin-contracts/contracts/token/ERC721/IERC721.sol";

import "./ITroveManager.sol";

interface ITroveNFT is IERC721 {
    function setAddresses(ITroveManager _troveManager) external;
    function mint(address _owner, uint256 _troveId) external;
    function burn(uint256 _troveId) external;
}
