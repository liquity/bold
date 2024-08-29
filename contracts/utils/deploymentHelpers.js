// Borrowing contracts
const DeterministicDeployFactory = artifacts.require("./DeterministicDeployFactory.sol");
const SortedTroves = artifacts.require("./SortedTroves.sol");
const AddressesRegistry = artifacts.require("./AddressesRegistry.sol");
const TroveManager = artifacts.require("./TroveManager.sol");
const TroveNFT = artifacts.require("./TroveNFT.sol");
const PriceFeedTestnet = artifacts.require("./PriceFeedTestnet.sol");
const ActivePool = artifacts.require("./ActivePool.sol");
const DefaultPool = artifacts.require("./DefaultPool.sol");
const GasPool = artifacts.require("./GasPool.sol");
const CollSurplusPool = artifacts.require("./CollSurplusPool.sol");
const BorrowerOperations = artifacts.require("./BorrowerOperations.sol");
const HintHelpers = artifacts.require("./HintHelpers.sol");
const MultiTroveGetter = artifacts.require("./MultiTroveGetter.sol");
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

//const { ethers } = require("ethers");
const { web3, ethers } = require("hardhat");
const hh = require("hardhat");
const { accountsList } = require("../hardhatAccountsList2k.js");
const { fundAccounts } = require("./fundAccounts.js");

const SALT = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("LiquityV2"));
//const CREATE2_PROXY_ADDRESS = "0x4e59b44847b379578588920cA78FbF26c0B4956C";

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
        AddressesRegistry,
        ActivePool,
        TroveNFT,
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

    this.defaultSender = new ethers.Wallet(accountsList[0].privateKey).address;

    this.deterministicDeployFactory = await DeterministicDeployFactory.new();
    //console.log('this.deterministicDeployFactory: ', this.deterministicDeployFactory.address)

    // Borrowing contracts
    const addressesRegistry = await Contracts.AddressesRegistry.new(
      this.defaultSender,
      web3.utils.toBN("1500000000000000000"),
      web3.utils.toBN("1100000000000000000"),
      web3.utils.toBN("1100000000000000000"),
      web3.utils.toBN("100000000000000000"),
      web3.utils.toBN("100000000000000000"),
    );
    this.addressesRegistryAddress = addressesRegistry.address;

    const addresses = {}
    addresses.troveManager = this.getCreate2Address(Contracts.TroveManager);

    const boldToken = await Contracts.BoldToken.new(this.defaultSender);
    const collateralRegistry = await Contracts.CollateralRegistry.new(boldToken.address, [WETH.address], [addresses.troveManager]);
    //const priceFeed = await Contracts.PriceFeedMock.new();
    const priceFeedTestnet = await Contracts.PriceFeedTestnet.new();
    const mockInterestRouter = await MockInterestRouter.new();
    const hintHelpers = await Contracts.HintHelpers.new(collateralRegistry.address);
    const multiTroveGetter = await MultiTroveGetter.new(collateralRegistry.address);


    addresses.collToken = WETH.address;
    addresses.borrowerOperations = this.getCreate2Address(Contracts.BorrowerOperations);
    addresses.troveNFT = this.getCreate2Address(Contracts.TroveNFT);
    addresses.stabilityPool = this.getCreate2Address(Contracts.StabilityPool);
    addresses.priceFeed = priceFeedTestnet.address;
    addresses.activePool = this.getCreate2Address(Contracts.ActivePool);
    addresses.defaultPool = this.getCreate2Address(Contracts.DefaultPool);
    addresses.gasPoolAddress = this.getCreate2Address(Contracts.GasPool);
    addresses.collSurplusPool = this.getCreate2Address(Contracts.CollSurplusPool);
    addresses.sortedTroves = this.getCreate2Address(Contracts.SortedTroves);
    addresses.interestRouter = mockInterestRouter.address;
    addresses.hintHelpers = hintHelpers.address;
    addresses.multiTroveGetter = multiTroveGetter.address;
    addresses.collateralRegistry = collateralRegistry.address;
    addresses.boldToken = boldToken.address;
    addresses.WETH = WETH.address;

    //console.log('addresses: ', addresses)

    // set addresses in the registry
    await addressesRegistry.setAddresses(addresses);

    await this.deployWithCreate2(Contracts.BorrowerOperations);
    await this.deployWithCreate2(Contracts.TroveManager);
    await this.deployWithCreate2(Contracts.TroveNFT);
    await this.deployWithCreate2(Contracts.ActivePool);
    await this.deployWithCreate2(Contracts.CollSurplusPool);
    await this.deployWithCreate2(Contracts.GasPool);
    await this.deployWithCreate2(Contracts.DefaultPool);
    await this.deployWithCreate2(Contracts.SortedTroves);
    await this.deployWithCreate2(Contracts.StabilityPool);

    const troveManager = await Contracts.TroveManager.at(addresses.troveManager);
    const troveNFT = await Contracts.TroveNFT.at(addresses.troveNFT);
    const borrowerOperations = await Contracts.BorrowerOperations.at(addresses.borrowerOperations);
    const activePool = await Contracts.ActivePool.at(addresses.activePool);
    const collSurplusPool = await Contracts.CollSurplusPool.at(addresses.collSurplusPool);
    const gasPool = await Contracts.GasPool.at(addresses.gasPoolAddress);
    const defaultPool = await Contracts.DefaultPool.at(addresses.defaultPool);
    const sortedTroves = await Contracts.SortedTroves.at(addresses.sortedTroves);
    const stabilityPool = await Contracts.StabilityPool.at(addresses.stabilityPool);
    const constants = await Contracts.Constants.new();

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
      addressesRegistry,
      priceFeedTestnet,
      boldToken,
      sortedTroves,
      troveManager,
      troveNFT,
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

  static getCreate2Address = (contract) => {
    const initCode = this.getInitCode(contract);
    const initCodeHash = ethers.utils.keccak256(initCode);
    const contractAddress = ethers.utils.getCreate2Address(this.deterministicDeployFactory.address, SALT, initCodeHash);
    //console.log('contractAddress: ', contractAddress)
    return contractAddress;
  }

  static async deployWithCreate2(contract) {
    const initCode = this.getInitCode(contract);

    const tx = await this.deterministicDeployFactory.deploy(initCode, SALT);
    //console.log('tx: ', tx)
    const address = tx.logs[0].args[0];
    //console.log('address: ', address);
    return address;
  }

  static getInitCode = (contract) => contract.bytecode + this.encoder(["address"], [this.addressesRegistryAddress]);

  static encoder = (types, values) => {
    const abiCoder = ethers.utils.defaultAbiCoder;
    const encodedParams = abiCoder.encode(types, values);
    return encodedParams.slice(2);
  };

  // Connect contracts to their dependencies
  static async connectCoreContracts(contracts) {
    await contracts.boldToken.setBranchAddresses(
      contracts.troveManager.address,
      contracts.stabilityPool.address,
      contracts.borrowerOperations.address,
      contracts.activePool.address,
    );

    await contracts.boldToken.setCollateralRegistry(contracts.collateralRegistry.address);
  }
}
module.exports = DeploymentHelper;
