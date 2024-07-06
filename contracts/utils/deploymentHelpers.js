// Borrowing contracts
const SortedTroves = artifacts.require("./SortedTroves.sol");
const TroveManager = artifacts.require("./TroveManager.sol");
const PriceFeedTestnet = artifacts.require("./PriceFeedTestnet.sol");
const ActivePool = artifacts.require("./ActivePool.sol");
const DefaultPool = artifacts.require("./DefaultPool.sol");
const GasPool = artifacts.require("./GasPool.sol");
const CollSurplusPool = artifacts.require("./CollSurplusPool.sol");
const BorrowerOperations = artifacts.require("./BorrowerOperations.sol");
const HintHelpers = artifacts.require("./HintHelpers.sol");
const BoldToken = artifacts.require("./BoldTokenTester.sol");
const StabilityPool = artifacts.require("./StabilityPool.sol");
const PriceFeedMock = artifacts.require("./PriceFeedMock.sol");
const MockInterestRouter = artifacts.require("./MockInterestRouter.sol");
const ERC20 = artifacts.require("./ERC20MinterMock.sol");
const CollateralRegistry = artifacts.require("./CollateralRegistryTester.sol");
const Constants = artifacts.require("./Constants.sol");
//  "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol"
//  "../node_modules/@openzeppelin/contracts/build/contracts/ERC20PresetMinterPauser.json"
// );

const { web3, ethers } = require("hardhat");
const { accountsList } = require("../hardhatAccountsList2k.js");
const { fundAccounts } = require("./fundAccounts.js");

class DeploymentHelper {
  static async deployLiquityCore(mocks = {}) {
    return await this.deployLiquityCoreHardhat(mocks);
  }

  static async deployLiquityCoreHardhat(mocks = {
    PriceFeed: PriceFeedMock, // PriceFeed gets a mock by default
  }) {
    const WETH = await ERC20.new("WETH", "WETH");

    // Contracts, with mocks overriding defaults
    const Contracts = Object.fromEntries(
      Object.entries({
        ActivePool,
        BorrowerOperations,
        CollSurplusPool,
        DefaultPool,
        GasPool,
        PriceFeedTestnet,
        PriceFeedMock,
        SortedTroves,
        StabilityPool,
        TroveManager,
        BoldToken,
        HintHelpers,
        CollateralRegistry,
        Constants,
      })
        .map(([name, contract]) => [
          name,
          mocks[name] ?? contract,
        ]),
    );

    // Borrowing contracts
    const activePool = await Contracts.ActivePool.new(WETH.address);
    const troveManager = await Contracts.TroveManager.new(
      web3.utils.toBN("1100000000000000000"),
      web3.utils.toBN("100000000000000000"),
      web3.utils.toBN("100000000000000000"),
      WETH.address
    );
    const borrowerOperations = await Contracts.BorrowerOperations.new(WETH.address, troveManager.address, WETH.address);
    const collSurplusPool = await Contracts.CollSurplusPool.new(WETH.address);
    const defaultPool = await Contracts.DefaultPool.new(WETH.address);
    const gasPool = await Contracts.GasPool.new(WETH.address, borrowerOperations.address, troveManager.address);
    const priceFeedTestnet = await Contracts.PriceFeedTestnet.new();
    const priceFeed = await Contracts.PriceFeedMock.new();
    const sortedTroves = await Contracts.SortedTroves.new();
    const stabilityPool = await Contracts.StabilityPool.new(WETH.address);
    const constants = await Contracts.Constants.new();

    const { boldToken } = await this.deployBoldToken({
      troveManager,
      stabilityPool,
      borrowerOperations,
      activePool,
    }, Contracts.BoldToken);

    const collateralRegistry = await Contracts.CollateralRegistry.new(boldToken.address, [WETH.address], [
      troveManager.address,
    ]);

    const mockInterestRouter = await MockInterestRouter.new();
    const hintHelpers = await Contracts.HintHelpers.new(collateralRegistry.address);

    // // Needed?
    // const price = await priceFeed.getPrice();
    // const uint128Max = web3.utils.toBN(
    //   "340282366920938463463374607431768211455"
    // );
    // const uint192Max = web3.utils.toBN(
    //   "6277101735386680763835789423207666416102355444464034512895"
    // );

    // TODO: setAsDeployed all above?

    Contracts.BoldToken.setAsDeployed(boldToken);
    Contracts.DefaultPool.setAsDeployed(defaultPool);
    Contracts.PriceFeedTestnet.setAsDeployed(priceFeedTestnet);
    Contracts.SortedTroves.setAsDeployed(sortedTroves);
    Contracts.TroveManager.setAsDeployed(troveManager);
    Contracts.ActivePool.setAsDeployed(activePool);
    Contracts.StabilityPool.setAsDeployed(stabilityPool);
    Contracts.GasPool.setAsDeployed(gasPool);
    Contracts.CollSurplusPool.setAsDeployed(collSurplusPool);
    Contracts.BorrowerOperations.setAsDeployed(borrowerOperations);
    Contracts.HintHelpers.setAsDeployed(hintHelpers);
    MockInterestRouter.setAsDeployed(mockInterestRouter);
    Contracts.CollateralRegistry.setAsDeployed(troveManager);
    Contracts.Constants.setAsDeployed(constants);

    const coreContracts = {
      WETH,
      priceFeedTestnet,
      boldToken,
      sortedTroves,
      troveManager,
      activePool,
      stabilityPool,
      gasPool,
      defaultPool,
      collSurplusPool,
      borrowerOperations,
      hintHelpers,
      mockInterestRouter,
      collateralRegistry,
      constants,
    };
    return coreContracts;
  }

