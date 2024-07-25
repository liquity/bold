// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.18;

import "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";

import "./Dependencies/Ownable.sol";
import "./Interfaces/ITroveNFT.sol";

// import "forge-std/console2.sol";

contract TroveNFT is Ownable, ERC721, ITroveNFT {
    string internal constant NAME = "TroveNFT"; // TODO
    string internal constant SYMBOL = "Lv2T"; // TODO

    ITroveManager public troveManager;

    constructor() ERC721(NAME, SYMBOL) {}

    function setAddresses(ITroveManager _troveManager) external override onlyOwner {
        troveManager = _troveManager;

        _renounceOwnership();
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
