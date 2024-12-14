// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
// import "forge-std/console2.sol";

contract NonPayableSwitch {
    using SafeERC20 for IERC20;

    bool isPayable;
    IERC20 public collToken;

    function setColl(IERC20 _eth) external {
        collToken = _eth;
    }

    function setPayable(bool _isPayable) external {
        isPayable = _isPayable;
    }

    function forward(address _dest, bytes calldata _data) external payable {
        //console2.logBytes(_data);
        (bool success, bytes memory returnData) = _dest.call{value: msg.value}(_data);
        //console2.log(msg.value, "msg.value");
        //console2.log(success, "success");
        //console2.logBytes(returnData);
        require(success, string(returnData));
    }

    function receiveColl(uint256 _amount) external {
        // Pull Coll tokens from sender
        collToken.safeTransferFrom(msg.sender, address(this), _amount);
    }

    receive() external payable {
        require(isPayable);
    }
}
