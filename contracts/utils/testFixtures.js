const { loadFixture, mine } = require("@nomicfoundation/hardhat-network-helpers");
const deploymentHelper = require("./deploymentHelpers.js");
const { fundAccounts } = require("./fundAccounts.js");
const { TestHelper: th } = require("./testHelpers.js");

// Returns a fixture utility to be called in every test (it()).
// The only required parameter is the list of accounts to be funded.
// Callback parameters can be used to run code after the deployment
// and after the connection. They take the contracts as a parameter,
// which can be modified as needed. The returned object will be
// merged with the object returned by the fixture loader utility.
function createDeployAndFundFixture({
  accounts = [],
  callback = async () => null,
  mocks = {}, // e.g. { Contract: MockContract }
} = {}) {
  const fixture = async () => {
    const contracts = await deploymentHelper.deployLiquityCore(mocks);
    await deploymentHelper.connectCoreContracts(contracts);

    contracts.priceFeed = contracts.priceFeedTestnet;

    await fundAccounts(accounts, contracts.WETH);

    // Without forcing a block to be mined, the tests were sometimes
    // failing due to the accounts not being funded.
    await mine();

    const helpers = {
      getOpenTroveBoldAmount: async (totalDebt) => (
        th.getOpenTroveBoldAmount(contracts, totalDebt)
      ),
      getNetBorrowingAmount: async (debtWithFee) => (
        th.getNetBorrowingAmount(contracts, debtWithFee)
      ),
      openTrove: async (params) => (
        th.openTrove(contracts, params)
      ),
      withdrawBold: async (params) => (
        th.withdrawBold(contracts, params)
      ),
      getActualDebtFromComposite: async (compositeDebt) => (
        th.getActualDebtFromComposite(compositeDebt, contracts)
      ),
      getTroveEntireColl: async (trove) => (
        th.getTroveEntireColl(contracts, trove)
      ),
      getTroveEntireDebt: async (trove) => (
        th.getTroveEntireDebt(contracts, trove)
      ),
      getTroveStake: async (trove) => (
        th.getTroveStake(contracts, trove)
      ),
    };

    const callbackResult = await callback(contracts);

    return {
      contracts,
      ...helpers,
      ...callbackResult,
    };
  };

  return () => loadFixture(fixture);
}

module.exports = {
  createDeployAndFundFixture,
};
