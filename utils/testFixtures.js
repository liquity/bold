const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const deploymentHelper = require("./deploymentHelpers.js");
const { fundAccounts } = require("./fundAccounts.js");

// Returns a fixture utility to be called in every test.
// The callback parameter can be used to run code after the
// deployment. They take the contracts as a parameter, which
// can be modified as needed. The returned object will be merged
// with the object returned by the fixture loader utility.
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
    const callbackResult = await callback(contracts);
    return { contracts, ...callbackResult };
  };
  return () => loadFixture(fixture);
}

module.exports = {
  createDeployAndFundFixture,
};
