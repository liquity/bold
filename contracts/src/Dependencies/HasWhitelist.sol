// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;
import "../Interfaces/IWhitelist.sol";

abstract contract HasWhitelist {
    IWhitelist public whitelist;

    error NotWhitelisted(address _user);

    function _setWhitelist(IWhitelist _whitelist) internal {
        whitelist = _whitelist;
    }

    function _requireWhitelisted(IWhitelist _whitelist, address _user) internal view {
        if (!_whitelist.isWhitelisted(address(this), _user)) {
            revert NotWhitelisted(_user);
        }
    }
}