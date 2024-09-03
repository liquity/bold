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

  const testDeploymentSetter = async (
    contract,
    numberOfAddresses,
    twice = true,
    method = "setAddresses",
  ) => {
    const dumbContract = await GasPool.new(contracts.addressesRegistry.address);
    const params = Array(numberOfAddresses).fill(dumbContract.address);

    // Attempt call from alice
    await th.assertRevert(contract[method](...params, { from: alice }));

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
      await testDeploymentSetter(boldToken, 4, false, "setBranchAddresses");
    });
    it("setCollateralRegistry(): reverts when called by non-owner, with wrong address, or twice", async () => {
      await testDeploymentSetter(boldToken, 1, true, "setCollateralRegistry");
    });
  });
});
