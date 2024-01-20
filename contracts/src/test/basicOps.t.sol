pragma solidity 0.8.18;

import "./TestContracts/DevTestSetup.sol";

contract BasicOps is DevTestSetup {

    function testOpenTrove() public {
        uint256 trovesCount = troveManager.getTroveOwnersCount();
        assertEq(trovesCount, 0);

        vm.startPrank(A);
        priceFeed.setPrice(2000e18);
        borrowerOperations.openTrove{value: 2 ether}(1e18, 2000e18, ZERO_ADDRESS, ZERO_ADDRESS);

        trovesCount = troveManager.getTroveOwnersCount();
        assertEq(trovesCount, 1);
    }

     function testCloseTrove() public {
        vm.startPrank(A);
        priceFeed.setPrice(2000e18);
        borrowerOperations.openTrove{value: 2 ether}(1e18, 2000e18, ZERO_ADDRESS, ZERO_ADDRESS);
        vm.stopPrank();

        vm.startPrank(B);
        priceFeed.setPrice(2000e18);
        borrowerOperations.openTrove{value: 2 ether}(1e18, 2000e18, ZERO_ADDRESS, ZERO_ADDRESS);

        uint256 trovesCount = troveManager.getTroveOwnersCount();
        assertEq(trovesCount, 2);
       
        vm.startPrank(B);
        borrowerOperations.closeTrove();
        vm.stopPrank();
    
        // Check Troves count reduced by 1
        trovesCount = troveManager.getTroveOwnersCount();
        assertEq(trovesCount, 1);
    }

    // adjustTrove

    // redeem

    // liquidate

    // SP deposit

    // SP withdraw
}