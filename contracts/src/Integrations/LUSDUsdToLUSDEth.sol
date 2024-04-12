// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface IPriceFeed {
    function latestAnswer() external view returns (int256);
}

contract BoldUsdToBoldEth is IPriceFeed {
    IPriceFeed public constant Bold_USD = IPriceFeed(0x3D7aE7E594f2f2091Ad8798313450130d0Aba3a0);
    IPriceFeed public constant ETH_USD = IPriceFeed(0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419);

    constructor() {}

    function latestAnswer() external view override returns (int256) {
        return (Bold_USD.latestAnswer() * 1 ether) / ETH_USD.latestAnswer();
    }
}
