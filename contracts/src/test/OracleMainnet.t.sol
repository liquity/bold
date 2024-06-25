
// import "./TestContracts/BaseTest.sol";
import "./TestContracts/Accounts.sol";
import "../deployment.sol";

import "../Dependencies/AggregatorV3Interface.sol";
import "../Interfaces/IWSTETH.sol";
import "../Interfaces/IRETHPriceFeed.sol";

import "forge-std/Test.sol";
import "forge-std/console2.sol";

contract OraclesMainnet is TestAccounts {
    uint256 constant public _24_HOURS = 86400;
    uint256 constant public _48_HOURS = 172800;

    AggregatorV3Interface ethOracle;
    AggregatorV3Interface stethOracle;
    AggregatorV3Interface rethOracle;
    IWSTETH wstETH;

    IPriceFeed wethPriceFeed;
    IRETHPriceFeed rethPriceFeed;
    IWSTETHPriceFeed wstethPriceFeed;

    LiquityContracts[] contractsArray;
    MockCollaterals mockCollaterals;
    ICollateralRegistry collateralRegistry;
    IBoldToken boldToken;

    struct StoredOracle {
        AggregatorV3Interface aggregator;
        uint256 stalenessThreshold;
        uint256 decimals;
    }

    function setUp() public {
        accounts = new Accounts();
        createAccounts();

        (A, B, C, D, E, F) = (
            accountsList[0],
            accountsList[1],
            accountsList[2],
            accountsList[3],
            accountsList[4],
            accountsList[5]
        );

        ExternalAddresses memory externalAddresses;
        OracleParams memory oracleParams;

        TroveManagerParams memory tmParams = TroveManagerParams(110e16, 5e16, 10e16);
        TroveManagerParams[] memory tmParamsArray = new TroveManagerParams[](3);
        tmParamsArray[0] = tmParams;
        tmParamsArray[1] = tmParams;
        tmParamsArray[2] = tmParams;
    
        externalAddresses.ETHOracle = 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419;
        externalAddresses.RETHOracle = 0x536218f9E9Eb48863970252233c8F271f554C2d0;
        externalAddresses.STETHOracle = 0x86392dC19c0b719886221c78AB11eb8Cf5c52812;
        externalAddresses.WSTETHToken = 0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0;

        ethOracle = AggregatorV3Interface(externalAddresses.ETHOracle);
        rethOracle = AggregatorV3Interface(externalAddresses.RETHOracle);
        stethOracle = AggregatorV3Interface(externalAddresses.STETHOracle);
       
        wstETH = IWSTETH(externalAddresses.WSTETHToken);

        oracleParams.ethUsdStalenessThreshold = _24_HOURS;
        oracleParams.stEthEthStalenessThreshold = _24_HOURS;
        oracleParams.rEthEthStalenessThreshold = _48_HOURS;

        LiquityContracts[] memory _contractsArray;

        (_contractsArray, 
        mockCollaterals, 
        collateralRegistry, 
        boldToken) = deployAndConnectContractsMainnet(
            externalAddresses,
            tmParamsArray,
            oracleParams)
        ;

        // Record contracts 
        for (uint256 c = 0; c < 3; c++) {
            contractsArray.push(_contractsArray[c]);    
        }

        // Give all users all collaterals
         uint256 initialColl = 1000_000e18;
        for (uint256 i = 0; i < 6; i++) {
            deal(address(mockCollaterals.WETH), accountsList[i], initialColl);
            deal(address(mockCollaterals.RETH), accountsList[i], initialColl);
            deal(address(mockCollaterals.WSTETH), accountsList[i], initialColl);
            // Approve all BorrowerOps to use the user's funds
            vm.startPrank(accountsList[i]);
            mockCollaterals.WETH.approve(address(contractsArray[0].borrowerOperations), initialColl);
            mockCollaterals.RETH.approve(address(contractsArray[1].borrowerOperations), initialColl);
            mockCollaterals.WSTETH.approve(address(contractsArray[2].borrowerOperations), initialColl);
            vm.stopPrank();
        }
         
        wethPriceFeed = contractsArray[0].priceFeed;
        rethPriceFeed = IRETHPriceFeed(address(contractsArray[1].priceFeed));
        wstethPriceFeed = IWSTETHPriceFeed(address(contractsArray[2].priceFeed));

        // log some current blockchain state
        console.log(block.timestamp, "block.timestamp");
        console.log(block.number, "block.number");
        console.log(ethOracle.decimals(), "ETHUSD decimals");
        console.log(rethOracle.decimals(), "RETHETH decimals");
        console.log(stethOracle.decimals(), "STETHETH decimals");
    }

    function _getLatestAnswerFromOracle(AggregatorV3Interface _oracle) internal returns (uint256) {
        (,int256 answer,,,) = _oracle.latestRoundData();
        uint256 decimals = _oracle.decimals();
        assertLe(decimals, 18);
        // Convert to uint and scale up to 18 decimals
        return uint256(answer) *10 ** (18 - decimals);
    }

    // --- lastGoodPrice set on deployment ---

    function testSetLastGoodPriceOnDeploymentWETH() public {
        uint256 lastGoodPriceWeth = wethPriceFeed.lastGoodPrice();
        assertGt(lastGoodPriceWeth, 0);
        console.log("lastGoodPriceWeth", lastGoodPriceWeth);

        uint256 latestAnswerEthUsd = _getLatestAnswerFromOracle(ethOracle);

        assertEq(lastGoodPriceWeth, latestAnswerEthUsd);
    }

    function testSetLastGoodPriceOnDeploymentRETH() public {
        uint256 lastGoodPriceReth = rethPriceFeed.lastGoodPrice();
        assertGt(lastGoodPriceReth, 0);
        console.log("lastGoodPriceReth", lastGoodPriceReth);

        uint256 latestAnswerREthEth = _getLatestAnswerFromOracle(rethOracle);
        console.log("latestAnswerREthEth", latestAnswerREthEth);
        uint256 latestAnswerEthUsd = _getLatestAnswerFromOracle(ethOracle);
        console.log("latestAnswerEthUsd", latestAnswerEthUsd);

        uint256 expectedStoredPrice = latestAnswerREthEth * latestAnswerEthUsd / 1e18;

        console.log("expectedStoredPrice", expectedStoredPrice);

        assertEq(lastGoodPriceReth, expectedStoredPrice);
    }

    function testSetLastGoodPriceOnDeploymentWSTETH() public {
        uint256 lastGoodPriceWsteth = wstethPriceFeed.lastGoodPrice();
        assertGt(lastGoodPriceWsteth, 0);
        console.log("lastGoodPriceReth", lastGoodPriceWsteth);

        uint256 latestAnswerStethEth = _getLatestAnswerFromOracle(stethOracle);
        uint256 latestAnswerEthUsd = _getLatestAnswerFromOracle(ethOracle);
        uint256 wstethStethExchangeRate = wstETH.tokensPerStEth();

        uint256 expectedStoredPrice = latestAnswerStethEth * latestAnswerEthUsd * wstethStethExchangeRate/ 1e36;

        assertEq(lastGoodPriceWsteth, expectedStoredPrice);
    }

    // --- fetchPrice ---

    function testFetchPriceReturnsCorrectPriceWETH() public {
        uint256 fetchedEthUsdPrice = wethPriceFeed.fetchPrice();
        assertGt(fetchedEthUsdPrice, 0);
        console.log("fetchedEthUsdPrice", fetchedEthUsdPrice);

        uint256 latestAnswerEthUsd = _getLatestAnswerFromOracle(ethOracle);

        assertEq(fetchedEthUsdPrice, latestAnswerEthUsd);
    }

    function testFetchPriceReturnsCorrectPriceRETH() public {
        uint256 fetchedRethUsdPrice = rethPriceFeed.fetchPrice();
        assertGt(fetchedRethUsdPrice, 0);
        console.log("fetchedRethUsdPrice", fetchedRethUsdPrice);

        uint256 latestAnswerREthEth = _getLatestAnswerFromOracle(rethOracle);
        uint256 latestAnswerEthUsd = _getLatestAnswerFromOracle(ethOracle);

        uint256 expectedFetchedPrice = latestAnswerREthEth * latestAnswerEthUsd / 1e18;

        assertEq(fetchedRethUsdPrice, expectedFetchedPrice);
    }

    function testFetchPriceReturnsCorrectPriceWSTETH() public {
        uint256 fetchedStethUsdPrice = wstethPriceFeed.fetchPrice();
        assertGt(fetchedStethUsdPrice, 0);
        console.log("fetchedStethUsdPrice", fetchedStethUsdPrice);

        uint256 latestAnswerStethEth = _getLatestAnswerFromOracle(stethOracle);
        uint256 latestAnswerEthUsd = _getLatestAnswerFromOracle(ethOracle);
        uint256 wstethStethExchangeRate = wstETH.tokensPerStEth();

        uint256 expectedFetchedPrice = latestAnswerStethEth * latestAnswerEthUsd * wstethStethExchangeRate/ 1e36;

        assertEq(fetchedStethUsdPrice, expectedFetchedPrice);
    }

    // --- Thresholds set at deployment ---

    function testEthUsdStalenessThresholdSetWETH() public {
        uint256 storedEthUsdStaleness = wethPriceFeed.getEthUsdStalenessThreshold();
        assertEq(storedEthUsdStaleness, _24_HOURS);
    }

    function testEthUsdStalenessThresholdSetRETH() public {
        uint256 storedEthUsdStaleness = rethPriceFeed.getEthUsdStalenessThreshold();
        assertEq(storedEthUsdStaleness, _24_HOURS);
    }

     function testEthUsdStalenessThresholdSetWSTETH() public {
        uint256 storedEthUsdStaleness = wstethPriceFeed.getEthUsdStalenessThreshold();
        assertEq(storedEthUsdStaleness, _24_HOURS);
    }

    function testRethEthStalenessThresholdSetRETH() public {
        uint256 storedRethEthStaleness = rethPriceFeed.getREthEthStalenessThreshold();
        assertEq(storedRethEthStaleness, _48_HOURS);
    }

    function testStethEthStalenessThresholdSetWSTETH() public {
        uint256 storedStEthEthStaleness = wstethPriceFeed.getStEthEthStalenessThreshold();
        assertEq(storedStEthEthStaleness, _24_HOURS);
    }

    // --- Basic actions ---

    function testOpenTroveWETH() public {
        uint256 price = _getLatestAnswerFromOracle(ethOracle);

        uint256 coll = 5 ether;
        uint256 debtRequest = coll * price / 2 / 1e18;
      
        uint256 trovesCount =  contractsArray[0].troveManager.getTroveIdsCount();
        assertEq(trovesCount, 0);

        vm.startPrank(A);
        contractsArray[0].borrowerOperations.openTrove(A, 0, coll, debtRequest, 0, 0, 0, 0);

        trovesCount =  contractsArray[0].troveManager.getTroveIdsCount();
        assertEq(trovesCount, 1);
    }

    function testOpenTroveRETH() public {
        uint256 latestAnswerREthEth = _getLatestAnswerFromOracle(rethOracle);
        uint256 latestAnswerEthUsd = _getLatestAnswerFromOracle(ethOracle);

        uint256 calcdRethUsdPrice = latestAnswerREthEth * latestAnswerEthUsd / 1e18;

        uint256 coll = 5 ether;
        uint256 debtRequest = coll * calcdRethUsdPrice / 2 / 1e18;
      
        uint256 trovesCount =  contractsArray[1].troveManager.getTroveIdsCount();
        assertEq(trovesCount, 0);

        vm.startPrank(A);
        contractsArray[1].borrowerOperations.openTrove(A, 0, coll, debtRequest, 0, 0, 0, 0);

        trovesCount =  contractsArray[1].troveManager.getTroveIdsCount();
        assertEq(trovesCount, 1);
    }

    function testOpenTroveWSTETH() public {
        uint256 latestAnswerStethEth = _getLatestAnswerFromOracle(stethOracle);
        uint256 latestAnswerEthUsd = _getLatestAnswerFromOracle(ethOracle);
        uint256 wstethStethExchangeRate = wstETH.tokensPerStEth();

        uint256 calcdWstethUsdPrice = latestAnswerStethEth * latestAnswerEthUsd * wstethStethExchangeRate/ 1e36;

        uint256 coll = 5 ether;
        uint256 debtRequest = coll * calcdWstethUsdPrice / 2 / 1e18;
      
        uint256 trovesCount =  contractsArray[2].troveManager.getTroveIdsCount();
        assertEq(trovesCount, 0);

        vm.startPrank(A);
        contractsArray[2].borrowerOperations.openTrove(A, 0, coll, debtRequest, 0, 0, 0, 0);

        trovesCount =  contractsArray[2].troveManager.getTroveIdsCount();
        assertEq(trovesCount, 1);
    }

    // TODO:
    // - use stEth-usd feed?
    // - More basic actions tests (adjust, close, etc)
    // - liq tests (manipulate aggregator stored price) 
    // - conditional shutdown logic tests (manipulate aggregator stored price)
}
