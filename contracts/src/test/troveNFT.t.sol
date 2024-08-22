pragma solidity 0.8.18;

import "./TestContracts/DevTestSetup.sol";

contract TroveManagerTest is DevTestSetup {
    function testTroveNFTMetadata() public {
        priceFeed.setPrice(2000e18);

        vm.startPrank(A);
        borrowerOperations.openTrove(
            A, 0, 2e18, 2000e18, 0, 0, MIN_ANNUAL_INTEREST_RATE, 1000e18, address(0), address(0), address(0)
        );

        IERC721Metadata troveNFT = troveManager.troveNFT();

        assertEq(troveNFT.name(), "Liquity v2 Trove - Wrapped Ether Tester", "Invalid Trove Name");
        assertEq(troveNFT.symbol(), "Lv2T_WETH", "Invalid Trove Symbol");
    }
}
