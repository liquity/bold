// SPDX-License-Identifier: GPL-3.0
// Docgen-SOLC: 0.8.25

pragma solidity 0.8.24;

import "../Interfaces/IOwned.sol";

// https://docs.synthetix.io/contracts/source/contracts/owned
contract Owned is IOwned {
    address public override owner;
    address public override nominatedOwner;

    event OwnerNominated(address newOwner);
    event OwnerChanged(address oldOwner, address newOwner);

    constructor(address _owner) {
        require(_owner != address(0), "Owned/owner-zero");
        owner = _owner;

        emit OwnerChanged(address(0), _owner);
    }

    function nominateNewOwner(address _owner) external virtual override onlyOwner {
        nominatedOwner = _owner;

        emit OwnerNominated(_owner);
    }

    function acceptOwnership() external virtual override {
        require(msg.sender == nominatedOwner, "Owned/not-nominated");

        emit OwnerChanged(owner, nominatedOwner);

        owner = nominatedOwner;
        nominatedOwner = address(0);
    }

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    function _onlyOwner() private view {
        require(msg.sender == owner, "Owned/not-owner");
    }
}
