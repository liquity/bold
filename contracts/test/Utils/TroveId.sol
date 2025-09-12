// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

contract TroveId {
    function addressToTroveId(address _sender, address _owner, uint256 _ownerIndex) public pure returns (uint256) {
        return uint256(keccak256(abi.encode(_sender, _owner, _ownerIndex)));
    }

    function addressToTroveId(address _owner, uint256 _ownerIndex) public pure returns (uint256) {
        return addressToTroveId(_owner, _owner, _ownerIndex);
    }

    function addressToTroveId(address _owner) public pure returns (uint256) {
        return addressToTroveId(_owner, 0);
    }

    function addressToTroveIdThroughZapper(address _zapper, address _sender, address _owner, uint256 _ownerIndex)
        public
        pure
        returns (uint256)
    {
        uint256 index = uint256(keccak256(abi.encode(_sender, _ownerIndex)));
        return uint256(keccak256(abi.encode(_zapper, _owner, index)));
    }

    function addressToTroveIdThroughZapper(address _zapper, address _owner, uint256 _ownerIndex)
        public
        pure
        returns (uint256)
    {
        return addressToTroveIdThroughZapper(_zapper, _owner, _owner, _ownerIndex);
    }

    function addressToTroveIdThroughZapper(address _zapper, address _owner) public pure returns (uint256) {
        return addressToTroveIdThroughZapper(_zapper, _owner, 0);
    }
}
