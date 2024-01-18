// Borrowing contracts
const SortedTroves = artifacts.require("./SortedTroves.sol");
const TroveManager = artifacts.require("./TroveManager.sol");
const PriceFeedTestnet = artifacts.require("./PriceFeedTestnet.sol");
const ActivePool = artifacts.require("./ActivePool.sol");
const DefaultPool = artifacts.require("./DefaultPool.sol");
const GasPool = artifacts.require("./GasPool.sol");
const CollSurplusPool = artifacts.require("./CollSurplusPool.sol");
const FunctionCaller = artifacts.require("./TestContracts/FunctionCaller.sol");
const BorrowerOperations = artifacts.require("./BorrowerOperations.sol");
const HintHelpers = artifacts.require("./HintHelpers.sol");
const BoldToken = artifacts.require("./BoldToken.sol");
const StabilityPool = artifacts.require("./StabilityPool.sol");
const PriceFeedMock = artifacts.require("./PriceFeedMock.sol");
// const ERC20 = artifacts.require(
// //  "@openzeppelin/contracts/token/ERC20/ERC20.sol"
//   "../node_modules/@openzeppelin/contracts/build/contracts/ERC20.json"
// );

const LQTYTokenMock = artifacts.require("./LQTYTokenMock.sol");
const LQTYStakingMock = artifacts.require("./LQTYStakingMock.sol");
const CommunityIssuanceMock = artifacts.require("./CommunityIssuanceMock.sol");

//const LQTYTokenTester = artifacts.require("./LQTYTokenTester.sol");
//const CommunityIssuanceTester = artifacts.require("./CommunityIssuanceTester.sol");

const { web3, ethers } = require("hardhat");
const { accountsList } = require("../hardhatAccountsList2k.js");
const { fundAccounts } = require("./fundAccounts.js");

const maxBytes32 = "0x" + "f".repeat(64);

class DeploymentHelper {
  static async deployLiquityCore() {
    return await this.deployLiquityCoreHardhat();
  }

  static async deployLQTYContracts(
    bountyAddress,
    lpRewardsAddress,
    multisigAddress
  ) {
    return this.deployLQTYContractsHardhat(
      bountyAddress,
      lpRewardsAddress,
      multisigAddress
    );
  }

  static async deployLiquityCoreHardhat() {
    // Borrowing contracts
    const priceFeedTestnet = await PriceFeedTestnet.new();
    const sortedTroves = await SortedTroves.new();
    const troveManager = await TroveManager.new();
    const activePool = await ActivePool.new();
    const gasPool = await GasPool.new();
    const defaultPool = await DefaultPool.new();
    const collSurplusPool = await CollSurplusPool.new();
    const functionCaller = await FunctionCaller.new();
    const borrowerOperations = await BorrowerOperations.new();
    const hintHelpers = await HintHelpers.new();

    const priceFeed = await PriceFeedMock.new();
    const stabilityPool = await StabilityPool.new(
      priceFeed.address,
      activePool.address,
      troveManager.address
    );
    const boldToken = await BoldToken.new(
      troveManager.address,
      stabilityPool.address,
      borrowerOperations.address
    );
    const price = await priceFeed.getPrice();
    const uint128Max = web3.utils.toBN(
      "340282366920938463463374607431768211455"
    );
    const uint192Max = web3.utils.toBN(
      "6277101735386680763835789423207666416102355444464034512895"
    );

    // TODO: setAsDeployed all above?

    BoldToken.setAsDeployed(boldToken);
    DefaultPool.setAsDeployed(defaultPool);
    PriceFeedTestnet.setAsDeployed(priceFeedTestnet);
    SortedTroves.setAsDeployed(sortedTroves);
    TroveManager.setAsDeployed(troveManager);
    ActivePool.setAsDeployed(activePool);
    StabilityPool.setAsDeployed(stabilityPool);
    GasPool.setAsDeployed(gasPool);
    CollSurplusPool.setAsDeployed(collSurplusPool);
    FunctionCaller.setAsDeployed(functionCaller);
    BorrowerOperations.setAsDeployed(borrowerOperations);
    HintHelpers.setAsDeployed(hintHelpers);

    const coreContracts = {
      //stETH,
      priceFeedTestnet,
      boldToken,
      sortedTroves,
      troveManager,
      activePool,
      stabilityPool,
      gasPool,
      defaultPool,
      collSurplusPool,
      functionCaller,
      borrowerOperations,
      hintHelpers,
    };
    return coreContracts;
  }

