const deploymentHelper = require("../utils/deploymentHelpers.js");
const { TestHelper: th, MoneyValues: mv } = require("../utils/testHelpers.js");
const { dec, toBN } = th;

const GasPool = artifacts.require("./GasPool.sol");
const BorrowerOperationsTester = artifacts.require("./BorrowerOperationsTester.sol");
const PriceFeedMock = artifacts.require("./PriceFeedMock.sol");

contract("All Liquity functions with onlyOwner modifier", async (accounts) => {
  const [owner, alice, bob] = accounts;

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000);

  let contracts;
  let boldToken;
  let sortedTroves;
  let troveManager;
  let activePool;
  let stabilityPool;
  let defaultPool;
  let borrowerOperations;

  before(async () => {
    contracts = await deploymentHelper.deployLiquityCore(mocks = {
      PriceFeed: PriceFeedMock,
      BorrowerOperations: BorrowerOperationsTester,
    });

    boldToken = contracts.boldToken;
    sortedTroves = contracts.sortedTroves;
    troveManager = contracts.troveManager;
    activePool = contracts.activePool;
    stabilityPool = contracts.stabilityPool;
    defaultPool = contracts.defaultPool;
    borrowerOperations = contracts.borrowerOperations;
  });

  const testZeroAddress = async (contract, params, method = "setAddresses", skip = 0) => {
    await testWrongAddress(contract, params, th.ZERO_ADDRESS, method, skip, "Account cannot be zero address");
  };
  const testNonContractAddress = async (contract, params, method = "setAddresses", skip = 0) => {
    await testWrongAddress(contract, params, bob, method, skip, "Account code size cannot be zero");
  };
  const testWrongAddress = async (contract, params, address, method, skip, message) => {
    for (let i = skip; i < params.length; i++) {
      const newParams = [...params];
      newParams[i] = address;
      await th.assertRevert(contract[method](...newParams, { from: owner }), message);
    }
  };

  const testDeploymentSetter = async (
    contract,
    numberOfAddresses,
    checkContract = true,
    twice = true,
    method = "setAddresses",
  ) => {
    const dumbContract = await GasPool.new(contracts.WETH.address, contracts.borrowerOperations.address, contracts.troveManager.address);
    const params = Array(numberOfAddresses).fill(dumbContract.address);

    // Attempt call from alice
    await th.assertRevert(contract[method](...params, { from: alice }));
    if (checkContract) {
      // Attempt to use zero address
      await testZeroAddress(contract, params, method);
      // Attempt to use non contract
      await testNonContractAddress(contract, params, method);
    }

    // Owner can successfully set any address
    const txOwner = await contract[method](...params, { from: owner });
    assert.isTrue(txOwner.receipt.status);
    // fails if called twice
    if (twice) {
      await th.assertRevert(contract[method](...params, { from: owner }));
    }
  };

  describe("BoldToken", async (accounts) => {
    it("setBranchAddresses(): reverts when called by non-owner, with wrong addresses", async () => {
      await testDeploymentSetter(boldToken, 4, false, false, "setBranchAddresses");
    });
    it("setCollateralRegistry(): reverts when called by non-owner, with wrong address, or twice", async () => {
      await testDeploymentSetter(boldToken, 1, false, true, "setCollateralRegistry");
    });
  });

  describe("BorrowerOperations", async (accounts) => {
    it("setAddresses(): reverts when called by non-owner, with wrong addresses, or twice", async () => {
      await testDeploymentSetter(borrowerOperations, 8, false);
    });
  });

  describe("DefaultPool", async (accounts) => {
    it("setAddresses(): reverts when called by non-owner, with wrong addresses, or twice", async () => {
      await testDeploymentSetter(defaultPool, 2);
    });
  });

  describe("StabilityPool", async (accounts) => {
    it("setAddresses(): reverts when called by non-owner, with wrong addresses, or twice", async () => {
      await testDeploymentSetter(stabilityPool, 6, false);
    });
  });

  describe("ActivePool", async (accounts) => {
    it("setAddresses(): reverts when called by non-owner, with wrong addresses, or twice", async () => {
      await testDeploymentSetter(activePool, 6, false);
    });
  });

  describe("SortedTroves", async (accounts) => {
    it("setAddresses(): reverts when called by non-owner, with wrong addresses, or twice", async () => {
      const dumbContract = await GasPool.new(contracts.WETH.address, contracts.borrowerOperations.address, contracts.troveManager.address);
      const params = [dumbContract.address, dumbContract.address];

      // Attempt call from alice
      await th.assertRevert(sortedTroves.setAddresses(...params, { from: alice }));

      // Attempt to use zero address
      await testZeroAddress(sortedTroves, params, "setAddresses", 1);
      // Attempt to use non contract
      await testNonContractAddress(sortedTroves, params, "setAddresses", 1);

      // Owner can successfully set params
      const txOwner = await sortedTroves.setAddresses(...params, { from: owner });
      assert.isTrue(txOwner.receipt.status);

      // fails if called twice
      await th.assertRevert(sortedTroves.setAddresses(...params, { from: owner }));
    });
  });
});
