// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import {ITokenWrapper} from "../Interfaces/ITokenWrapper.sol";

// token wrapper with decimal scaling 
contract TokenWrapper is ERC20, ITokenWrapper {
    IERC20Metadata private immutable _underlying;

    uint256 private immutable _underlyingDecimals; 

    constructor(IERC20Metadata underlyingToken) 
        ERC20(
            string(abi.encodePacked("Wrapped ", underlyingToken.name())), 
            string(abi.encodePacked("w", underlyingToken.symbol()))
        ) 
    {
        _underlying = underlyingToken;
        _underlyingDecimals =  underlyingToken.decimals(); 

        require(_underlyingDecimals <= 18, "Max 18 underlying decimals");
    }

    function underlying() public view returns (IERC20Metadata) {
        return _underlying;
    }

    function deposit(uint256 amount) external override {
        address sender = msg.sender;
        require(sender != address(this), "Wrapper can't deposit");
        SafeERC20.safeTransferFrom(_underlying, sender, address(this), amount);
        
        uint256 scaledAmount = amount * 10 ** (18 - _underlyingDecimals);
        _mint(sender, scaledAmount);
    }

    function withdraw(uint256 amount) external override{
        address sender = msg.sender;

        _burn(sender, amount);
        
        uint256 scaledAmount = amount / 10 ** (18 - _underlyingDecimals);

        SafeERC20.safeTransfer(_underlying, sender, scaledAmount);
    }
}