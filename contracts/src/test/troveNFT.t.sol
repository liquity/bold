pragma solidity 0.8.18;

import "./TestContracts/DevTestSetup.sol";

import "src/NFTMetadata/MetadataNFT.sol";
import "src/TroveNFT.sol";

contract troveNFTTest is DevTestSetup {
    function _openTrove() internal returns (uint256) {
        priceFeed.setPrice(2000e18);

        vm.startPrank(A);
        uint256 troveId = borrowerOperations.openTrove(
            A, 0, 2e18, 2000e18, 0, 0, MIN_ANNUAL_INTEREST_RATE, 1000e18, address(0), address(0), address(0)
        );

        return troveId;
    }

    function testTroveNFTMetadata() public {
        _openTrove();

        assertEq(troveNFT.name(), "Liquity v2 Trove - Wrapped Ether Tester", "Invalid Trove Name");
        assertEq(troveNFT.symbol(), "Lv2T_WETH", "Invalid Trove Symbol");
    }

    function testTroveURI() public {
        uint256 troveId = _openTrove();

        TroveNFT troveNFT = TroveNFT(address(troveManager.troveNFT()));

        string memory uri = troveNFT.tokenURI(troveId);

        emit log_string(uri);
    }
}
