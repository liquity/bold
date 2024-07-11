pragma solidity ^0.8.18;

import "./TestContracts/DevTestSetup.sol";
import "./TestContracts/WETH.sol";
import "../Zappers/WETHZapper.sol";


contract ZapperWETHTest is DevTestSetup {
    WETHZapper wethZapper;

    function setUp() public override {
        // Start tests at a non-zero timestamp
        vm.warp(block.timestamp + 600);

        accounts = new Accounts();
        createAccounts();

        (A, B, C, D, E, F, G) = (
            accountsList[0],
            accountsList[1],
            accountsList[2],
            accountsList[3],
            accountsList[4],
            accountsList[5],
            accountsList[6]
        );

        WETH = new WETH9();

        TroveManagerParams[] memory troveManagerParams = new TroveManagerParams[](1);
        troveManagerParams[0] = TroveManagerParams(110e16, 110e16, 5e16, 10e16);

        LiquityContracts[] memory contractsArray;
        (contractsArray, collateralRegistry, boldToken,,) = _deployAndConnectContracts(troveManagerParams, WETH);

        // Set price feeds
        contractsArray[0].priceFeed.setPrice(2000e18);

        // Give some Collateral to test accounts
        uint256 initialCollateralAmount = 10_000e18;

        // A to F
        for (uint256 i = 0; i < 6; i++) {
            // Give some raw ETH to test accounts
            deal(accountsList[i], initialCollateralAmount);
        }

        // Set first branch as default
        borrowerOperations = contractsArray[0].borrowerOperations;
        troveManager = contractsArray[0].troveManager;

        // Deploy zapper (TODO: should we move it to deployment.sol?)
        wethZapper = new WETHZapper(troveManager);
    }

    function testCanOpenTrove() external {
        uint256 ethAmount = 10 ether;
        uint256 boldAmount = 10000e18;

        uint256 ethBalanceBefore = A.balance;

        vm.startPrank(A);
        uint256 troveId = wethZapper.openTroveWithRawETH{value: ethAmount + ETH_GAS_COMPENSATION}(A, 0, boldAmount, 0, 0, 5e16, 1000e18);
        vm.stopPrank();

        assertEq(troveManager.ownerOf(troveId), A, "Wrong owner");
        assertGt(troveId, 0, "Trove id should be set");
        assertEq(troveManager.getTroveEntireColl(troveId), ethAmount, "Coll mismatch");
        assertGt(troveManager.getTroveEntireDebt(troveId), boldAmount, "Debt mismatch");
        assertEq(boldToken.balanceOf(A), boldAmount, "BOLD bal mismatch");
        assertEq(A.balance, ethBalanceBefore - (ethAmount + ETH_GAS_COMPENSATION), "ETH bal mismatch");
    }

    function testCanAddColl() external {
        uint256 ethAmount1 = 10 ether;
        uint256 boldAmount = 10000e18;
        uint256 ethAmount2 = 5 ether;

        vm.startPrank(A);
        uint256 troveId = wethZapper.openTroveWithRawETH{value: ethAmount1 + ETH_GAS_COMPENSATION}(A, 0, boldAmount, 0, 0, 5e16, 1000e18);
        vm.stopPrank();

        uint256 ethBalanceBefore = A.balance;
        vm.startPrank(A);
        wethZapper.addCollWithRawETH{value: ethAmount2}(troveId);
        vm.stopPrank();

        assertEq(troveManager.getTroveEntireColl(troveId), ethAmount1 + ethAmount2, "Coll mismatch");
        assertGt(troveManager.getTroveEntireDebt(troveId), boldAmount, "Debt mismatch");
        assertEq(boldToken.balanceOf(A), boldAmount, "BOLD bal mismatch");
        assertEq(A.balance, ethBalanceBefore - ethAmount2, "ETH bal mismatch");
    }
}