  static async deployBoldToken(contracts, MockedBoldToken = BoldToken) {
    contracts.boldToken = await MockedBoldToken.new();
    contracts.boldToken.setBranchAddresses(
      contracts.troveManager.address,
      contracts.stabilityPool.address,
      contracts.borrowerOperations.address,
      contracts.activePool.address,
    );
    return contracts;
  }

  // Connect contracts to their dependencies
  static async connectCoreContracts(contracts) {
    // set contracts in the Trove Manager
    await contracts.troveManager.setAddresses(
      contracts.borrowerOperations.address,
      contracts.activePool.address,
      contracts.defaultPool.address,
      contracts.stabilityPool.address,
      contracts.gasPool.address,
      contracts.collSurplusPool.address,
      contracts.priceFeedTestnet.address,
      contracts.boldToken.address,
      contracts.sortedTroves.address,
    );
    await contracts.troveManager.setCollateralRegistry(
      contracts.collateralRegistry.address,
    );

    await contracts.stabilityPool.setAddresses(
      contracts.borrowerOperations.address,
      contracts.troveManager.address,
      contracts.activePool.address,
      contracts.boldToken.address,
      contracts.sortedTroves.address,
      contracts.priceFeedTestnet.address,
    );
    // set TroveManager addr in SortedTroves
    await contracts.sortedTroves.setAddresses(
      contracts.troveManager.address,
      contracts.borrowerOperations.address,
    );

    // set contracts in BorrowerOperations
    await contracts.borrowerOperations.setAddresses(
      contracts.activePool.address,
      contracts.defaultPool.address,
      contracts.gasPool.address,
      contracts.collSurplusPool.address,
      contracts.priceFeedTestnet.address,
      contracts.sortedTroves.address,
      contracts.boldToken.address,
      // contracts.stETH.address
    );

    await contracts.activePool.setAddresses(
      contracts.borrowerOperations.address,
      contracts.troveManager.address,
      contracts.stabilityPool.address,
      contracts.defaultPool.address,
      contracts.boldToken.address,
      contracts.mockInterestRouter.address,
      // contracts.stETH.address,
    );

    await contracts.defaultPool.setAddresses(
      contracts.troveManager.address,
      contracts.activePool.address,
      // contracts.stETH.address
    );

    await contracts.collSurplusPool.setAddresses(
      contracts.borrowerOperations.address,
      contracts.troveManager.address,
      contracts.activePool.address,
    );

    await contracts.boldToken.setCollateralRegistry(
      contracts.collateralRegistry.address,
    );
  }
}
module.exports = DeploymentHelper;
