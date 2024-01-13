// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "../Interfaces/IBoldToken.sol";

contract BoldTokenCaller {
    IBoldToken Bold;

    function setBold(IBoldToken _bold) external {
        Bold = _bold;
    }

    function boldMint(address _account, uint _amount) external {
        Bold.mint(_account, _amount);
    }

    function boldBurn(address _account, uint _amount) external {
        Bold.burn(_account, _amount);
    }

    function boldSendToPool(address _sender,  address _poolAddress, uint256 _amount) external {
        Bold.sendToPool(_sender, _poolAddress, _amount);
    }

    function boldReturnFromPool(address _poolAddress, address _receiver, uint256 _amount ) external {
        Bold.returnFromPool(_poolAddress, _receiver, _amount);
    }
}
