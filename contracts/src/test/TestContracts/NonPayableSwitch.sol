// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
// import "forge-std/console.sol";


contract NonPayableSwitch {
    using SafeERC20 for IERC20;

    bool isPayable;
    IERC20 public ETH;

    function setETH(IERC20 _eth) external {
        ETH = _eth;
    }

    function setPayable(bool _isPayable) external {
        isPayable = _isPayable;
    }

    function forward(address _dest, bytes calldata _data) external payable {
        //console.logBytes(_data);
        (bool success, bytes memory returnData) = _dest.call{ value: msg.value }(_data);
        //console.log(msg.value, "msg.value");
        //console.log(success, "success");
        //console.logBytes(returnData);
        require(success, string(returnData));
    }

    function receiveETH(uint256 _amount) external {
        // Pull ETH tokens from sender
        ETH.safeTransferFrom(msg.sender, address(this), _amount);
    }

    receive() external payable {
        require(isPayable);
    }
}
