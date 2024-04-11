// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.18;

import "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-contracts/contracts/access/Ownable.sol";

contract ERC20Faucet is ERC20, Ownable {
    uint256 public immutable tapAmount;
    uint256 public immutable tapPeriod;

    mapping(address => uint256) public lastTapped;

    constructor(string memory _name, string memory _symbol, uint256 _tapAmount, uint256 _tapPeriod)
        ERC20(_name, _symbol)
    {
        tapAmount = _tapAmount;
        tapPeriod = _tapPeriod;
    }

    function mint(address _to, uint256 _amount) external onlyOwner {
        _mint(_to, _amount);
    }

    function tapTo(address receiver) public {
        uint256 timeNow = _requireNotRecentlyTapped(receiver);

        _mint(receiver, tapAmount);
        lastTapped[receiver] = timeNow;
    }

    function tap() external {
        tapTo(msg.sender);
    }

    function _requireNotRecentlyTapped(address receiver) internal view returns (uint256 timeNow) {
        timeNow = block.timestamp;

        require(timeNow >= lastTapped[receiver] + tapPeriod, "ERC20Faucet: must wait before tapping again");
    }
}
