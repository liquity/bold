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

    function testTroveURIAttributes() public {
        uint256 troveId = _openTrove();

        TroveNFT troveNFT = TroveNFT(address(troveManager.troveNFT()));

        string memory uri = troveNFT.tokenURI(troveId);

        emit log_string(uri);

        /**
         * TODO: validate each individual attribute, or manually make a json and validate it all at once
         *     // Check for expected attributes
         *     assertTrue(LibString.contains(uri, '"trait_type": "Collateral Token"'), "Collateral Token attribute missing");
         *     assertTrue(LibString.contains(uri, '"trait_type": "Collateral Amount"'), "Collateral Amount attribute missing");
         *     assertTrue(LibString.contains(uri, '"trait_type": "Debt Token"'), "Debt Token attribute missing");
         *     assertTrue(LibString.contains(uri, '"trait_type": "Debt Amount"'), "Debt Amount attribute missing");
         *     assertTrue(LibString.contains(uri, '"trait_type": "Interest Rate"'), "Interest Rate attribute missing");
         *     assertTrue(LibString.contains(uri, '"trait_type": "Status"'), "Status attribute missing");
         *
         *     // Check for expected values
         *     //assertTrue(LibString.contains(uri, string.concat('"value": "', Strings.toHexString(address(collateral)))), "Incorrect Collateral Token value");
         *     assertTrue(LibString.contains(uri, '"value": "2000000000000000000"'), "Incorrect Collateral Amount value");
         *     assertTrue(LibString.contains(uri, string.concat('"value": "', Strings.toHexString(address(boldToken)))), "Incorrect Debt Token value");
         *     assertTrue(LibString.contains(uri, '"value": "1000000000000000000000"'), "Incorrect Debt Amount value");
         *     assertTrue(LibString.contains(uri, '"value": "5000000000000000"'), "Incorrect Interest Rate value");
         *     assertTrue(LibString.contains(uri, '"value": "Active"'), "Incorrect Status value");
         */
    }
}
