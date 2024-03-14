const deploymentHelper = require("../utils/deploymentHelpers.js");
const testHelpers = require("../utils/testHelpers.js");
const { fundAccounts } = require("../utils/fundAccounts.js");
const NonPayable = artifacts.require("NonPayable.sol");

const th = testHelpers.TestHelper;
const dec = th.dec;
const toBN = th.toBN;
const mv = testHelpers.MoneyValues;
const timeValues = testHelpers.TimeValues;

const TroveManagerTester = artifacts.require("TroveManagerTester");
const BoldToken = artifacts.require("BoldToken");

contract("CollSurplusPool", async (accounts) => {
  const [owner, A, B, C, D, E] = accounts;

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000);

  let borrowerOperations;
  let priceFeed;
  let collSurplusPool;

  let contracts;

  const getOpenTroveBoldAmount = async (totalDebt) =>
    th.getOpenTroveBoldAmount(contracts, totalDebt);
  const openTrove = async (params) => th.openTrove(contracts, params);

  beforeEach(async () => {
    contracts = await deploymentHelper.deployLiquityCore();
    contracts.troveManager = await TroveManagerTester.new();
    contracts.boldToken = await BoldToken.new(
      contracts.troveManager.address,
      contracts.stabilityPool.address,
      contracts.borrowerOperations.address
    );
    

    priceFeed = contracts.priceFeedTestnet;
    collSurplusPool = contracts.collSurplusPool;
    borrowerOperations = contracts.borrowerOperations;

    await deploymentHelper.connectCoreContracts(contracts);
    await fundAccounts([
      owner, A, B, C, D, E,
      bountyAddress, lpRewardsAddress, multisig
    ], contracts.WETH);
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
    await th.fastForwardTime(
      timeValues.SECONDS_IN_ONE_WEEK * 2,
      web3.currentProvider
    );

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
