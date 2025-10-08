pragma solidity 0.8.24;

import "./TestContracts/DevTestSetup.sol";

import "src/NFTMetadata/MetadataNFT.sol";
import "src/TroveNFT.sol";

import "lib/Solady/src/utils/Base64.sol";

contract troveNFTTest is DevTestSetup {
    uint256 NUM_COLLATERALS = 3;
    uint256 NUM_VARIANTS = 4;
    TestDeployer.LiquityContractsDev[] public contractsArray;
    TroveNFT troveNFTWETH;
    TroveNFT troveNFTWstETH;
    TroveNFT troveNFTRETH;
    uint256[] troveIds;

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
        troveManagerParamsArray[0] = TestDeployer.TroveManagerParams(150e16, 110e16, 10e16, 110e16, 5e16, 10e16);
        troveManagerParamsArray[1] = TestDeployer.TroveManagerParams(160e16, 120e16, 10e16, 120e16, 5e16, 10e16);
        troveManagerParamsArray[2] = TestDeployer.TroveManagerParams(160e16, 120e16, 10e16, 120e16, 5e16, 10e16);

        TestDeployer deployer = new TestDeployer();
        TestDeployer.LiquityContractsDev[] memory _contractsArray;
        (_contractsArray, collateralRegistry, boldToken,,, WETH) =
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

        systemParams = contractsArray[0].systemParams;
        
        troveIds = new uint256[](NUM_VARIANTS);

        // 0 = WETH
        troveIds[0] = openMulticollateralTroveNoHints100pctWithIndex(0, A, 0, 10e18, 10000e18, 5e16);
        troveIds[1] = openMulticollateralTroveNoHints100pctWithIndex(0, A, 1, 10e18, 10000e18, 5e16);
        troveIds[2] = openMulticollateralTroveNoHints100pctWithIndex(0, A, 2, 10e18, 10000e18, 5e16);
        troveIds[3] = openMulticollateralTroveNoHints100pctWithIndex(0, A, 10, 10e18, 10000e18, 5e16);

        // 1 = wstETH
        openMulticollateralTroveNoHints100pctWithIndex(1, A, 0, 100e18, 10000e18, 5e16);
        openMulticollateralTroveNoHints100pctWithIndex(1, A, 1, 100e18, 10000e18, 5e16);
        openMulticollateralTroveNoHints100pctWithIndex(1, A, 2, 100e18, 10000e18, 5e16);
        openMulticollateralTroveNoHints100pctWithIndex(1, A, 10, 100e18, 10000e18, 5e16);

        // 2 = rETH
        openMulticollateralTroveNoHints100pctWithIndex(2, A, 0, 100e18, 10000e18, 5e16);
        openMulticollateralTroveNoHints100pctWithIndex(2, A, 1, 100e18, 10000e18, 5e16);
        openMulticollateralTroveNoHints100pctWithIndex(2, A, 2, 100e18, 10000e18, 5e16);
        openMulticollateralTroveNoHints100pctWithIndex(2, A, 10, 100e18, 10000e18, 5e16);

        troveNFTWETH = TroveNFT(address(contractsArray[0].troveManager.troveNFT()));
        troveNFTWstETH = TroveNFT(address(contractsArray[1].troveManager.troveNFT()));
        troveNFTRETH = TroveNFT(address(contractsArray[2].troveManager.troveNFT()));
    }

    function testTroveNFTMetadata() public view {
        assertEq(troveNFTWETH.name(), "Liquity V2 - Wrapped Ether Tester", "Invalid Trove Name");
        assertEq(troveNFTWETH.symbol(), "LV2_WETH", "Invalid Trove Symbol");

        assertEq(troveNFTWstETH.name(), "Liquity V2 - Wrapped Staked Ether", "Invalid Trove Name");
        assertEq(troveNFTWstETH.symbol(), "LV2_wstETH", "Invalid Trove Symbol");

        assertEq(troveNFTRETH.name(), "Liquity V2 - Rocket Pool ETH", "Invalid Trove Name");
        assertEq(troveNFTRETH.symbol(), "LV2_rETH", "Invalid Trove Symbol");
    }

    string topMulti =
        '<!DOCTYPE html><html lang="en"><head><Title>Test Uri</Title><style>.container{display:flex;flex-direction:row;margin-bottom:20px}.container img{width:300px;height:484px;margin-right:20px}.container pre{flex:1}</style></head><body><script>';

    function _writeUriFile(string[] memory _uris) public {
        string memory pathClean = string.concat("utils/assets/test_output/uris.html");

        try vm.removeFile(pathClean) {} catch {}

        vm.writeLine(pathClean, topMulti);

        string memory uriCombined;

        uriCombined = "const encodedStrings=[";
        for (uint256 i = 0; i < _uris.length; i++) {
            uriCombined = string.concat(uriCombined, '"', _uris[i], '",');
        }
        uriCombined = string.concat(uriCombined, "];");

        vm.writeLine(
            pathClean,
            string.concat(
                'function processEncodedString(encodedString) { const container = document.createElement("div"); container.className = "container"; container.innerHTML = ` <img><pre></pre>`; const output = container.querySelector("pre"); const image = container.querySelector("img"); try { const base64Data = encodedString.split(",")[1]; const jsonData = JSON.parse(atob(base64Data)); output.innerText = JSON.stringify(jsonData.attributes, null, 2); image.src = jsonData.image || ""; } catch (error) { output.innerText = `Error decoding or parsing JSON: ${error.message}`; } document.body.appendChild(container); } ',
                uriCombined,
                "encodedStrings.forEach((encodedString) => { processEncodedString(encodedString); });"
            )
        );

        vm.writeLine(pathClean, string.concat("</script></body></html>"));
    }

    function testTroveURI() public {
        string[] memory uris = new string[](NUM_VARIANTS * NUM_COLLATERALS);

        // Let’s redeem so we have some zombies in the result
        deal(address(boldToken), A, 30000e18);
        redeem(A, 30000e18);

        for (uint256 i = 0; i < NUM_VARIANTS; i++) {
            uris[i] = troveNFTWETH.tokenURI(troveIds[i]);
            uris[i + NUM_VARIANTS] = troveNFTWstETH.tokenURI(troveIds[i]);
            uris[i + (NUM_VARIANTS * 2)] = troveNFTRETH.tokenURI(troveIds[i]);
        }

        _writeUriFile(uris);
    }

    function testTroveURIAttributes() public view {
        address collateral = address(contractsArray[0].collToken);

        string memory uri = troveNFTWETH.tokenURI(troveIds[0]);
        string memory uriSplit = LibString.slice(uri, 29, bytes(uri).length);
        string memory decodedUri = string(Base64.decode(uriSplit));

        // Check for expected attributes
        assertTrue(LibString.contains(decodedUri, '"name": "Liquity V2 - '), "NFT Name attribute missing");

        assertTrue(
            LibString.contains(
                decodedUri, '"description": "Liquity V2 is a collateralized debt platform. Users can lock up'
            ),
            "NFT description attribute missing"
        );

        assertTrue(
            LibString.contains(decodedUri, '"trait_type": "Collateral Token"'), "Collateral Token attribute missing"
        );
        assertTrue(
            LibString.contains(decodedUri, '"trait_type": "Collateral Amount"'), "Collateral Amount attribute missing"
        );
        assertTrue(LibString.contains(decodedUri, '"trait_type": "Debt Token"'), "Debt Token attribute missing");
        assertTrue(LibString.contains(decodedUri, '"trait_type": "Debt Amount"'), "Debt Amount attribute missing");
        assertTrue(LibString.contains(decodedUri, '"trait_type": "Interest Rate"'), "Interest Rate attribute missing");
        assertTrue(LibString.contains(decodedUri, '"trait_type": "Status"'), "Status attribute missing");

        // Check for expected values
        assertTrue(
            LibString.contains(decodedUri, string.concat('"value": "', Strings.toHexString(collateral))),
            "Incorrect Collateral Token value"
        );
        assertTrue(
            LibString.contains(decodedUri, '"value": "10000000000000000000"'), "Incorrect Collateral Amount value"
        );
        assertTrue(
            LibString.contains(decodedUri, string.concat('"value": "', Strings.toHexString(address(boldToken)))),
            "Incorrect Debt Token value"
        );
        assertTrue(LibString.contains(decodedUri, '"value": "10009589041095890410958"'), "Incorrect Debt Amount value");
        assertTrue(LibString.contains(decodedUri, '"value": "50000000000000000"'), "Incorrect Interest Rate value");
        assertTrue(LibString.contains(decodedUri, '"value": "Active"'), "Incorrect Status value");
    }

    function test_toLocale() public pure {
        string memory result = numUtils.toLocale("123456789");
        //console.log(result);
        assertEq(result, "123,456,789");
    }

    function test_toLocaleString() public pure {
        string memory result = numUtils.toLocaleString(123456789, 0, 2);
        assertEq(result, "123,456,789.00");

        result = numUtils.toLocaleString(123456789, 1, 2);
        assertEq(result, "12,345,678.90");

        result = numUtils.toLocaleString(123456789, 1, 3);
        assertEq(result, "12,345,678.900");

        result = numUtils.toLocaleString(123456789, 1, 0);
        assertEq(result, "12,345,678");

        result = numUtils.toLocaleString(123456789, 2, 0);
        assertEq(result, "1,234,567");

        result = numUtils.toLocaleString(123456789, 3, 0);
        assertEq(result, "123,456");

        result = numUtils.toLocaleString(123456789, 4, 0);
        assertEq(result, "12,345");

        result = numUtils.toLocaleString(123456789, 5, 0);
        assertEq(result, "1,234");

        result = numUtils.toLocaleString(123456789, 6, 0);
        assertEq(result, "123");

        result = numUtils.toLocaleString(123456789, 7, 0);
        assertEq(result, "12");

        result = numUtils.toLocaleString(123456789, 8, 0);
        assertEq(result, "1");

        result = numUtils.toLocaleString(123456789, 9, 0);
        assertEq(result, "0");

        result = numUtils.toLocaleString(123456789, 10, 0);
        assertEq(result, "0");

        result = numUtils.toLocaleString(123456789, 10, 1);
        assertEq(result, "0.1");

        result = numUtils.toLocaleString(123456789, 10, 2);
        assertEq(result, "0.12");

        result = numUtils.toLocaleString(123456789, 10, 3);
        assertEq(result, "0.123");

        result = numUtils.toLocaleString(123456789, 10, 4);
        assertEq(result, "0.1234");

        result = numUtils.toLocaleString(123456789, 12, 3);
        assertEq(result, "0.001", "12, 3");

        result = numUtils.toLocaleString(123456789, 3, 3);
        assertEq(result, "123,456.789", "3");

        result = numUtils.toLocaleString(123456789, 10, 10);
        assertEq(result, "0.1234567890", "10");

        result = numUtils.toLocaleString(123456789, 10, 11);
        assertEq(result, "0.12345678900", "10,11");

        result = numUtils.toLocaleString(123456789, 11, 11);
        assertEq(result, "0.01234567890", "11, 11");

        result = numUtils.toLocaleString(123456789, 11, 12);
        assertEq(result, "0.012345678900", "11, 12");

        result = numUtils.toLocaleString(123456789, 11, 13);
        assertEq(result, "0.0123456789000", "11, 13");

        result = numUtils.toLocaleString(123456789, 10, 18);
        assertEq(result, "0.123456789000000000", "11, 18");

        result = numUtils.toLocaleString(123456789, 1, 9);
        assertEq(result, "12,345,678.900000000");

        result = numUtils.toLocaleString(1234567890, 2, 1);
        assertEq(result, "12,345,678.9");

        result = numUtils.toLocaleString(12345678900, 3, 1);
        assertEq(result, "12,345,678.9");

        result = numUtils.toLocaleString(123456789000, 4, 1);
        assertEq(result, "12,345,678.9");

        result = numUtils.toLocaleString(1234567890000, 5, 1);
        assertEq(result, "12,345,678.9");

        result = numUtils.toLocaleString(12345678900000, 6, 1);
        assertEq(result, "12,345,678.9");

        result = numUtils.toLocaleString(123456789000000, 7, 1);
        assertEq(result, "12,345,678.9");

        result = numUtils.toLocaleString(1234567890000000, 8, 1);
        assertEq(result, "12,345,678.9");

        result = numUtils.toLocaleString(12345678900000000, 9, 1);
        assertEq(result, "12,345,678.9");

        result = numUtils.toLocaleString(123456789000000000, 10, 1);
        assertEq(result, "12,345,678.9");

        result = numUtils.toLocaleString(123456789000000001, 10, 1);
        assertEq(result, "12,345,678.9");

        result = numUtils.toLocaleString(123456789000000001, 10, 2);
        assertEq(result, "12,345,678.90");

        result = numUtils.toLocaleString(123456789000000001, 10, 3);
        assertEq(result, "12,345,678.900");

        result = numUtils.toLocaleString(123456789000000001, 10, 4);
        assertEq(result, "12,345,678.9000");

        result = numUtils.toLocaleString(123456789000000001, 10, 5);
        assertEq(result, "12,345,678.90000");

        result = numUtils.toLocaleString(123456789000000001, 10, 6);
        assertEq(result, "12,345,678.900000");

        result = numUtils.toLocaleString(123456789000000001, 10, 7);
        assertEq(result, "12,345,678.9000000");

        result = numUtils.toLocaleString(123456789000000001, 10, 8);
        assertEq(result, "12,345,678.90000000");

        result = numUtils.toLocaleString(123456789000000001, 10, 9);
        assertEq(result, "12,345,678.900000000");

        result = numUtils.toLocaleString(123456789000000001, 10, 10);
        assertEq(result, "12,345,678.9000000001");

        result = numUtils.toLocaleString(123456789000000001, 10, 11);
        assertEq(result, "12,345,678.90000000010");

        result = numUtils.toLocaleString(10, 0, 0);
        assertEq(result, "10");

        result = numUtils.toLocaleString(10, 1, 0);
        assertEq(result, "1");

        result = numUtils.toLocaleString(10, 2, 1);
        assertEq(result, "0.1");

        result = numUtils.toLocaleString(1, 0, 0);
        assertEq(result, "1");

        result = numUtils.toLocaleString(1, 1, 1);
        assertEq(result, "0.1");

        result = numUtils.toLocaleString(1, 2, 2);
        assertEq(result, "0.01");

        result = numUtils.toLocaleString(1, 3, 3);
        assertEq(result, "0.001", "here");

        result = numUtils.toLocaleString(1, 4, 4);
        assertEq(result, "0.0001");

        result = numUtils.toLocaleString(1, 5, 5);
        assertEq(result, "0.00001");

        result = numUtils.toLocaleString(1, 6, 6);
        assertEq(result, "0.000001");

        result = numUtils.toLocaleString(1, 7, 7);
        assertEq(result, "0.0000001");

        result = numUtils.toLocaleString(1, 8, 8);
        assertEq(result, "0.00000001");

        result = numUtils.toLocaleString(1, 9, 9);
        assertEq(result, "0.000000001");

        result = numUtils.toLocaleString(1, 10, 10);
        assertEq(result, "0.0000000001");
    }
}
