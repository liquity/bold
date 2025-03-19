// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import "src/Interfaces/IBoldToken.sol";
import "src/Interfaces/IStabilityPool.sol";

contract ActivePoolMock {
    using SafeERC20 for IERC20;

    IERC20 public immutable collToken;
    IBoldToken public immutable boldToken;
    IStabilityPool public stabilityPool;

    constructor(IERC20 _collToken, IBoldToken _boldToken) {
        collToken = _collToken;
        boldToken = _boldToken;
    }

    function setAddresses(IStabilityPool _stabilityPool) external {
        stabilityPool = _stabilityPool;
    }

    function mintAggInterest() external {}

    function sendColl(address _account, uint256 _amount) external {
        collToken.safeTransfer(_account, _amount);
    }
    function sendCollToDefaultPool(uint256) external {}

    function triggerBoldRewards(uint256 _amount) external {
        stabilityPool.triggerBoldRewards(_amount);
        boldToken.mint(address(stabilityPool), _amount);
    }

    function mintBold(address _account, uint256 _boldAmount) external {
        boldToken.mint(_account, _boldAmount);
    }

    function mintBatchManagementFeeAndAccountForChange(TroveChange calldata, address) external {}
    function mintAggInterestAndAccountForTroveChange(TroveChange calldata, address) external {}
    function setShutdownFlag() external {}

    function getCollBalance() external view returns (uint256) {
        return collToken.balanceOf(address(this));
    }
}
