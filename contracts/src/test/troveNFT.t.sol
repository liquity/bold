pragma solidity 0.8.18;

import "./TestContracts/DevTestSetup.sol";

import "src/NFTMetadata/MetadataNFT.sol";
import "src/TroveNFT.sol";

contract troveNFTTest is DevTestSetup {
    uint256 NUM_COLLATERALS = 3;
    TestDeployer.LiquityContractsDev[] public contractsArray;
    TroveNFT troveNFTWETH;
    uint256 troveIdWETH;
    TroveNFT troveNFTWstETH;
    uint256 troveIdWstETH;
    TroveNFT troveNFTRETH;
    uint256 troveIdRETH;

    function openMulticollateralTroveNoHints100pctWithIndex(
        uint256 _collIndex,
        address _account,
        uint256 _index,
        uint256 _coll,
        uint256 _boldAmount,
        uint256 _annualInterestRate
    ) public returns (uint256 troveId) {
        TroveChange memory troveChange;
        troveChange.debtIncrease = _boldAmount;
        troveChange.newWeightedRecordedDebt = troveChange.debtIncrease * _annualInterestRate;
        uint256 avgInterestRate =
            contractsArray[_collIndex].activePool.getNewApproxAvgInterestRateFromTroveChange(troveChange);
        uint256 upfrontFee = calcUpfrontFee(troveChange.debtIncrease, avgInterestRate);

        vm.startPrank(_account);

        troveId = contractsArray[_collIndex].borrowerOperations.openTrove(
            _account,
            _index,
            _coll,
            _boldAmount,
            0, // _upperHint
            0, // _lowerHint
            _annualInterestRate,
            upfrontFee,
            address(0),
            address(0),
            address(0)
        );

        vm.stopPrank();
    }

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

        TestDeployer.TroveManagerParams[] memory troveManagerParamsArray =
            new TestDeployer.TroveManagerParams[](NUM_COLLATERALS);
        troveManagerParamsArray[0] = TestDeployer.TroveManagerParams(150e16, 110e16, 110e16, 5e16, 10e16);
        troveManagerParamsArray[1] = TestDeployer.TroveManagerParams(160e16, 120e16, 120e16, 5e16, 10e16);
        troveManagerParamsArray[2] = TestDeployer.TroveManagerParams(160e16, 120e16, 120e16, 5e16, 10e16);

        TestDeployer deployer = new TestDeployer();
        TestDeployer.LiquityContractsDev[] memory _contractsArray;
        (_contractsArray, collateralRegistry, boldToken,,, WETH,) =
            deployer.deployAndConnectContractsMultiColl(troveManagerParamsArray);
        // Unimplemented feature (...):Copying of type struct LiquityContracts memory[] memory to storage not yet supported.
        for (uint256 c = 0; c < NUM_COLLATERALS; c++) {
            contractsArray.push(_contractsArray[c]);
        }
        // Set price feeds
        contractsArray[0].priceFeed.setPrice(2000e18);
        contractsArray[1].priceFeed.setPrice(200e18);
        contractsArray[2].priceFeed.setPrice(20000e18);
        // Just in case
        for (uint256 c = 3; c < NUM_COLLATERALS; c++) {
            contractsArray[c].priceFeed.setPrice(2000e18 + c * 1e18);
        }

        // Give some Collateral to test accounts, and approve it to BorrowerOperations
        uint256 initialCollateralAmount = 10_000e18;

        for (uint256 c = 0; c < NUM_COLLATERALS; c++) {
            for (uint256 i = 0; i < 6; i++) {
                // A to F
                giveAndApproveCollateral(
                    contractsArray[c].collToken,
                    accountsList[i],
                    initialCollateralAmount,
                    address(contractsArray[c].borrowerOperations)
                );
                // Approve WETH for gas compensation in all branches
                vm.startPrank(accountsList[i]);
                WETH.approve(address(contractsArray[c].borrowerOperations), type(uint256).max);
                vm.stopPrank();
            }
        }

        // 0 = WETH
        troveIdWETH = openMulticollateralTroveNoHints100pctWithIndex(0, A, 0, 10e18, 10000e18, 5e16);
        // 1 = wstETH
        troveIdWstETH = openMulticollateralTroveNoHints100pctWithIndex(1, A, 0, 100e18, 10000e18, 5e16);
        // 2 = rETH
        troveIdRETH = openMulticollateralTroveNoHints100pctWithIndex(2, A, 0, 100e18, 10000e18, 5e16);
        

        troveNFTWETH = TroveNFT(address(contractsArray[0].troveManager.troveNFT()));
        troveNFTWstETH = TroveNFT(address(contractsArray[1].troveManager.troveNFT()));
        troveNFTRETH = TroveNFT(address(contractsArray[2].troveManager.troveNFT()));
    }

    function testTroveNFTMetadata() public {
        

        assertEq(troveNFTWETH.name(), "Liquity v2 Trove - Wrapped Ether Tester", "Invalid Trove Name");
        assertEq(troveNFTWETH.symbol(), "Lv2T_WETH", "Invalid Trove Symbol");

        assertEq(troveNFTWstETH.name(), "Liquity v2 Trove - Wrapped Staked Ether", "Invalid Trove Name");
        assertEq(troveNFTWstETH.symbol(), "Lv2T_wstETH", "Invalid Trove Symbol");

        assertEq(troveNFTRETH.name(), "Liquity v2 Trove - Rocket Pool ETH", "Invalid Trove Name");
        assertEq(troveNFTRETH.symbol(), "Lv2T_rETH", "Invalid Trove Symbol");
    }

    string top = '<!DOCTYPE html><html lang="en"><head><Title>Test Uri</Title></head><body><div class="container"><img id="image" /><pre id="output"></pre><script>';

    function _writeUriFile(string memory _uri, string memory _name) public {
        string memory pathClean = string.concat("utils/assets/test_output/uri_", _name, ".html");

        try vm.removeFile(pathClean) {} catch {}

        vm.writeLine(pathClean, top);

        vm.writeLine(pathClean, string.concat(
            'var output=document.getElementById("output"),image=document.getElementById("image"),encodedString="', 
            _uri,
            '";',
            'try{let r=JSON.parse(atob(encodedString.split(",")[1]));output.innerText=JSON.stringify(r.attributes,null,2),r.image?image.src=r.image:image.src=""}catch(e){output.innerText="Error decoding or parsing JSON: "+e.message}'));

        vm.writeLine(pathClean, string.concat("</script></div></body></html>"));
    }


    function testTroveURI() public {
        _writeUriFile(troveNFTWETH.tokenURI(troveIdWETH), "weth");
        _writeUriFile(troveNFTWstETH.tokenURI(troveIdWstETH), "wsteth");
        _writeUriFile(troveNFTRETH.tokenURI(troveIdRETH), "reth");

    }

    function testTroveURIAttributes() public {

        string memory uri = troveNFTRETH.tokenURI(troveIdRETH);

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