  static async deployLQTYContractsHardhat() {
    const lqtyStaking = await LQTYStakingMock.new();
    const communityIssuance = await CommunityIssuanceMock.new();

    LQTYStakingMock.setAsDeployed(lqtyStaking);
    CommunityIssuanceMock.setAsDeployed(communityIssuance);

    // Deploy LQTY Token, passing Community Issuance and Factory addresses to the constructor
    const lqtyToken = await LQTYTokenMock.new();
    LQTYTokenMock.setAsDeployed(lqtyToken);

    const LQTYContracts = {
      lqtyStaking,
      communityIssuance,
      lqtyToken,
    };
    return LQTYContracts;
  }

  // static async deployLQTYTesterContractsHardhat(
  //   bountyAddress,
  //   lpRewardsAddress,
  //   multisigAddress
  // ) {
  //   const lqtyStaking = await LQTYStaking.new();
  //   const communityIssuance = await CommunityIssuanceTester.new();

  //   LQTYStaking.setAsDeployed(lqtyStaking);
  //   CommunityIssuanceTester.setAsDeployed(communityIssuance);

  //   // Deploy LQTY Token, passing Community Issuance and Factory addresses to the constructor
  //   const lqtyToken = await LQTYTokenTester.new(
  //     communityIssuance.address,
  //     lqtyStaking.address,
  //     bountyAddress,
  //     lpRewardsAddress,
  //     multisigAddress
  //   );
  //   LQTYTokenTester.setAsDeployed(lqtyToken);

  //   const LQTYContracts = {
  //     lqtyStaking,
  //     communityIssuance,
  //     lqtyToken,
  //   };
  //   return LQTYContracts;
  // }

  static async deployBoldToken(contracts) {
    contracts.boldToken = await BoldToken.new(
      contracts.reserve,
      contracts.stabilityPool,
      contracts.borrowerOperations.address
    );
    return contracts;
  }

  // TODO: do we need this?
  // static async deployBoldTokenTester(contracts) {
  //   contracts.boldToken = await BoldTokenTester.new(
  //     contracts.troveManager.address,
  //     contracts.stabilityPool.address,
  //     contracts.borrowerOperations.address
  //   );
  //   return contracts;
  // }

  // Connect contracts to their dependencies
  static async connectCoreContracts(contracts, LQTYContracts) {
    await contracts.stabilityPool.setAddresses(
      contracts.borrowerOperations.address,
      contracts.troveManager.address,
      contracts.activePool.address,
      contracts.boldToken.address,
      contracts.sortedTroves.address,
      contracts.priceFeedTestnet.address,
      LQTYContracts.communityIssuance.address,
    );
    // set TroveManager addr in SortedTroves
    await contracts.sortedTroves.setParams(
      maxBytes32,
      contracts.troveManager.address,
      contracts.borrowerOperations.address
    );

    // set contract addresses in the FunctionCaller
    await contracts.functionCaller.setTroveManagerAddress(
      contracts.troveManager.address
    );
    await contracts.functionCaller.setSortedTrovesAddress(
      contracts.sortedTroves.address
    );

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
      LQTYContracts.lqtyToken.address,
      LQTYContracts.lqtyStaking.address
    );

    // set contracts in BorrowerOperations
    await contracts.borrowerOperations.setAddresses(
      contracts.troveManager.address,
      contracts.activePool.address,
      contracts.defaultPool.address,
      contracts.stabilityPool.address,
      contracts.gasPool.address,
      contracts.collSurplusPool.address,
      contracts.priceFeedTestnet.address,
      contracts.sortedTroves.address,
      contracts.boldToken.address,
      LQTYContracts.lqtyStaking.address,
      //contracts.stETH.address
    );

    await contracts.activePool.setAddresses(
      contracts.borrowerOperations.address,
      contracts.troveManager.address,
      contracts.stabilityPool.address,
      contracts.defaultPool.address,
      //contracts.stETH.address,
    );

    await contracts.defaultPool.setAddresses(
      contracts.troveManager.address,
      contracts.activePool.address,
      //contracts.stETH.address
    );

    await contracts.collSurplusPool.setAddresses(
      contracts.borrowerOperations.address,
      contracts.troveManager.address,
      contracts.activePool.address,
    );

    // set contracts in HintHelpers
    await contracts.hintHelpers.setAddresses(
      contracts.sortedTroves.address,
      contracts.troveManager.address
    );
  }

  static async connectLQTYContractsToCore(LQTYContracts, coreContracts) {
    await LQTYContracts.lqtyStaking.setAddresses(
      LQTYContracts.lqtyToken.address,
      coreContracts.boldToken.address,
      coreContracts.troveManager.address,
      coreContracts.borrowerOperations.address,
      coreContracts.activePool.address,
      coreContracts.activePool.address
    );

    await LQTYContracts.communityIssuance.setAddresses(
      LQTYContracts.lqtyToken.address,
      coreContracts.stabilityPool.address
    );
  }
}
module.exports = DeploymentHelper;
