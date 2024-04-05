const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const deploymentHelper = require("./deploymentHelpers.js");
const { fundAccounts } = require("./fundAccounts.js");
const { TestHelper: th } = require("./testHelpers.js");

// Returns a fixture utility to be called in every test (it()).
// The only required parameter is the list of accounts to be funded.
// Callback parameters can be used to run code after the deployment
// and after the connection. They take the contracts as a parameter,
// which can be modified as needed. The returned object will be
// merged with the object returned by the fixture loader utility.
function createDeployAndFundFixture(accounts, {
  afterDeploy = async () => null,
  afterConnect = async () => null,
} = {}) {
  const fixture = async () => {
    const contracts = await deploymentHelper.deployLiquityCore();

    const afterDeployResult = await afterDeploy(contracts);

    await deploymentHelper.deployBoldToken(contracts);
    await deploymentHelper.connectCoreContracts(contracts);
    contracts.priceFeed = contracts.priceFeedTestnet;

    const afterConnectResult = await afterConnect(contracts);

    if (!accounts) {
      throw new Error("No accounts provided to the fixture");
    }
    await fundAccounts(accounts, contracts.WETH);

    return {
      contracts,
      getOpenTroveBoldAmount: async (totalDebt) => {
        return th.getOpenTroveBoldAmount(contracts, totalDebt);
      },
      getNetBorrowingAmount: async (debtWithFee) => {
        return th.getNetBorrowingAmount(contracts, debtWithFee);
      },
      openTrove: async (params) => {
        return th.openTrove(contracts, params);
      },
      withdrawBold: async (params) => {
        return th.withdrawBold(contracts, params);
      },
      getActualDebtFromComposite: async (compositeDebt) => {
        return th.getActualDebtFromComposite(compositeDebt, contracts);
      },
      getTroveEntireColl: async (trove) => {
        return th.getTroveEntireColl(contracts, trove);
      },
      getTroveEntireDebt: async (trove) => {
        return th.getTroveEntireDebt(contracts, trove);
      },
      getTroveStake: async (trove) => {
        return th.getTroveStake(contracts, trove);
      },
      ...afterDeployResult,
      ...afterConnectResult,
    };
  };
  return () => loadFixture(fixture);
}

module.exports = {
  createDeployAndFundFixture,
};
