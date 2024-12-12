// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

contract TroveId {
    function addressToTroveId(address _owner, uint256 _ownerIndex) public pure returns (uint256) {
        return uint256(keccak256(abi.encode(_owner, _ownerIndex)));
    }

    function addressToTroveId(address _owner) public pure returns (uint256) {
        return addressToTroveId(_owner, 0);
    }
}
