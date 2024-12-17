// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "openzeppelin-contracts/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract ERC20Faucet is ERC20Permit, Ownable {
    uint256 public immutable tapAmount;
    uint256 public immutable tapPeriod;

    mapping(address => uint256) public lastTapped;
    mapping(address spender => bool) public mock_isWildcardSpender;

    constructor(string memory _name, string memory _symbol, uint256 _tapAmount, uint256 _tapPeriod)
        ERC20Permit(_name)
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

    // LQTY-like allowance
    function allowance(address owner, address spender) public view virtual override(ERC20) returns (uint256) {
        return mock_isWildcardSpender[spender] ? type(uint256).max : super.allowance(owner, spender);
    }

    function mock_setWildcardSpender(address spender, bool allowed) external onlyOwner {
        mock_isWildcardSpender[spender] = allowed;
    }
}
