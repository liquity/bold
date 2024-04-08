const { time } = require('@nomicfoundation/hardhat-network-helpers');
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

  const getOpenTroveBoldAmount = async (totalDebt) =>
    th.getOpenTroveBoldAmount(contracts, totalDebt);
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

  it("CollSurplusPool::getETHBalance(): Returns the ETH balance of the CollSurplusPool after redemption", async () => {
    const ETH_1 = await collSurplusPool.getETHBalance();
    assert.equal(ETH_1, "0");

    const price = toBN(dec(100, 18));
    await priceFeed.setPrice(price);

    const { collateral: B_coll, netDebt: B_netDebt } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraParams: { from: B },
    });
    await openTrove({
      extraBoldAmount: B_netDebt,
      extraParams: { from: A, value: dec(3000, "ether") },
    });

    // skip bootstrapping phase
    await time.increase(timeValues.SECONDS_IN_ONE_WEEK * 2);

    // At ETH:USD = 100, this redemption should leave 1 ether of coll surplus
    await th.redeemCollateralAndGetTxObject(A, contracts, B_netDebt);

    const ETH_2 = await collSurplusPool.getETHBalance();
    th.assertIsApproximatelyEqual(
      ETH_2,
      B_coll.sub(B_netDebt.mul(mv._1e18BN).div(price))
    );
  });

  it("CollSurplusPool: claimColl(): Reverts if caller is not Borrower Operations", async () => {
    await th.assertRevert(
      collSurplusPool.claimColl(A, th.addressToTroveId(A), { from: A }),
      "CollSurplusPool: Caller is not Borrower Operations"
    );
  });

  it("CollSurplusPool: claimColl(): Reverts if nothing to claim", async () => {
    await th.assertRevert(
      borrowerOperations.claimCollateral(th.addressToTroveId(A), { from: A }),
      "CollSurplusPool: No collateral available to claim"
    );
  });

  it("CollSurplusPool: reverts trying to send ETH to it", async () => {
    await th.assertRevert(
      web3.eth.sendTransaction({
        from: A,
        to: collSurplusPool.address,
        value: 1,
      }),
      "CollSurplusPool: Caller is not Active Pool"
    );
  });

  it("CollSurplusPool: accountSurplus: reverts if caller is not Trove Manager", async () => {
    await th.assertRevert(
      collSurplusPool.accountSurplus(A, 1),
      "CollSurplusPool: Caller is not TroveManager"
    );
  });
});

contract("Reset chain state", async (accounts) => {});
