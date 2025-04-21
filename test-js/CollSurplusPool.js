const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { createDeployAndFundFixture } = require("../utils/testFixtures.js");
const {
  MoneyValues: mv,
  TestHelper: th,
  TimeValues: timeValues,
} = require("../utils/testHelpers.js");

const { dec, toBN } = th;

const TroveManagerTester = artifacts.require("TroveManagerTester");

contract("CollSurplusPool", async (accounts) => {
  const fundedAccounts = accounts.slice(0, 6);

  const [owner, A, B, C, D, E] = fundedAccounts;

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000);

  let contracts;
  let borrowerOperations;
  let collSurplusPool;
  let priceFeed;

  const getOpenTroveBoldAmount = async (totalDebt) => th.getOpenTroveBoldAmount(contracts, totalDebt);
  const openTrove = async (params) => th.openTrove(contracts, params);

  const deployFixture = createDeployAndFundFixture({
    accounts: fundedAccounts,
    mocks: { TroveManager: TroveManagerTester },
  });

  beforeEach(async () => {
    const result = await deployFixture();
    contracts = result.contracts;
    borrowerOperations = contracts.borrowerOperations;
    collSurplusPool = contracts.collSurplusPool;
    priceFeed = contracts.priceFeedTestnet;
  });

  it("CollSurplusPool: claimColl(): Reverts if caller is not Borrower Operations", async () => {
    await th.assertRevert(
      collSurplusPool.claimColl(A, { from: A }),
      "CollSurplusPool: Caller is not Borrower Operations",
    );
  });

  it("CollSurplusPool: claimColl(): Reverts if nothing to claim", async () => {
    await th.assertRevert(
      borrowerOperations.claimCollateral({ from: A }),
      "CollSurplusPool: No collateral available to claim",
    );
  });

  it("CollSurplusPool: reverts trying to send ETH to it", async () => {
    await th.assertRevert(
      web3.eth.sendTransaction({
        from: A,
        to: collSurplusPool.address,
        value: 1,
      }),
      "CollSurplusPool: Caller is not Active Pool",
    );
  });

  it("CollSurplusPool: accountSurplus: reverts if caller is not Trove Manager", async () => {
    await th.assertRevert(
      collSurplusPool.accountSurplus(A, 1),
      "CollSurplusPool: Caller is not TroveManager",
    );
  });
});

contract("Reset chain state", async (accounts) => {});
