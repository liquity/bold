// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script} from "forge-std/Script.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
import {IBorrowerOperationsV1} from "test/Interfaces/LiquityV1/IBorrowerOperationsV1.sol";
import {IPriceFeedV1} from "test/Interfaces/LiquityV1/IPriceFeedV1.sol";
import {ISortedTrovesV1} from "test/Interfaces/LiquityV1/ISortedTrovesV1.sol";
import {ITroveManagerV1} from "test/Interfaces/LiquityV1/ITroveManagerV1.sol";

IBorrowerOperationsV1 constant borrowerOperations = IBorrowerOperationsV1(0x24179CD81c9e782A4096035f7eC97fB8B783e007);
IPriceFeedV1 constant priceFeed = IPriceFeedV1(0x4c517D4e2C851CA76d7eC94B805269Df0f2201De);
ISortedTrovesV1 constant sortedTroves = ISortedTrovesV1(0x8FdD3fbFEb32b28fb73555518f8b361bCeA741A6);
ITroveManagerV1 constant troveManager = ITroveManagerV1(0xA39739EF8b0231DbFA0DcdA07d7e29faAbCf4bb2);

contract Runner {
    function _revert(bytes memory revertData) internal pure {
        assembly {
            revert(add(32, revertData), mload(revertData))
        }
    }

    function run() external payable {
        uint256 borrowedLusd = 1_000_000 ether;
        uint256 redeemedLusd = 1_000 ether;

        uint256 price = priceFeed.fetchPrice();
        address lastTrove = sortedTroves.getLast();

        if (troveManager.getCurrentICR(lastTrove, price) < 1.1 ether) {
            troveManager.liquidateTroves(50);
            lastTrove = sortedTroves.getLast();
            require(troveManager.getCurrentICR(lastTrove, price) >= 1.1 ether, "too much to liquidate, try again");
        }

        uint256 borrowingRate = troveManager.getBorrowingRateWithDecay();
        uint256 borrowingFee = borrowedLusd * borrowingRate / 1 ether;
        uint256 debt = borrowedLusd + borrowingFee + 200 ether;

        uint256 coll = Math.ceilDiv(debt * 1.1 ether, price);
        require(address(this).balance >= coll, "balance < coll");

        borrowerOperations.openTrove{value: coll}({
            _LUSDAmount: borrowedLusd,
            _maxFeePercentage: borrowingRate,
            _upperHint: lastTrove,
            _lowerHint: address(0)
        });

        require(sortedTroves.getLast() == address(this), "last Trove != new Trove");

        uint256 redeemedColl = redeemedLusd * 1 ether / price;
        uint256 balanceBefore = address(this).balance;

        troveManager.redeemCollateral({
            _LUSDamount: redeemedLusd,
            _maxFeePercentage: 1 ether,
            _maxIterations: 1,
            _firstRedemptionHint: address(this),
            _upperPartialRedemptionHint: lastTrove,
            _lowerPartialRedemptionHint: lastTrove,
            _partialRedemptionHintNICR: (coll - redeemedColl) * 100 ether / (debt - redeemedLusd)
        });

        uint256 redemptionFee = redeemedColl * troveManager.getBorrowingRateWithDecay() / 1 ether;
        require(address(this).balance - balanceBefore == redeemedColl - redemptionFee, "coll received != expected");

        (bool success, bytes memory returnData) = msg.sender.call{value: address(this).balance}("");
        if (!success) _revert(returnData);
    }

    receive() external payable {}
}

contract GenerateStakingRewards is Script {
    function run() external {
        vm.startBroadcast();

        Runner runner = new Runner();
        runner.run{value: msg.sender.balance * 9 / 10}();
    }
}
