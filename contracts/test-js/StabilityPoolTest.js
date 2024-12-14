const { time } = require("@nomicfoundation/hardhat-network-helpers");
const {
  MoneyValues: mv,
  TestHelper: th,
  TimeValues: timeValues,
} = require("../utils/testHelpers.js");
const { createDeployAndFundFixture } = require("../utils/testFixtures.js");

const { dec, toBN } = th;

const TroveManagerTester = artifacts.require("TroveManagerTester");
const NonPayableSwitch = artifacts.require("NonPayableSwitch.sol");

const ZERO = toBN("0");
const ZERO_ADDRESS = th.ZERO_ADDRESS;

const GAS_PRICE = 10000000;

const getFrontEndTag = async (stabilityPool, depositor) => {
  return (await stabilityPool.deposits(depositor))[1];
};

contract("StabilityPool", async (accounts) => {
  const fundedAccounts = accounts.slice(0, 20);

  const [
    owner,
    defaulter_1,
    defaulter_2,
    defaulter_3,
    whale,
    alice,
    bob,
    carol,
    dennis,
    erin,
    flyn,
    A,
    B,
    C,
    D,
    E,
    F,
    frontEnd_1,
    frontEnd_2,
    frontEnd_3,
  ] = fundedAccounts;

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000);

  const frontEnds = [frontEnd_1, frontEnd_2, frontEnd_3];

  let contracts;
  let priceFeed;
  let boldToken;
  let sortedTroves;
  let troveManager;
  let activePool;
  let stabilityPool;
  let defaultPool;
  let borrowerOperations;

  const getOpenTroveBoldAmount = async (totalDebt) => th.getOpenTroveBoldAmount(contracts, totalDebt);
  const openTrove = async (params) => th.openTrove(contracts, params);
  const assertRevert = th.assertRevert;

  const deployFixture = createDeployAndFundFixture({
    accounts: fundedAccounts.slice(0, 20),
    mocks: { TroveManager: TroveManagerTester },
  });

  describe("Stability Pool Mechanisms", async () => {
    beforeEach(async () => {
      const result = await deployFixture();
      contracts = result.contracts;
      priceFeed = contracts.priceFeed;
      boldToken = contracts.boldToken;
      sortedTroves = contracts.sortedTroves;
      troveManager = contracts.troveManager;
      activePool = contracts.activePool;
      stabilityPool = contracts.stabilityPool;
      defaultPool = contracts.defaultPool;
      borrowerOperations = contracts.borrowerOperations;
    });

    // --- provideToSP() ---
    // increases recorded Bold at Stability Pool
    it("provideToSP(): increases the Stability Pool Bold balance", async () => {
      // --- SETUP --- Give Alice a least 200
      await openTrove({
        extraBoldAmount: toBN(200),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });

      // --- TEST ---

      // provideToSP()
      await th.provideToSPAndClaim(contracts, 200, { from: alice });

      // check Bold balances after
      const stabilityPool_Bold_After = await stabilityPool.getTotalBoldDeposits();
      assert.equal(stabilityPool_Bold_After, 200);
    });

    it("provideToSP(): updates the user's deposit record in StabilityPool", async () => {
      // --- SETUP --- Give Alice a least 200
      await openTrove({
        extraBoldAmount: toBN(200),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });

      // --- TEST ---
      // check user's deposit record before
      const alice_depositRecord_Before = await stabilityPool.deposits(alice);
      assert.equal(alice_depositRecord_Before, 0);

      // provideToSP()
      await th.provideToSPAndClaim(contracts, 200, { from: alice });

      // check user's deposit record after
      const alice_depositRecord_After = await stabilityPool.deposits(alice);
      assert.equal(alice_depositRecord_After, 200);
    });

    it("provideToSP(): reduces the user's Bold balance by the correct amount", async () => {
      // --- SETUP --- Give Alice a least 200
      await openTrove({
        extraBoldAmount: toBN(200),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });

      // --- TEST ---
      // get user's deposit record before
      const alice_BoldBalance_Before = await boldToken.balanceOf(alice);

      // provideToSP()
      await th.provideToSPAndClaim(contracts, 200, { from: alice });

      // check user's Bold balance change
      const alice_BoldBalance_After = await boldToken.balanceOf(alice);
      assert.equal(
        alice_BoldBalance_Before.sub(alice_BoldBalance_After),
        "200",
      );
    });

    it("provideToSP(): increases totalBoldDeposits by correct amount", async () => {
      // --- SETUP ---

      // Whale opens Trove with 50 ETH, adds 2000 Bold to StabilityPool
      await openTrove({
        extraBoldAmount: toBN(dec(2000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: whale },
      });
      await th.provideToSPAndClaim(contracts, dec(2000, 18), {
        from: whale,
      });

      const totalBoldDeposits = await stabilityPool.getTotalBoldDeposits();
      assert.equal(totalBoldDeposits, dec(2000, 18));
    });

    it("provideToSP(): Correctly updates user snapshots of accumulated rewards per unit staked", async () => {
      // --- SETUP ---

      // Whale opens Trove and deposits to SP
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: whale, value: dec(50, "ether") },
      });
      const whaleBold = await boldToken.balanceOf(whale);
      await th.provideToSPAndClaim(contracts, whaleBold, { from: whale });

      // 2 Troves opened, each withdraws minimum debt
      const { troveId: defaulter_1_TroveId } = await openTrove({
        extraBoldAmount: 0,
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_1 },
      });
      const { troveId: defaulter_2_TroveId } = await openTrove({
        extraBoldAmount: 0,
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_2 },
      });

      // Alice makes Trove and withdraws 100 Bold
      await openTrove({
        extraBoldAmount: toBN(dec(100, 18)),
        ICR: toBN(dec(5, 18)),
        extraParams: { from: alice, value: dec(50, "ether") },
      });

      // price drops: defaulter's Troves fall below MCR, whale doesn't
      await priceFeed.setPrice(dec(105, 18));

      const SPBold_Before = await stabilityPool.getTotalBoldDeposits();

      // Troves are closed
      await troveManager.liquidate(defaulter_1_TroveId, { from: owner });
      await troveManager.liquidate(defaulter_2_TroveId, { from: owner });
      assert.isFalse(await sortedTroves.contains(defaulter_1_TroveId));
      assert.isFalse(await sortedTroves.contains(defaulter_2_TroveId));

      // Confirm SP has decreased
      const SPBold_After = await stabilityPool.getTotalBoldDeposits();
      assert.isTrue(SPBold_After.lt(SPBold_Before));

      // --- TEST ---
      const P_Before = await stabilityPool.P();
      const S_Before = await stabilityPool.epochToScaleToS(0, 0);
      assert.isTrue(P_Before.gt(toBN("0")));
      assert.isTrue(S_Before.gt(toBN("0")));

      // Check 'Before' snapshots
      const alice_snapshot_Before = await stabilityPool.depositSnapshots(alice);
      const alice_snapshot_S_Before = alice_snapshot_Before[0].toString();
      const alice_snapshot_P_Before = alice_snapshot_Before[1].toString();
      assert.equal(alice_snapshot_S_Before, "0");
      assert.equal(alice_snapshot_P_Before, "0");

      // Make deposit
      await th.provideToSPAndClaim(contracts, dec(100, 18), {
        from: alice,
      });

      // Check 'After' snapshots
      const alice_snapshot_After = await stabilityPool.depositSnapshots(alice);
      const alice_snapshot_S_After = alice_snapshot_After[0].toString();
      const alice_snapshot_P_After = alice_snapshot_After[1].toString();

      assert.equal(alice_snapshot_S_After, S_Before);
      assert.equal(alice_snapshot_P_After, P_Before);
    });

    it("provideToSP(), multiple deposits: updates user's deposit and snapshots", async () => {
      // --- SETUP ---
      // Whale opens Trove and deposits to SP
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: whale, value: dec(50, "ether") },
      });
      const whaleBold = await boldToken.balanceOf(whale);
      await th.provideToSPAndClaim(contracts, whaleBold, { from: whale });

      // 3 Troves opened. Two users withdraw 160 Bold each
      const { troveId: defaulter_1_TroveId } = await openTrove({
        extraBoldAmount: 0,
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_1, value: dec(50, "ether") },
      });
      const { troveId: defaulter_2_TroveId } = await openTrove({
        extraBoldAmount: 0,
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_2, value: dec(50, "ether") },
      });
      const { troveId: defaulter_3_TroveId } = await openTrove({
        extraBoldAmount: 0,
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_3, value: dec(50, "ether") },
      });

      // --- TEST ---

      // Alice makes deposit #1: 150 Bold
      await openTrove({
        extraBoldAmount: toBN(dec(250, 18)),
        ICR: toBN(dec(3, 18)),
        extraParams: { from: alice },
      });
      await th.provideToSPAndClaim(contracts, dec(150, 18), {
        from: alice,
      });

      const alice_Snapshot_0 = await stabilityPool.depositSnapshots(alice);
      const alice_Snapshot_S_0 = alice_Snapshot_0[0];
      const alice_Snapshot_P_0 = alice_Snapshot_0[1];
      assert.equal(alice_Snapshot_S_0, 0);
      assert.equal(alice_Snapshot_P_0, "1000000000000000000");

      // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
      await priceFeed.setPrice(dec(105, 18));

      // 2 users with Trove with 180 Bold drawn are closed
      await troveManager.liquidate(defaulter_1_TroveId, { from: owner }); // 180 Bold closed
      await troveManager.liquidate(defaulter_2_TroveId, { from: owner }); // 180 Bold closed

      const alice_compoundedDeposit_1 = await stabilityPool.getCompoundedBoldDeposit(alice);

      // Alice makes deposit #2
      const alice_topUp_1 = toBN(dec(100, 18));
      await th.provideToSPAndClaim(contracts, alice_topUp_1, {
        from: alice,
      });

      const alice_newDeposit_1 = (
        await stabilityPool.deposits(alice)
      ).toString();
      assert.equal(
        alice_compoundedDeposit_1.add(alice_topUp_1),
        alice_newDeposit_1,
      );

      // get system reward terms
      const P_1 = await stabilityPool.P();
      const S_1 = await stabilityPool.epochToScaleToS(0, 0);
      assert.isTrue(P_1.lt(toBN(dec(1, 18))));
      assert.isTrue(S_1.gt(toBN("0")));

      // check Alice's new snapshot is correct
      const alice_Snapshot_1 = await stabilityPool.depositSnapshots(alice);
      const alice_Snapshot_S_1 = alice_Snapshot_1[0];
      const alice_Snapshot_P_1 = alice_Snapshot_1[1];
      assert.isTrue(alice_Snapshot_S_1.eq(S_1));
      assert.isTrue(alice_Snapshot_P_1.eq(P_1));

      // Bob opens a Trove (sandwiched by a price movement to be above CT) and deposits to StabilityPool
      await priceFeed.setPrice(dec(200, 18));
      await openTrove({
        extraBoldAmount: toBN(dec(1000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob },
      });
      await priceFeed.setPrice(dec(100, 18));
      await th.provideToSPAndClaim(contracts, dec(427, 18), {
        from: alice,
      });

      // Defaulter 3 Trove is closed
      await troveManager.liquidate(defaulter_3_TroveId, { from: owner });

      const alice_compoundedDeposit_2 = await stabilityPool.getCompoundedBoldDeposit(alice);

      const P_2 = await stabilityPool.P();
      const S_2 = await stabilityPool.epochToScaleToS(0, 0);
      assert.isTrue(P_2.lt(P_1));
      assert.isTrue(S_2.gt(S_1));

      // Alice makes deposit #3:  100Bold
      await th.provideToSPAndClaim(contracts, dec(100, 18), {
        from: alice,
      });

      // check Alice's new snapshot is correct
      const alice_Snapshot_2 = await stabilityPool.depositSnapshots(alice);
      const alice_Snapshot_S_2 = alice_Snapshot_2[0];
      const alice_Snapshot_P_2 = alice_Snapshot_2[1];
      assert.isTrue(alice_Snapshot_S_2.eq(S_2));
      assert.isTrue(alice_Snapshot_P_2.eq(P_2));
    });

    it("provideToSP(): reverts if user tries to provide more than their Bold balance", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: whale, value: dec(50, "ether") },
      });

      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice, value: dec(50, "ether") },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob, value: dec(50, "ether") },
      });
      const aliceBoldbal = await boldToken.balanceOf(alice);
      const bobBoldbal = await boldToken.balanceOf(bob);

      // Alice, attempts to deposit 1 wei more than her balance

      const aliceTxPromise = stabilityPool.provideToSP(
        aliceBoldbal.add(toBN(1)),
        { from: alice },
      );
      await assertRevert(aliceTxPromise, "revert");

      // Bob, attempts to deposit 235534 more than his balance

      const bobTxPromise = stabilityPool.provideToSP(
        bobBoldbal.add(toBN(dec(235534, 18))),
        { from: bob },
      );
      await assertRevert(bobTxPromise, "revert");
    });

    it("provideToSP(): reverts if user tries to provide 2^256-1 Bold, which exceeds their balance", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: whale, value: dec(50, "ether") },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice, value: dec(50, "ether") },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob, value: dec(50, "ether") },
      });

      // Alice attempts to deposit 2^256-1 Bold
      try {
        aliceTx = await th.provideToSPAndClaim(contracts, th.MAX_UINT256, {
          from: alice,
        });
        assert.isFalse(tx.receipt.status);
      } catch (error) {
        assert.include(error.message, "revert");
      }
    });

    it("provideToSP(): doesn't impact other users' deposits or ETH gains", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: whale, value: dec(50, "ether") },
      });

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({
        extraBoldAmount: toBN(dec(1000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(2000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(3000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: carol },
      });

      await th.provideToSPAndClaim(contracts, dec(1000, 18), {
        from: alice,
      });
      await th.provideToSPAndClaim(contracts, dec(2000, 18), { from: bob });
      await th.provideToSPAndClaim(contracts, dec(3000, 18), {
        from: carol,
      });

      // D opens a trove
      await openTrove({
        extraBoldAmount: toBN(dec(300, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: dennis },
      });

      // Would-be defaulters open troves
      const { troveId: defaulter_1_TroveId } = await openTrove({
        extraBoldAmount: 0,
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_1 },
      });
      const { troveId: defaulter_2_TroveId } = await openTrove({
        extraBoldAmount: 0,
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_2 },
      });

      // Price drops
      await priceFeed.setPrice(dec(105, 18));

      // Defaulters are liquidated
      await troveManager.liquidate(defaulter_1_TroveId);
      await troveManager.liquidate(defaulter_2_TroveId);
      assert.isFalse(await sortedTroves.contains(defaulter_1_TroveId));
      assert.isFalse(await sortedTroves.contains(defaulter_2_TroveId));

      const alice_BoldDeposit_Before = (
        await stabilityPool.getCompoundedBoldDeposit(alice)
      ).toString();
      const bob_BoldDeposit_Before = (
        await stabilityPool.getCompoundedBoldDeposit(bob)
      ).toString();
      const carol_BoldDeposit_Before = (
        await stabilityPool.getCompoundedBoldDeposit(carol)
      ).toString();

      const alice_ETHGain_Before = (
        await stabilityPool.getDepositorCollGain(alice)
      ).toString();
      const bob_ETHGain_Before = (
        await stabilityPool.getDepositorCollGain(bob)
      ).toString();
      const carol_ETHGain_Before = (
        await stabilityPool.getDepositorCollGain(carol)
      ).toString();

      // check non-zero Bold and ETHGain in the Stability Pool
      const BoldinSP = await stabilityPool.getTotalBoldDeposits();
      const ETHinSP = await stabilityPool.getCollBalance();
      assert.isTrue(BoldinSP.gt(mv._zeroBN));
      assert.isTrue(ETHinSP.gt(mv._zeroBN));

      // D makes an SP deposit
      await th.provideToSPAndClaim(contracts, dec(1000, 18), {
        from: dennis,
      });
      assert.equal(
        (await stabilityPool.getCompoundedBoldDeposit(dennis)).toString(),
        dec(1000, 18),
      );

      const alice_BoldDeposit_After = (
        await stabilityPool.getCompoundedBoldDeposit(alice)
      ).toString();
      const bob_BoldDeposit_After = (
        await stabilityPool.getCompoundedBoldDeposit(bob)
      ).toString();
      const carol_BoldDeposit_After = (
        await stabilityPool.getCompoundedBoldDeposit(carol)
      ).toString();

      const alice_ETHGain_After = (
        await stabilityPool.getDepositorCollGain(alice)
      ).toString();
      const bob_ETHGain_After = (
        await stabilityPool.getDepositorCollGain(bob)
      ).toString();
      const carol_ETHGain_After = (
        await stabilityPool.getDepositorCollGain(carol)
      ).toString();

      // Check compounded deposits and ETH gains for A, B and C have not changed
      assert.equal(alice_BoldDeposit_Before, alice_BoldDeposit_After);
      assert.equal(bob_BoldDeposit_Before, bob_BoldDeposit_After);
      assert.equal(carol_BoldDeposit_Before, carol_BoldDeposit_After);

      assert.equal(alice_ETHGain_Before, alice_ETHGain_After);
      assert.equal(bob_ETHGain_Before, bob_ETHGain_After);
      assert.equal(carol_ETHGain_Before, carol_ETHGain_After);
    });

    it("provideToSP(): doesn't impact system debt, collateral or TCR", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: whale, value: dec(50, "ether") },
      });

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({
        extraBoldAmount: toBN(dec(1000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(2000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(3000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: carol },
      });

      await th.provideToSPAndClaim(contracts, dec(1000, 18), {
        from: alice,
      });
      await th.provideToSPAndClaim(contracts, dec(2000, 18), { from: bob });
      await th.provideToSPAndClaim(contracts, dec(3000, 18), {
        from: carol,
      });

      // D opens a trove
      await openTrove({
        extraBoldAmount: toBN(dec(3000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: dennis },
      });

      // Would-be defaulters open troves
      const { troveId: defaulter_1_TroveId } = await openTrove({
        extraBoldAmount: 0,
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_1 },
      });
      const { troveId: defaulter_2_TroveId } = await openTrove({
        extraBoldAmount: 0,
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_2 },
      });

      // Price drops
      await priceFeed.setPrice(dec(105, 18));

      // Defaulters are liquidated
      await troveManager.liquidate(defaulter_1_TroveId);
      await troveManager.liquidate(defaulter_2_TroveId);
      assert.isFalse(await sortedTroves.contains(defaulter_1_TroveId));
      assert.isFalse(await sortedTroves.contains(defaulter_2_TroveId));

      const activeDebt_Before = (await activePool.getBoldDebt()).toString();
      const defaultedDebt_Before = (await defaultPool.getBoldDebt()).toString();
      const activeColl_Before = (await activePool.getCollBalance()).toString();
      const defaultedColl_Before = (await defaultPool.getCollBalance()).toString();
      const TCR_Before = (await th.getTCR(contracts)).toString();

      // D makes an SP deposit
      await th.provideToSPAndClaim(contracts, dec(1000, 18), {
        from: dennis,
      });
      assert.equal(
        (await stabilityPool.getCompoundedBoldDeposit(dennis)).toString(),
        dec(1000, 18),
      );

      const activeDebt_After = (await activePool.getBoldDebt()).toString();
      const defaultedDebt_After = (await defaultPool.getBoldDebt()).toString();
      const activeColl_After = (await activePool.getCollBalance()).toString();
      const defaultedColl_After = (await defaultPool.getCollBalance()).toString();
      const TCR_After = (await th.getTCR(contracts)).toString();

      // Check total system debt, collateral and TCR have not changed after a Stability deposit is made
      assert.equal(activeDebt_Before, activeDebt_After);
      assert.equal(defaultedDebt_Before, defaultedDebt_After);
      assert.equal(activeColl_Before, activeColl_After);
      assert.equal(defaultedColl_Before, defaultedColl_After);
      assert.equal(TCR_Before, TCR_After);
    });

    it("provideToSP(): doesn't impact any troves, including the caller's trove", async () => {
      const { troveId: whaleTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: whale, value: dec(50, "ether") },
      });

      // A, B, C open troves and make Stability Pool deposits
      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(1000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });
      const { troveId: bobTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(2000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob },
      });
      const { troveId: carolTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(3000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: carol },
      });

      // A and B provide to SP
      await th.provideToSPAndClaim(contracts, dec(1000, 18), {
        from: alice,
      });
      await th.provideToSPAndClaim(contracts, dec(2000, 18), { from: bob });

      // D opens a trove
      const { troveId: dennisTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(1000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: dennis },
      });

      // Price drops
      await priceFeed.setPrice(dec(105, 18));
      const price = await priceFeed.getPrice();

      // Get debt, collateral and ICR of all existing troves
      const whale_Debt_Before = (
        await troveManager.Troves(whaleTroveId)
      )[0].toString();
      const alice_Debt_Before = (
        await troveManager.Troves(aliceTroveId)
      )[0].toString();
      const bob_Debt_Before = (await troveManager.Troves(bobTroveId))[0].toString();
      const carol_Debt_Before = (
        await troveManager.Troves(carolTroveId)
      )[0].toString();
      const dennis_Debt_Before = (
        await troveManager.Troves(dennisTroveId)
      )[0].toString();

      const whale_Coll_Before = (
        await troveManager.Troves(whaleTroveId)
      )[1].toString();
      const alice_Coll_Before = (
        await troveManager.Troves(aliceTroveId)
      )[1].toString();
      const bob_Coll_Before = (await troveManager.Troves(bobTroveId))[1].toString();
      const carol_Coll_Before = (
        await troveManager.Troves(carolTroveId)
      )[1].toString();
      const dennis_Coll_Before = (
        await troveManager.Troves(dennisTroveId)
      )[1].toString();

      const whale_ICR_Before = (
        await troveManager.getCurrentICR(whale, price)
      ).toString();
      const alice_ICR_Before = (
        await troveManager.getCurrentICR(alice, price)
      ).toString();
      const bob_ICR_Before = (
        await troveManager.getCurrentICR(bob, price)
      ).toString();
      const carol_ICR_Before = (
        await troveManager.getCurrentICR(carol, price)
      ).toString();
      const dennis_ICR_Before = (
        await troveManager.getCurrentICR(dennis, price)
      ).toString();

      // D makes an SP deposit
      await th.provideToSPAndClaim(contracts, dec(1000, 18), {
        from: dennis,
      });
      assert.equal(
        (await stabilityPool.getCompoundedBoldDeposit(dennis)).toString(),
        dec(1000, 18),
      );

      const whale_Debt_After = (await troveManager.Troves(whaleTroveId))[0].toString();
      const alice_Debt_After = (await troveManager.Troves(aliceTroveId))[0].toString();
      const bob_Debt_After = (await troveManager.Troves(bobTroveId))[0].toString();
      const carol_Debt_After = (await troveManager.Troves(carolTroveId))[0].toString();
      const dennis_Debt_After = (
        await troveManager.Troves(dennisTroveId)
      )[0].toString();

      const whale_Coll_After = (await troveManager.Troves(whaleTroveId))[1].toString();
      const alice_Coll_After = (await troveManager.Troves(aliceTroveId))[1].toString();
      const bob_Coll_After = (await troveManager.Troves(bobTroveId))[1].toString();
      const carol_Coll_After = (await troveManager.Troves(carolTroveId))[1].toString();
      const dennis_Coll_After = (
        await troveManager.Troves(dennisTroveId)
      )[1].toString();

      const whale_ICR_After = (
        await troveManager.getCurrentICR(whale, price)
      ).toString();
      const alice_ICR_After = (
        await troveManager.getCurrentICR(alice, price)
      ).toString();
      const bob_ICR_After = (
        await troveManager.getCurrentICR(bob, price)
      ).toString();
      const carol_ICR_After = (
        await troveManager.getCurrentICR(carol, price)
      ).toString();
      const dennis_ICR_After = (
        await troveManager.getCurrentICR(dennis, price)
      ).toString();

      assert.equal(whale_Debt_Before, whale_Debt_After);
      assert.equal(alice_Debt_Before, alice_Debt_After);
      assert.equal(bob_Debt_Before, bob_Debt_After);
      assert.equal(carol_Debt_Before, carol_Debt_After);
      assert.equal(dennis_Debt_Before, dennis_Debt_After);

      assert.equal(whale_Coll_Before, whale_Coll_After);
      assert.equal(alice_Coll_Before, alice_Coll_After);
      assert.equal(bob_Coll_Before, bob_Coll_After);
      assert.equal(carol_Coll_Before, carol_Coll_After);
      assert.equal(dennis_Coll_Before, dennis_Coll_After);

      assert.equal(whale_ICR_Before, whale_ICR_After);
      assert.equal(alice_ICR_Before, alice_ICR_After);
      assert.equal(bob_ICR_Before, bob_ICR_After);
      assert.equal(carol_ICR_Before, carol_ICR_After);
      assert.equal(dennis_ICR_Before, dennis_ICR_After);
    });

    it("provideToSP(): doesn't protect the depositor's trove from liquidation", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: whale, value: dec(50, "ether") },
      });

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({
        extraBoldAmount: toBN(dec(1000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });
      const { troveId: bobTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(2000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(3000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: carol },
      });

      // A, B provide 100 Bold to SP
      await th.provideToSPAndClaim(contracts, dec(1000, 18), {
        from: alice,
      });
      await th.provideToSPAndClaim(contracts, dec(1000, 18), { from: bob });

      // Confirm Bob has an active trove in the system
      assert.isTrue(await sortedTroves.contains(bobTroveId));
      assert.equal((await troveManager.getTroveStatus(bobTroveId)).toString(), "1"); // Confirm Bob's trove status is active

      // Confirm Bob has a Stability deposit
      assert.equal(
        (await stabilityPool.getCompoundedBoldDeposit(bob)).toString(),
        dec(1000, 18),
      );

      // Price drops
      await priceFeed.setPrice(dec(105, 18));
      const price = await priceFeed.getPrice();

      // Liquidate bob
      await troveManager.liquidate(bobTroveId);

      // Check Bob's trove has been removed from the system
      assert.isFalse(await sortedTroves.contains(bobTroveId));
      assert.equal((await troveManager.getTroveStatus(bobTroveId)).toString(), "3"); // check Bob's trove status was closed by liquidation
    });

    it("provideToSP(): providing 0 Bold reverts", async () => {
      // --- SETUP ---
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: whale, value: dec(50, "ether") },
      });

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({
        extraBoldAmount: toBN(dec(1000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(2000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(3000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: carol },
      });

      // A, B, C provides 100, 50, 30 Bold to SP
      await th.provideToSPAndClaim(contracts, dec(100, 18), {
        from: alice,
      });
      await th.provideToSPAndClaim(contracts, dec(50, 18), { from: bob });
      await th.provideToSPAndClaim(contracts, dec(30, 18), { from: carol });

      const bob_Deposit_Before = (
        await stabilityPool.getCompoundedBoldDeposit(bob)
      ).toString();
      const BoldinSP_Before = (
        await stabilityPool.getTotalBoldDeposits()
      ).toString();

      assert.equal(BoldinSP_Before, dec(180, 18));

      // Bob provides 0 Bold to the Stability Pool
      const txPromise_B = stabilityPool.provideToSP(0, {
        from: bob,
      });
      await th.assertRevert(txPromise_B);
    });

    it("provideToSP(), new deposit: depositor does not receive ETH gains", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale },
      });

      // Whale transfers Bold to A, B
      await boldToken.transfer(A, dec(100, 18), { from: whale });
      await boldToken.transfer(B, dec(200, 18), { from: whale });

      // C, D open troves
      await openTrove({
        extraBoldAmount: toBN(dec(1000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: C },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(2000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: D },
      });

      // --- TEST ---

      // get current ETH balances
      const A_ETHBalance_Before = await contracts.WETH.balanceOf(A);
      const B_ETHBalance_Before = await contracts.WETH.balanceOf(B);
      const C_ETHBalance_Before = await contracts.WETH.balanceOf(C);
      const D_ETHBalance_Before = await contracts.WETH.balanceOf(D);

      // A, B, C, D provide to SP
      const A_GAS_Used = th.gasUsed(
        await th.provideToSPAndClaim(contracts, dec(100, 18), {
          from: A,
          gasPrice: GAS_PRICE,
        }),
      );
      const B_GAS_Used = th.gasUsed(
        await th.provideToSPAndClaim(contracts, dec(200, 18), {
          from: B,
          gasPrice: GAS_PRICE,
        }),
      );
      const C_GAS_Used = th.gasUsed(
        await th.provideToSPAndClaim(contracts, dec(300, 18), {
          from: C,
          gasPrice: GAS_PRICE,
        }),
      );
      const D_GAS_Used = th.gasUsed(
        await th.provideToSPAndClaim(contracts, dec(400, 18), {
          from: D,
          gasPrice: GAS_PRICE,
        }),
      );

      // ETH balances before minus gas used
      const A_expectedBalance = A_ETHBalance_Before - A_GAS_Used;
      const B_expectedBalance = B_ETHBalance_Before - B_GAS_Used;
      const C_expectedBalance = C_ETHBalance_Before - C_GAS_Used;
      const D_expectedBalance = D_ETHBalance_Before - D_GAS_Used;

      // Get  ETH balances after
      const A_ETHBalance_After = await contracts.WETH.balanceOf(A);
      const B_ETHBalance_After = await contracts.WETH.balanceOf(B);
      const C_ETHBalance_After = await contracts.WETH.balanceOf(C);
      const D_ETHBalance_After = await contracts.WETH.balanceOf(D);

      // Check ETH balances have not changed
      assert.equal(A_ETHBalance_After, A_expectedBalance);
      assert.equal(B_ETHBalance_After, B_expectedBalance);
      assert.equal(C_ETHBalance_After, C_expectedBalance);
      assert.equal(D_ETHBalance_After, D_expectedBalance);
    });

    it("provideToSP(), new deposit after past full withdrawal: depositor does not receive ETH gains", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale },
      });

      // Whale transfers Bold to A, B
      await boldToken.transfer(A, dec(1000, 18), { from: whale });
      await boldToken.transfer(B, dec(1000, 18), { from: whale });

      // C, D open troves
      await openTrove({
        extraBoldAmount: toBN(dec(4000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: C },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: D },
      });

      const { troveId: defaulter_1_TroveId } = await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_1 },
      });

      // --- SETUP ---
      // A, B, C, D provide to SP
      await th.provideToSPAndClaim(contracts, dec(105, 18), { from: A });
      await th.provideToSPAndClaim(contracts, dec(105, 18), { from: B });
      await th.provideToSPAndClaim(contracts, dec(105, 18), { from: C });
      await th.provideToSPAndClaim(contracts, dec(105, 18), { from: D });

      // time passes
      await time.increase(timeValues.SECONDS_IN_ONE_HOUR);

      // B deposits
      await th.provideToSPAndClaim(contracts, dec(5, 18), { from: B });

      // Price drops, defaulter is liquidated, A, B, C, D earn ETH
      await priceFeed.setPrice(dec(105, 18));
      assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

      await troveManager.liquidate(defaulter_1_TroveId);

      // Price bounces back
      await priceFeed.setPrice(dec(200, 18));

      // A B,C, D fully withdraw from the pool
      await th.withdrawFromSPAndClaim(contracts, dec(105, 18), { from: A });
      await th.withdrawFromSPAndClaim(contracts, dec(105, 18), { from: B });
      await th.withdrawFromSPAndClaim(contracts, dec(105, 18), { from: C });
      await th.withdrawFromSPAndClaim(contracts, dec(105, 18), { from: D });

      // --- TEST ---

      // get current ETH balances
      const A_ETHBalance_Before = await contracts.WETH.balanceOf(A);
      const B_ETHBalance_Before = await contracts.WETH.balanceOf(B);
      const C_ETHBalance_Before = await contracts.WETH.balanceOf(C);
      const D_ETHBalance_Before = await contracts.WETH.balanceOf(D);

      // A, B, C, D provide to SP
      const A_GAS_Used = th.gasUsed(
        await th.provideToSPAndClaim(contracts, dec(100, 18), {
          from: A,
          gasPrice: GAS_PRICE,
          gasPrice: GAS_PRICE,
        }),
      );
      const B_GAS_Used = th.gasUsed(
        await th.provideToSPAndClaim(contracts, dec(200, 18), {
          from: B,
          gasPrice: GAS_PRICE,
          gasPrice: GAS_PRICE,
        }),
      );
      const C_GAS_Used = th.gasUsed(
        await th.provideToSPAndClaim(contracts, dec(300, 18), {
          from: C,
          gasPrice: GAS_PRICE,
          gasPrice: GAS_PRICE,
        }),
      );
      const D_GAS_Used = th.gasUsed(
        await th.provideToSPAndClaim(contracts, dec(400, 18), {
          from: D,
          gasPrice: GAS_PRICE,
          gasPrice: GAS_PRICE,
        }),
      );

      // ETH balances before minus gas used
      const A_expectedBalance = A_ETHBalance_Before - A_GAS_Used;
      const B_expectedBalance = B_ETHBalance_Before - B_GAS_Used;
      const C_expectedBalance = C_ETHBalance_Before - C_GAS_Used;
      const D_expectedBalance = D_ETHBalance_Before - D_GAS_Used;

      // Get  ETH balances after
      const A_ETHBalance_After = await contracts.WETH.balanceOf(A);
      const B_ETHBalance_After = await contracts.WETH.balanceOf(B);
      const C_ETHBalance_After = await contracts.WETH.balanceOf(C);
      const D_ETHBalance_After = await contracts.WETH.balanceOf(D);

      // Check ETH balances have not changed
      assert.equal(A_ETHBalance_After, A_expectedBalance);
      assert.equal(B_ETHBalance_After, B_expectedBalance);
      assert.equal(C_ETHBalance_After, C_expectedBalance);
      assert.equal(D_ETHBalance_After, D_expectedBalance);
    });

    it("provideToSP(): reverts when amount is zero", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale },
      });

      await openTrove({
        extraBoldAmount: toBN(dec(1000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: A },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(2000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: B },
      });

      // Whale transfers Bold to C, D
      await boldToken.transfer(C, dec(100, 18), { from: whale });
      await boldToken.transfer(D, dec(100, 18), { from: whale });

      txPromise_A = stabilityPool.provideToSP(0, { from: A });
      txPromise_B = stabilityPool.provideToSP(0, { from: B });
      txPromise_C = stabilityPool.provideToSP(0, { from: C });
      txPromise_D = stabilityPool.provideToSP(0, { from: D });

      await th.assertRevert(
        txPromise_A,
        "StabilityPool: Amount must be non-zero",
      );
      await th.assertRevert(
        txPromise_B,
        "StabilityPool: Amount must be non-zero",
      );
      await th.assertRevert(
        txPromise_C,
        "StabilityPool: Amount must be non-zero",
      );
      await th.assertRevert(
        txPromise_D,
        "StabilityPool: Amount must be non-zero",
      );
    });

    // --- withdrawFromSP ---

    it("withdrawFromSP(): reverts when user has no active deposit", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(100, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(100, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob },
      });

      await th.provideToSPAndClaim(contracts, dec(100, 18), {
        from: alice,
      });

      const alice_initialDeposit = (
        await stabilityPool.deposits(alice)
      ).toString();

      const bob_initialDeposit = (
        await stabilityPool.deposits(bob)
      ).toString();

      assert.equal(alice_initialDeposit, dec(100, 18));
      assert.equal(bob_initialDeposit, "0");

      const txAlice = await th.withdrawFromSPAndClaim(contracts, dec(100, 18), {
        from: alice,
      });
      assert.isTrue(txAlice.receipt.status);

      try {
        const txBob = await th.withdrawFromSPAndClaim(contracts, dec(100, 18), {
          from: bob,
        });
        assert.isFalse(txBob.receipt.status);
      } catch (err) {
        assert.include(err.message, "revert");
        // TODO: infamous issue #99
        // assert.include(err.message, "User must have a non-zero deposit")
      }
    });

    it("withdrawFromSP(): partial retrieval - retrieves correct Bold amount and the entire ETH Gain, and updates deposit", async () => {
      // --- SETUP ---
      // Whale deposits 185000 Bold in StabilityPool
      await openTrove({
        extraBoldAmount: toBN(dec(1, 24)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale },
      });
      await th.provideToSPAndClaim(contracts, dec(185000, 18), {
        from: whale,
      });

      // 2 Troves opened
      const { troveId: defaulter_1_TroveId } = await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_1 },
      });
      const { troveId: defaulter_2_TroveId } = await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_2 },
      });

      // --- TEST ---

      // Alice makes deposit #1: 15000 Bold
      await openTrove({
        extraBoldAmount: toBN(dec(15000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: alice },
      });
      await th.provideToSPAndClaim(contracts, dec(15000, 18), {
        from: alice,
      });

      // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
      await priceFeed.setPrice(dec(105, 18));

      // 2 users with Trove with 170 Bold drawn are closed
      const liquidationTX_1 = await troveManager.liquidate(defaulter_1_TroveId, {
        from: owner,
      }); // 170 Bold closed
      const liquidationTX_2 = await troveManager.liquidate(defaulter_2_TroveId, {
        from: owner,
      }); // 170 Bold closed

      const [liquidatedDebt_1] = await th.getEmittedLiquidationValues(
        liquidationTX_1,
      );
      const [liquidatedDebt_2] = await th.getEmittedLiquidationValues(
        liquidationTX_2,
      );

      // Alice BoldLoss is ((15000/200000) * liquidatedDebt), for each liquidation
      const expectedBoldLoss_A = liquidatedDebt_1
        .mul(toBN(dec(15000, 18)))
        .div(toBN(dec(200000, 18)))
        .add(
          liquidatedDebt_2.mul(toBN(dec(15000, 18))).div(toBN(dec(200000, 18))),
        );

      const expectedCompoundedBoldDeposit_A = toBN(dec(15000, 18)).sub(
        expectedBoldLoss_A,
      );
      const compoundedBoldDeposit_A = await stabilityPool.getCompoundedBoldDeposit(alice);

      assert.isAtMost(
        th.getDifference(
          expectedCompoundedBoldDeposit_A,
          compoundedBoldDeposit_A,
        ),
        100000,
      );

      // Alice retrieves part of her entitled Bold: 9000 Bold
      await th.withdrawFromSPAndClaim(contracts, dec(9000, 18), { from: alice });

      const expectedNewDeposit_A = compoundedBoldDeposit_A.sub(
        toBN(dec(9000, 18)),
      );

      // check Alice's deposit has been updated to equal her compounded deposit minus her withdrawal */
      const newDeposit = (await stabilityPool.deposits(alice)).toString();
      assert.isAtMost(
        th.getDifference(newDeposit, expectedNewDeposit_A),
        100000,
      );

      // Expect Alice has withdrawn all ETH gain
      const alice_pendingETHGain = await stabilityPool.getDepositorCollGain(
        alice,
      );
      assert.equal(alice_pendingETHGain, 0);
    });

    it("withdrawFromSP(): partial retrieval - leaves the correct amount of Bold in the Stability Pool", async () => {
      // --- SETUP ---
      // Whale deposits 185000 Bold in StabilityPool
      await openTrove({
        extraBoldAmount: toBN(dec(1, 24)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale },
      });
      await th.provideToSPAndClaim(contracts, dec(185000, 18), {
        from: whale,
      });

      // 2 Troves opened
      const { troveId: defaulter_1_TroveId } = await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_1 },
      });
      const { troveId: defaulter_2_TroveId } = await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_2 },
      });
      // --- TEST ---

      // Alice makes deposit #1: 15000 Bold
      await openTrove({
        extraBoldAmount: toBN(dec(15000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: alice },
      });
      await th.provideToSPAndClaim(contracts, dec(15000, 18), {
        from: alice,
      });

      const SP_Bold_Before = await stabilityPool.getTotalBoldDeposits();
      assert.equal(SP_Bold_Before, dec(200000, 18));

      // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
      await priceFeed.setPrice(dec(105, 18));

      // 2 users liquidated
      const liquidationTX_1 = await troveManager.liquidate(defaulter_1_TroveId, {
        from: owner,
      });
      const liquidationTX_2 = await troveManager.liquidate(defaulter_2_TroveId, {
        from: owner,
      });

      const [liquidatedDebt_1] = await th.getEmittedLiquidationValues(
        liquidationTX_1,
      );
      const [liquidatedDebt_2] = await th.getEmittedLiquidationValues(
        liquidationTX_2,
      );

      // Alice retrieves part of her entitled Bold: 9000 Bold
      await th.withdrawFromSPAndClaim(contracts, dec(9000, 18), { from: alice });

      /* Check SP has reduced from 2 liquidations and Alice's withdrawal
         Expect Bold in SP = (200000 - liquidatedDebt_1 - liquidatedDebt_2 - 9000) */
      const expectedSPBold = toBN(dec(200000, 18))
        .sub(toBN(liquidatedDebt_1))
        .sub(toBN(liquidatedDebt_2))
        .sub(toBN(dec(9000, 18)));

      const SP_Bold_After = (
        await stabilityPool.getTotalBoldDeposits()
      ).toString();

      th.assertIsApproximatelyEqual(SP_Bold_After, expectedSPBold);
    });

    it("withdrawFromSP(): full retrieval - leaves the correct amount of Bold in the Stability Pool", async () => {
      // --- SETUP ---
      // Whale deposits 185000 Bold in StabilityPool
      await openTrove({
        extraBoldAmount: toBN(dec(1000000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale },
      });
      await th.provideToSPAndClaim(contracts, dec(185000, 18), {
        from: whale,
      });

      // 2 Troves opened
      const { troveId: defaulter_1_TroveId } = await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_1 },
      });
      const { troveId: defaulter_2_TroveId } = await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_2 },
      });

      // --- TEST ---

      // Alice makes deposit #1
      await openTrove({
        extraBoldAmount: toBN(dec(15000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: alice },
      });
      await th.provideToSPAndClaim(contracts, dec(15000, 18), {
        from: alice,
      });

      const SP_Bold_Before = await stabilityPool.getTotalBoldDeposits();
      assert.equal(SP_Bold_Before, dec(200000, 18));

      // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
      await priceFeed.setPrice(dec(105, 18));

      // 2 defaulters liquidated
      const liquidationTX_1 = await troveManager.liquidate(defaulter_1_TroveId, {
        from: owner,
      });
      const liquidationTX_2 = await troveManager.liquidate(defaulter_2_TroveId, {
        from: owner,
      });

      const [liquidatedDebt_1] = await th.getEmittedLiquidationValues(
        liquidationTX_1,
      );
      const [liquidatedDebt_2] = await th.getEmittedLiquidationValues(
        liquidationTX_2,
      );

      // Alice BoldLoss is ((15000/200000) * liquidatedDebt), for each liquidation
      const expectedBoldLoss_A = liquidatedDebt_1
        .mul(toBN(dec(15000, 18)))
        .div(toBN(dec(200000, 18)))
        .add(
          liquidatedDebt_2.mul(toBN(dec(15000, 18))).div(toBN(dec(200000, 18))),
        );

      const expectedCompoundedBoldDeposit_A = toBN(dec(15000, 18)).sub(
        expectedBoldLoss_A,
      );
      const compoundedBoldDeposit_A = await stabilityPool.getCompoundedBoldDeposit(alice);

      assert.isAtMost(
        th.getDifference(
          expectedCompoundedBoldDeposit_A,
          compoundedBoldDeposit_A,
        ),
        100000,
      );

      const BoldinSPBefore = await stabilityPool.getTotalBoldDeposits();

      // Alice retrieves all of her entitled Bold:
      await th.withdrawFromSPAndClaim(contracts, dec(15000, 18), { from: alice });

      const expectedBoldinSPAfter = BoldinSPBefore.sub(compoundedBoldDeposit_A);

      const BoldinSPAfter = await stabilityPool.getTotalBoldDeposits();
      assert.isAtMost(
        th.getDifference(expectedBoldinSPAfter, BoldinSPAfter),
        100000,
      );
    });

    it("withdrawFromSP(): Subsequent deposit and withdrawal attempt from same account, with no intermediate liquidations, withdraws zero ETH", async () => {
      // --- SETUP ---
      // Whale deposits 1850 Bold in StabilityPool
      await openTrove({
        extraBoldAmount: toBN(dec(1000000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale },
      });
      await th.provideToSPAndClaim(contracts, dec(18500, 18), {
        from: whale,
      });

      // 2 defaulters open
      const { troveId: defaulter_1_TroveId } = await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_1 },
      });
      const { troveId: defaulter_2_TroveId } = await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_2 },
      });

      // --- TEST ---

      // Alice makes deposit #1: 15000 Bold
      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(15000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: alice },
      });
      await th.provideToSPAndClaim(contracts, dec(15000, 18), {
        from: alice,
      });

      // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
      await priceFeed.setPrice(dec(105, 18));

      // defaulters liquidated
      await troveManager.liquidate(defaulter_1_TroveId, { from: owner });
      await troveManager.liquidate(defaulter_2_TroveId, { from: owner });

      // Alice retrieves all of her entitled Bold:
      await th.withdrawFromSPAndClaim(contracts, dec(15000, 18), { from: alice });
      assert.equal(await stabilityPool.getDepositorCollGain(alice), 0);

      // Alice makes second deposit
      await th.provideToSPAndClaim(contracts, dec(10000, 18), {
        from: alice,
      });
      assert.equal(await stabilityPool.getDepositorCollGain(alice), 0);

      const ETHinSP_Before = (await stabilityPool.getCollBalance()).toString();

      // Alice attempts second withdrawal
      await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: alice });
      assert.equal(await stabilityPool.getDepositorCollGain(alice), 0);

      // Check ETH in pool does not change
      const ETHinSP_1 = (await stabilityPool.getCollBalance()).toString();
      assert.equal(ETHinSP_Before, ETHinSP_1);
    });

    it("withdrawFromSP(): it correctly updates the user's Bold and ETH snapshots of entitled reward per unit staked", async () => {
      // --- SETUP ---
      // Whale deposits 185000 Bold in StabilityPool
      await openTrove({
        extraBoldAmount: toBN(dec(1000000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale },
      });
      await th.provideToSPAndClaim(contracts, dec(185000, 18), {
        from: whale,
      });

      // 2 defaulters open
      const { troveId: defaulter_1_TroveId } = await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_1 },
      });
      const { troveId: defaulter_2_TroveId } = await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_2 },
      });

      // --- TEST ---

      // Alice makes deposit #1: 15000 Bold
      await openTrove({
        extraBoldAmount: toBN(dec(15000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: alice },
      });
      await th.provideToSPAndClaim(contracts, dec(15000, 18), {
        from: alice,
      });

      // check 'Before' snapshots
      const alice_snapshot_Before = await stabilityPool.depositSnapshots(alice);
      const alice_snapshot_S_Before = alice_snapshot_Before[0].toString();
      const alice_snapshot_P_Before = alice_snapshot_Before[1].toString();
      assert.equal(alice_snapshot_S_Before, 0);
      assert.equal(alice_snapshot_P_Before, "1000000000000000000");

      // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
      await priceFeed.setPrice(dec(105, 18));

      // 2 defaulters liquidated
      await troveManager.liquidate(defaulter_1_TroveId, { from: owner });
      await troveManager.liquidate(defaulter_2_TroveId, { from: owner });

      // Alice retrieves part of her entitled Bold: 9000 Bold
      await th.withdrawFromSPAndClaim(contracts, dec(9000, 18), { from: alice });

      const P = (await stabilityPool.P()).toString();
      const S = (await stabilityPool.epochToScaleToS(0, 0)).toString();
      // check 'After' snapshots
      const alice_snapshot_After = await stabilityPool.depositSnapshots(alice);
      const alice_snapshot_S_After = alice_snapshot_After[0].toString();
      const alice_snapshot_P_After = alice_snapshot_After[1].toString();
      assert.equal(alice_snapshot_S_After, S);
      assert.equal(alice_snapshot_P_After, P);
    });

    it("withdrawFromSP(): decreases StabilityPool ETH", async () => {
      // --- SETUP ---
      // Whale deposits 185000 Bold in StabilityPool
      await openTrove({
        extraBoldAmount: toBN(dec(1000000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale },
      });
      await th.provideToSPAndClaim(contracts, dec(185000, 18), {
        from: whale,
      });

      // 1 defaulter opens
      const { troveId: defaulter_1_TroveId } = await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_1 },
      });

      // --- TEST ---

      // Alice makes deposit #1: 15000 Bold
      await openTrove({
        extraBoldAmount: toBN(dec(15000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: alice },
      });
      await th.provideToSPAndClaim(contracts, dec(15000, 18), {
        from: alice,
      });

      // price drops: defaulter's Trove falls below MCR, alice and whale Trove remain active
      await priceFeed.setPrice("100000000000000000000");

      // defaulter's Trove is closed.
      const liquidationTx_1 = await troveManager.liquidate(defaulter_1_TroveId, {
        from: owner,
      }); // 180 Bold closed
      const [, liquidatedColl] = th.getEmittedLiquidationValues(liquidationTx_1);

      // Get ActivePool and StabilityPool Ether before retrieval:
      const active_ETH_Before = await activePool.getCollBalance();
      const stability_ETH_Before = await stabilityPool.getCollBalance();

      // Expect alice to be entitled to 15000/200000 of the liquidated coll
      const aliceExpectedETHGain = liquidatedColl
        .mul(toBN(dec(15000, 18)))
        .div(toBN(dec(200000, 18)));
      const aliceETHGain = await stabilityPool.getDepositorCollGain(alice);
      assert.isTrue(aliceExpectedETHGain.eq(aliceETHGain));

      // Alice retrieves all of her deposit
      await th.withdrawFromSPAndClaim(contracts, dec(15000, 18), { from: alice });

      const active_ETH_After = await activePool.getCollBalance();
      const stability_ETH_After = await stabilityPool.getCollBalance();

      const active_ETH_Difference = active_ETH_Before.sub(active_ETH_After);
      const stability_ETH_Difference = stability_ETH_Before.sub(stability_ETH_After);

      assert.equal(active_ETH_Difference, "0");

      // Expect StabilityPool to have decreased by Alice's ETHGain
      assert.isAtMost(
        th.getDifference(stability_ETH_Difference, aliceETHGain),
        10000,
      );
    });

    it("withdrawFromSP(): All depositors are able to withdraw from the SP to their account", async () => {
      // Whale opens trove
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } });

      // 1 defaulter open
      const { troveId: defaulter_1_TroveId } = await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_1 },
      });

      // 6 Accounts open troves and provide to SP
      const depositors = [alice, bob, carol, dennis, erin, flyn];
      for (account of depositors) {
        await openTrove({
          extraBoldAmount: toBN(dec(10000, 18)),
          ICR: toBN(dec(2, 18)),
          extraParams: { from: account },
        });
        await th.provideToSPAndClaim(contracts, dec(10000, 18), {
          from: account,
        });
      }

      await priceFeed.setPrice(dec(105, 18));
      await troveManager.liquidate(defaulter_1_TroveId);

      await priceFeed.setPrice(dec(200, 18));

      // All depositors attempt to withdraw
      await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: alice });
      assert.equal((await stabilityPool.deposits(alice)).toString(), "0");
      await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: bob });
      assert.equal((await stabilityPool.deposits(alice)).toString(), "0");
      await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: carol });
      assert.equal((await stabilityPool.deposits(alice)).toString(), "0");
      await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: dennis });
      assert.equal((await stabilityPool.deposits(alice)).toString(), "0");
      await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: erin });
      assert.equal((await stabilityPool.deposits(alice)).toString(), "0");
      await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: flyn });
      assert.equal((await stabilityPool.deposits(alice)).toString(), "0");

      const totalDeposits = (
        await stabilityPool.getTotalBoldDeposits()
      ).toString();

      assert.isAtMost(th.getDifference(totalDeposits, "0"), 100000);
    });

    it("withdrawFromSP(): increases depositor's Bold token balance by the expected amount", async () => {
      // Whale opens trove
      await openTrove({
        extraBoldAmount: toBN(dec(100000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale },
      });

      // 1 defaulter opens trove
      const defaulter_1_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(10000, 18)),
        defaulter_1,
        defaulter_1,
        0,
        { from: defaulter_1, value: dec(100, "ether") },
      );

      const defaulterDebt = (
        await troveManager.getEntireDebtAndColl(defaulter_1_TroveId)
      )[0];

      // 6 Accounts open troves and provide to SP
      const depositors = [alice, bob, carol, dennis, erin, flyn];
      for (account of depositors) {
        await openTrove({
          extraBoldAmount: toBN(dec(10000, 18)),
          ICR: toBN(dec(2, 18)),
          extraParams: { from: account },
        });
        await th.provideToSPAndClaim(contracts, dec(10000, 18), {
          from: account,
        });
      }

      await priceFeed.setPrice(dec(105, 18));
      await troveManager.liquidate(defaulter_1_TroveId);

      const aliceBalBefore = await boldToken.balanceOf(alice);
      const bobBalBefore = await boldToken.balanceOf(bob);

      /* From an offset of 10000 Bold, each depositor receives
         BoldLoss = 1666.6666666666666666 Bold

         and thus with a deposit of 10000 Bold, each should withdraw 8333.3333333333333333 Bold (in practice, slightly less due to rounding error)
      */

      // Price bounces back to $200 per ETH
      await priceFeed.setPrice(dec(200, 18));

      // Bob issues a further 5000 Bold from his trove
      await borrowerOperations.withdrawBold(th.addressToTroveId(bob), dec(5000, 18), th.MAX_UINT256, { from: bob });

      // Expect Alice's Bold balance increase be very close to 8333.3333333333333333 Bold
      await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: alice });
      const aliceBalance = await boldToken.balanceOf(alice);

      assert.isAtMost(
        th.getDifference(
          aliceBalance.sub(aliceBalBefore),
          "8333333333333333333333",
        ),
        100000,
      );

      // expect Bob's Bold balance increase to be very close to  13333.33333333333333333 Bold
      await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: bob });
      const bobBalance = await boldToken.balanceOf(bob);
      assert.isAtMost(
        th.getDifference(
          bobBalance.sub(bobBalBefore),
          "13333333333333333333333",
        ),
        100000,
      );
    });

    it("withdrawFromSP(): doesn't impact other users Stability deposits or ETH gains", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(100000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale },
      });

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(30000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: carol },
      });

      await th.provideToSPAndClaim(contracts, dec(10000, 18), {
        from: alice,
      });
      await th.provideToSPAndClaim(contracts, dec(20000, 18), {
        from: bob,
      });
      await th.provideToSPAndClaim(contracts, dec(30000, 18), {
        from: carol,
      });

      // Would-be defaulters open troves
      const { troveId: defaulter_1_TroveId } = await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_1 },
      });
      const { troveId: defaulter_2_TroveId } = await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_2 },
      });

      // Price drops
      await priceFeed.setPrice(dec(105, 18));

      // Defaulters are liquidated
      await troveManager.liquidate(defaulter_1_TroveId);
      await troveManager.liquidate(defaulter_2_TroveId);
      assert.isFalse(await sortedTroves.contains(defaulter_1_TroveId));
      assert.isFalse(await sortedTroves.contains(defaulter_2_TroveId));

      const alice_BoldDeposit_Before = (
        await stabilityPool.getCompoundedBoldDeposit(alice)
      ).toString();
      const bob_BoldDeposit_Before = (
        await stabilityPool.getCompoundedBoldDeposit(bob)
      ).toString();

      const alice_ETHGain_Before = (
        await stabilityPool.getDepositorCollGain(alice)
      ).toString();
      const bob_ETHGain_Before = (
        await stabilityPool.getDepositorCollGain(bob)
      ).toString();

      // check non-zero Bold and ETHGain in the Stability Pool
      const BoldinSP = await stabilityPool.getTotalBoldDeposits();
      const ETHinSP = await stabilityPool.getCollBalance();
      assert.isTrue(BoldinSP.gt(mv._zeroBN));
      assert.isTrue(ETHinSP.gt(mv._zeroBN));

      // Price rises
      await priceFeed.setPrice(dec(200, 18));

      // Carol withdraws her Stability deposit
      assert.equal(
        (await stabilityPool.deposits(carol)).toString(),
        dec(30000, 18),
      );
      await th.withdrawFromSPAndClaim(contracts, dec(30000, 18), { from: carol });
      assert.equal((await stabilityPool.deposits(carol)).toString(), "0");

      const alice_BoldDeposit_After = (
        await stabilityPool.getCompoundedBoldDeposit(alice)
      ).toString();
      const bob_BoldDeposit_After = (
        await stabilityPool.getCompoundedBoldDeposit(bob)
      ).toString();

      const alice_ETHGain_After = (
        await stabilityPool.getDepositorCollGain(alice)
      ).toString();
      const bob_ETHGain_After = (
        await stabilityPool.getDepositorCollGain(bob)
      ).toString();

      // Check compounded deposits and ETH gains for A and B have not changed
      assert.equal(alice_BoldDeposit_Before, alice_BoldDeposit_After);
      assert.equal(bob_BoldDeposit_Before, bob_BoldDeposit_After);

      assert.equal(alice_ETHGain_Before, alice_ETHGain_After);
      assert.equal(bob_ETHGain_Before, bob_ETHGain_After);
    });

    it("withdrawFromSP(): doesn't impact system debt, collateral or TCR ", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(100000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale },
      });

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(30000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: carol },
      });

      await th.provideToSPAndClaim(contracts, dec(10000, 18), {
        from: alice,
      });
      await th.provideToSPAndClaim(contracts, dec(20000, 18), {
        from: bob,
      });
      await th.provideToSPAndClaim(contracts, dec(30000, 18), {
        from: carol,
      });

      // Would-be defaulters open troves
      const { troveId: defaulter_1_TroveId } = await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_1 },
      });
      const { troveId: defaulter_2_TroveId } = await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_2 },
      });

      // Price drops
      await priceFeed.setPrice(dec(105, 18));

      // Defaulters are liquidated
      await troveManager.liquidate(defaulter_1_TroveId);
      await troveManager.liquidate(defaulter_2_TroveId);
      assert.isFalse(await sortedTroves.contains(defaulter_1_TroveId));
      assert.isFalse(await sortedTroves.contains(defaulter_2_TroveId));

      // Price rises
      await priceFeed.setPrice(dec(200, 18));

      const activeDebt_Before = (await activePool.getBoldDebt()).toString();
      const defaultedDebt_Before = (await defaultPool.getBoldDebt()).toString();
      const activeColl_Before = (await activePool.getCollBalance()).toString();
      const defaultedColl_Before = (await defaultPool.getCollBalance()).toString();
      const TCR_Before = (await th.getTCR(contracts)).toString();

      // Carol withdraws her Stability deposit
      assert.equal(
        (await stabilityPool.deposits(carol)).toString(),
        dec(30000, 18),
      );
      await th.withdrawFromSPAndClaim(contracts, dec(30000, 18), { from: carol });
      assert.equal((await stabilityPool.deposits(carol)).toString(), "0");

      const activeDebt_After = (await activePool.getBoldDebt()).toString();
      const defaultedDebt_After = (await defaultPool.getBoldDebt()).toString();
      const activeColl_After = (await activePool.getCollBalance()).toString();
      const defaultedColl_After = (await defaultPool.getCollBalance()).toString();
      const TCR_After = (await th.getTCR(contracts)).toString();

      // Check total system debt, collateral and TCR have not changed after a Stability deposit is made
      assert.equal(activeDebt_Before, activeDebt_After);
      assert.equal(defaultedDebt_Before, defaultedDebt_After);
      assert.equal(activeColl_Before, activeColl_After);
      assert.equal(defaultedColl_Before, defaultedColl_After);
      assert.equal(TCR_Before, TCR_After);
    });

    it("withdrawFromSP(): doesn't impact any troves, including the caller's trove", async () => {
      const { troveId: whaleTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(100000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale },
      });

      // A, B, C open troves and make Stability Pool deposits
      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });
      const { troveId: bobTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob },
      });
      const { troveId: carolTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(30000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: carol },
      });

      // A, B and C provide to SP
      await th.provideToSPAndClaim(contracts, dec(10000, 18), {
        from: alice,
      });
      await th.provideToSPAndClaim(contracts, dec(20000, 18), {
        from: bob,
      });
      await th.provideToSPAndClaim(contracts, dec(30000, 18), {
        from: carol,
      });

      // Price drops
      await priceFeed.setPrice(dec(105, 18));
      const price = await priceFeed.getPrice();

      // Get debt, collateral and ICR of all existing troves
      const whale_Debt_Before = (
        await troveManager.Troves(whaleTroveId)
      )[0].toString();
      const alice_Debt_Before = (
        await troveManager.Troves(aliceTroveId)
      )[0].toString();
      const bob_Debt_Before = (await troveManager.Troves(bobTroveId))[0].toString();
      const carol_Debt_Before = (
        await troveManager.Troves(carolTroveId)
      )[0].toString();

      const whale_Coll_Before = (
        await troveManager.Troves(whaleTroveId)
      )[1].toString();
      const alice_Coll_Before = (
        await troveManager.Troves(aliceTroveId)
      )[1].toString();
      const bob_Coll_Before = (await troveManager.Troves(bobTroveId))[1].toString();
      const carol_Coll_Before = (
        await troveManager.Troves(carolTroveId)
      )[1].toString();

      const whale_ICR_Before = (
        await troveManager.getCurrentICR(whale, price)
      ).toString();
      const alice_ICR_Before = (
        await troveManager.getCurrentICR(alice, price)
      ).toString();
      const bob_ICR_Before = (
        await troveManager.getCurrentICR(bob, price)
      ).toString();
      const carol_ICR_Before = (
        await troveManager.getCurrentICR(carol, price)
      ).toString();

      // price rises
      await priceFeed.setPrice(dec(200, 18));

      // Carol withdraws her Stability deposit
      assert.equal(
        (await stabilityPool.deposits(carol)).toString(),
        dec(30000, 18),
      );
      await th.withdrawFromSPAndClaim(contracts, dec(30000, 18), { from: carol });
      assert.equal((await stabilityPool.deposits(carol)).toString(), "0");

      const whale_Debt_After = (await troveManager.Troves(whaleTroveId))[0].toString();
      const alice_Debt_After = (await troveManager.Troves(aliceTroveId))[0].toString();
      const bob_Debt_After = (await troveManager.Troves(bobTroveId))[0].toString();
      const carol_Debt_After = (await troveManager.Troves(carolTroveId))[0].toString();

      const whale_Coll_After = (await troveManager.Troves(whaleTroveId))[1].toString();
      const alice_Coll_After = (await troveManager.Troves(aliceTroveId))[1].toString();
      const bob_Coll_After = (await troveManager.Troves(bobTroveId))[1].toString();
      const carol_Coll_After = (await troveManager.Troves(carolTroveId))[1].toString();

      const whale_ICR_After = (
        await troveManager.getCurrentICR(whale, price)
      ).toString();
      const alice_ICR_After = (
        await troveManager.getCurrentICR(alice, price)
      ).toString();
      const bob_ICR_After = (
        await troveManager.getCurrentICR(bob, price)
      ).toString();
      const carol_ICR_After = (
        await troveManager.getCurrentICR(carol, price)
      ).toString();

      // Check all troves are unaffected by Carol's Stability deposit withdrawal
      assert.equal(whale_Debt_Before, whale_Debt_After);
      assert.equal(alice_Debt_Before, alice_Debt_After);
      assert.equal(bob_Debt_Before, bob_Debt_After);
      assert.equal(carol_Debt_Before, carol_Debt_After);

      assert.equal(whale_Coll_Before, whale_Coll_After);
      assert.equal(alice_Coll_Before, alice_Coll_After);
      assert.equal(bob_Coll_Before, bob_Coll_After);
      assert.equal(carol_Coll_Before, carol_Coll_After);

      assert.equal(whale_ICR_Before, whale_ICR_After);
      assert.equal(alice_ICR_Before, alice_ICR_After);
      assert.equal(bob_ICR_Before, bob_ICR_After);
      assert.equal(carol_ICR_Before, carol_ICR_After);
    });

    it("withdrawFromSP(): succeeds when amount is 0 and system has an undercollateralized trove", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(100, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: A },
      });

      await th.provideToSPAndClaim(contracts, dec(100, 18), { from: A });

      const A_initialDeposit = (await stabilityPool.deposits(A)).toString();
      assert.equal(A_initialDeposit, dec(100, 18));

      // defaulters opens trove
      const { troveId: defaulter_1_TroveId } = await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_1 },
      });
      const { troveId: defaulter_2_TroveId } = await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_2 },
      });

      // ETH drops, defaulters are in liquidation range
      await priceFeed.setPrice(dec(105, 18));
      const price = await priceFeed.getPrice();
      assert.isTrue(
        await th.ICRbetween100and110(defaulter_1_TroveId, troveManager, price),
      );

      await time.increase(timeValues.MINUTES_IN_ONE_WEEK);

      // Liquidate d1
      await troveManager.liquidate(defaulter_1_TroveId);
      assert.isFalse(await sortedTroves.contains(defaulter_1_TroveId));

      // Check d2 is undercollateralized
      assert.isTrue(
        await th.ICRbetween100and110(defaulter_2_TroveId, troveManager, price),
      );
      assert.isTrue(await sortedTroves.contains(defaulter_2_TroveId));

      const A_ETHBalBefore = toBN(await contracts.WETH.balanceOf(A));

      // Check Alice has gains to withdraw
      const A_pendingETHGain = await stabilityPool.getDepositorCollGain(A);
      assert.isTrue(A_pendingETHGain.gt(toBN("0")));

      // Check withdrawal of 0 succeeds
      const tx = await th.withdrawFromSPAndClaim(contracts, 0, {
        from: A,
        gasPrice: GAS_PRICE,
      });
      assert.isTrue(tx.receipt.status);

      const A_ETHBalAfter = toBN(await contracts.WETH.balanceOf(A));

      // Check A's ETH balance has increased correctly
      assert.isTrue(A_ETHBalAfter.sub(A_ETHBalBefore).eq(A_pendingETHGain));
    });

    it("withdrawFromSP(): withdrawing 0 Bold doesn't alter the caller's deposit or the total Bold in the Stability Pool", async () => {
      // --- SETUP ---
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale },
      });

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(30000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: carol },
      });

      // A, B, C provides 100, 50, 30 Bold to SP
      await th.provideToSPAndClaim(contracts, dec(100, 18), {
        from: alice,
      });
      await th.provideToSPAndClaim(contracts, dec(50, 18), { from: bob });
      await th.provideToSPAndClaim(contracts, dec(30, 18), { from: carol });

      const bob_Deposit_Before = (
        await stabilityPool.getCompoundedBoldDeposit(bob)
      ).toString();
      const BoldinSP_Before = (
        await stabilityPool.getTotalBoldDeposits()
      ).toString();

      assert.equal(BoldinSP_Before, dec(180, 18));

      // Bob withdraws 0 Bold from the Stability Pool
      await th.withdrawFromSPAndClaim(contracts, 0, { from: bob });

      // check Bob's deposit and total Bold in Stability Pool has not changed
      const bob_Deposit_After = (
        await stabilityPool.getCompoundedBoldDeposit(bob)
      ).toString();
      const BoldinSP_After = (
        await stabilityPool.getTotalBoldDeposits()
      ).toString();

      assert.equal(bob_Deposit_Before, bob_Deposit_After);
      assert.equal(BoldinSP_Before, BoldinSP_After);
    });

    it("withdrawFromSP(): withdrawing 0 ETH Gain does not alter the caller's ETH balance, their trove collateral, or the ETH  in the Stability Pool", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale },
      });

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(30000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: carol },
      });

      // Would-be defaulter open trove
      const { troveId: defaulter_1_TroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_1 },
      });

      // Price drops
      await priceFeed.setPrice(dec(105, 18));

      assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

      // Defaulter 1 liquidated, full offset
      await troveManager.liquidate(defaulter_1_TroveId);

      // Dennis opens trove and deposits to Stability Pool
      const { troveId: dennisTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: dennis },
      });
      await th.provideToSPAndClaim(contracts, dec(100, 18), {
        from: dennis,
      });

      // Check Dennis has 0 ETHGain
      const dennis_ETHGain = (
        await stabilityPool.getDepositorCollGain(dennis)
      ).toString();
      assert.equal(dennis_ETHGain, "0");

      const dennis_ETHBalance_Before = contracts.WETH.balanceOf(dennis).toString();
      const dennis_Collateral_Before = (
        await troveManager.Troves(dennisTroveId)
      )[1].toString();
      const ETHinSP_Before = (await stabilityPool.getCollBalance()).toString();

      await priceFeed.setPrice(dec(200, 18));

      // Dennis withdraws his full deposit and ETHGain to his account
      await th.withdrawFromSPAndClaim(contracts, dec(100, 18), {
        from: dennis,
        gasPrice: GAS_PRICE,
      });

      // Check withdrawal does not alter Dennis' ETH balance or his trove's collateral
      const dennis_ETHBalance_After = contracts.WETH.balanceOf(dennis).toString();
      const dennis_Collateral_After = (
        await troveManager.Troves(dennisTroveId)
      )[1].toString();
      const ETHinSP_After = (await stabilityPool.getCollBalance()).toString();

      assert.equal(dennis_ETHBalance_Before, dennis_ETHBalance_After);
      assert.equal(dennis_Collateral_Before, dennis_Collateral_After);

      // Check withdrawal has not altered the ETH in the Stability Pool
      assert.equal(ETHinSP_Before, ETHinSP_After);
    });

    it("withdrawFromSP(): Request to withdraw > caller's deposit only withdraws the caller's compounded deposit", async () => {
      // --- SETUP ---
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale },
      });

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(30000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: carol },
      });

      const { troveId: defaulter_1_TroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_1 },
      });

      // A, B, C provide Bold to SP
      await th.provideToSPAndClaim(contracts, dec(10000, 18), {
        from: alice,
      });
      await th.provideToSPAndClaim(contracts, dec(20000, 18), {
        from: bob,
      });
      await th.provideToSPAndClaim(contracts, dec(30000, 18), {
        from: carol,
      });

      // Price drops
      await priceFeed.setPrice(dec(105, 18));

      // Liquidate defaulter 1
      await troveManager.liquidate(defaulter_1_TroveId);

      const alice_Bold_Balance_Before = await boldToken.balanceOf(alice);
      const bob_Bold_Balance_Before = await boldToken.balanceOf(bob);

      const alice_Deposit_Before = await stabilityPool.getCompoundedBoldDeposit(
        alice,
      );
      const bob_Deposit_Before = await stabilityPool.getCompoundedBoldDeposit(
        bob,
      );

      const BoldinSP_Before = await stabilityPool.getTotalBoldDeposits();

      await priceFeed.setPrice(dec(200, 18));

      // Bob attempts to withdraws 1 wei more than his compounded deposit from the Stability Pool
      await th.withdrawFromSPAndClaim(contracts, bob_Deposit_Before.add(toBN(1)), {
        from: bob,
      });

      // Check Bob's Bold balance has risen by only the value of his compounded deposit
      const bob_expectedBoldBalance = bob_Bold_Balance_Before
        .add(bob_Deposit_Before)
        .toString();
      const bob_Bold_Balance_After = (
        await boldToken.balanceOf(bob)
      ).toString();
      assert.equal(bob_Bold_Balance_After, bob_expectedBoldBalance);

      // Alice attempts to withdraws 2309842309.000000000000000000 Bold from the Stability Pool
      await th.withdrawFromSPAndClaim(contracts, "2309842309000000000000000000", {
        from: alice,
      });

      // Check Alice's Bold balance has risen by only the value of her compounded deposit
      const alice_expectedBoldBalance = alice_Bold_Balance_Before
        .add(alice_Deposit_Before)
        .toString();
      const alice_Bold_Balance_After = (
        await boldToken.balanceOf(alice)
      ).toString();
      assert.equal(alice_Bold_Balance_After, alice_expectedBoldBalance);

      // Check Bold in Stability Pool has been reduced by only Alice's compounded deposit and Bob's compounded deposit
      const expectedBoldinSP = BoldinSP_Before.sub(alice_Deposit_Before)
        .sub(bob_Deposit_Before)
        .toString();
      const BoldinSP_After = (
        await stabilityPool.getTotalBoldDeposits()
      ).toString();
      assert.equal(BoldinSP_After, expectedBoldinSP);
    });

    it("withdrawFromSP(): Request to withdraw 2^256-1 Bold only withdraws the caller's compounded deposit", async () => {
      // --- SETUP ---
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale },
      });

      // A, B, C open troves
      // A, B, C open troves
      // A, B, C open troves
      // A, B, C open troves
      // A, B, C open troves
      // A, B, C open troves
      // A, B, C open troves
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(30000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: carol },
      });

      const { troveId: defaulter_1_TroveId } = await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_1 },
      });

      // A, B, C provides 100, 50, 30 Bold to SP
      await th.provideToSPAndClaim(contracts, dec(100, 18), {
        from: alice,
      });
      await th.provideToSPAndClaim(contracts, dec(50, 18), { from: bob });
      await th.provideToSPAndClaim(contracts, dec(30, 18), { from: carol });

      // Price drops
      await priceFeed.setPrice(dec(100, 18));

      // Liquidate defaulter 1
      await troveManager.liquidate(defaulter_1_TroveId);

      const bob_Bold_Balance_Before = await boldToken.balanceOf(bob);

      const bob_Deposit_Before = await stabilityPool.getCompoundedBoldDeposit(
        bob,
      );

      const BoldinSP_Before = await stabilityPool.getTotalBoldDeposits();

      // Price drops
      await priceFeed.setPrice(dec(200, 18));

      // Bob attempts to withdraws 2^256 - 1 Bold from the Stability Pool
      await th.withdrawFromSPAndClaim(contracts, th.MAX_UINT256, { from: bob });

      // Check Bob's Bold balance has risen by only the value of his compounded deposit
      const bob_expectedBoldBalance = bob_Bold_Balance_Before
        .add(bob_Deposit_Before)
        .toString();
      const bob_Bold_Balance_After = (
        await boldToken.balanceOf(bob)
      ).toString();
      assert.equal(bob_Bold_Balance_After, bob_expectedBoldBalance);

      // Check Bold in Stability Pool has been reduced by only  Bob's compounded deposit
      const expectedBoldinSP = BoldinSP_Before.sub(bob_Deposit_Before).toString();
      const BoldinSP_After = (
        await stabilityPool.getTotalBoldDeposits()
      ).toString();
      assert.equal(BoldinSP_After, expectedBoldinSP);
    });

    it("withdrawFromSP(): caller can withdraw full deposit and ETH gain while below CT", async () => {
      // --- SETUP ---

      // Price doubles
      await priceFeed.setPrice(dec(400, 18));
      await openTrove({
        extraBoldAmount: toBN(dec(1000000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: whale },
      });

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(4, 18)),
        extraParams: { from: alice },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(4, 18)),
        extraParams: { from: bob },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(30000, 18)),
        ICR: toBN(dec(4, 18)),
        extraParams: { from: carol },
      });

      const defaulter_1_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(10000, 18)),
        defaulter_1,
        defaulter_1,
        0,
        { from: defaulter_1, value: dec(100, "ether") },
      );

      // Price halves
      await priceFeed.setPrice(dec(200, 18));

      // A, B, C provides 10000, 5000, 3000 Bold to SP
      const A_GAS_Used = th.gasUsed(
        await th.provideToSPAndClaim(contracts, dec(10000, 18), {
          from: alice,
          gasPrice: GAS_PRICE,
        }),
      );
      const B_GAS_Used = th.gasUsed(
        await th.provideToSPAndClaim(contracts, dec(5000, 18), {
          from: bob,
          gasPrice: GAS_PRICE,
        }),
      );
      const C_GAS_Used = th.gasUsed(
        await th.provideToSPAndClaim(contracts, dec(3000, 18), {
          from: carol,
          gasPrice: GAS_PRICE,
        }),
      );

      // Price drops
      await priceFeed.setPrice(dec(105, 18));
      const price = await priceFeed.getPrice();

      assert.isTrue(await th.checkBelowCriticalThreshold(contracts));

      // Liquidate defaulter 1
      await troveManager.liquidate(defaulter_1_TroveId);
      assert.isFalse(await sortedTroves.contains(defaulter_1_TroveId));

      const alice_Bold_Balance_Before = await boldToken.balanceOf(alice);
      const bob_Bold_Balance_Before = await boldToken.balanceOf(bob);
      const carol_Bold_Balance_Before = await boldToken.balanceOf(carol);

      const alice_ETH_Balance_Before = web3.utils.toBN(
        await contracts.WETH.balanceOf(alice),
      );
      const bob_ETH_Balance_Before = web3.utils.toBN(
        await contracts.WETH.balanceOf(bob),
      );
      const carol_ETH_Balance_Before = web3.utils.toBN(
        await contracts.WETH.balanceOf(carol),
      );

      const alice_Deposit_Before = await stabilityPool.getCompoundedBoldDeposit(
        alice,
      );
      const bob_Deposit_Before = await stabilityPool.getCompoundedBoldDeposit(
        bob,
      );
      const carol_Deposit_Before = await stabilityPool.getCompoundedBoldDeposit(
        carol,
      );

      const alice_ETHGain_Before = await stabilityPool.getDepositorCollGain(
        alice,
      );
      const bob_ETHGain_Before = await stabilityPool.getDepositorCollGain(bob);
      const carol_ETHGain_Before = await stabilityPool.getDepositorCollGain(
        carol,
      );

      const BoldinSP_Before = await stabilityPool.getTotalBoldDeposits();

      // Price rises
      await priceFeed.setPrice(dec(220, 18));

      assert.isTrue(await th.checkBelowCriticalThreshold(contracts));

      // A, B, C withdraw their full deposits from the Stability Pool
      const A_GAS_Deposit = th.gasUsed(
        await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), {
          from: alice,
          gasPrice: GAS_PRICE,
        }),
      );
      const B_GAS_Deposit = th.gasUsed(
        await th.withdrawFromSPAndClaim(contracts, dec(5000, 18), {
          from: bob,
          gasPrice: GAS_PRICE,
        }),
      );
      const C_GAS_Deposit = th.gasUsed(
        await th.withdrawFromSPAndClaim(contracts, dec(3000, 18), {
          from: carol,
          gasPrice: GAS_PRICE,
        }),
      );

      // Check Bold balances of A, B, C have risen by the value of their compounded deposits, respectively
      const alice_expectedBoldBalance = alice_Bold_Balance_Before
        .add(alice_Deposit_Before)
        .toString();

      const bob_expectedBoldBalance = bob_Bold_Balance_Before
        .add(bob_Deposit_Before)
        .toString();
      const carol_expectedBoldBalance = carol_Bold_Balance_Before
        .add(carol_Deposit_Before)
        .toString();

      const alice_Bold_Balance_After = (
        await boldToken.balanceOf(alice)
      ).toString();

      const bob_Bold_Balance_After = (
        await boldToken.balanceOf(bob)
      ).toString();
      const carol_Bold_Balance_After = (
        await boldToken.balanceOf(carol)
      ).toString();

      assert.equal(alice_Bold_Balance_After, alice_expectedBoldBalance);
      assert.equal(bob_Bold_Balance_After, bob_expectedBoldBalance);
      assert.equal(carol_Bold_Balance_After, carol_expectedBoldBalance);

      // Check ETH balances of A, B, C have increased by the value of their ETH gain from liquidations, respectively
      const alice_expectedETHBalance = alice_ETH_Balance_Before
        .add(alice_ETHGain_Before)
        .toString();
      const bob_expectedETHBalance = bob_ETH_Balance_Before
        .add(bob_ETHGain_Before)
        .toString();
      const carol_expectedETHBalance = carol_ETH_Balance_Before
        .add(carol_ETHGain_Before)
        .toString();

      const alice_ETHBalance_After = (
        await contracts.WETH.balanceOf(alice)
      ).toString();
      const bob_ETHBalance_After = (await contracts.WETH.balanceOf(bob)).toString();
      const carol_ETHBalance_After = (
        await contracts.WETH.balanceOf(carol)
      ).toString();

      // ETH balances before minus gas used
      const alice_ETHBalance_After_Gas = alice_ETHBalance_After - A_GAS_Used;
      const bob_ETHBalance_After_Gas = bob_ETHBalance_After - B_GAS_Used;
      const carol_ETHBalance_After_Gas = carol_ETHBalance_After - C_GAS_Used;

      assert.equal(alice_expectedETHBalance, alice_ETHBalance_After_Gas);
      assert.equal(bob_expectedETHBalance, bob_ETHBalance_After_Gas);
      assert.equal(carol_expectedETHBalance, carol_ETHBalance_After_Gas);

      // Check Bold in Stability Pool has been reduced by A, B and C's compounded deposit
      const expectedBoldinSP = BoldinSP_Before.sub(alice_Deposit_Before)
        .sub(bob_Deposit_Before)
        .sub(carol_Deposit_Before)
        .toString();
      const BoldinSP_After = (
        await stabilityPool.getTotalBoldDeposits()
      ).toString();
      assert.equal(BoldinSP_After, expectedBoldinSP);

      // Check ETH in SP has reduced to zero
      const ETHinSP_After = (await stabilityPool.getCollBalance()).toString();
      assert.isAtMost(th.getDifference(ETHinSP_After, "0"), 100000);
    });

    it("getDepositorCollGain(): depositor does not earn further ETH gains from liquidations while their compounded deposit == 0: ", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(1, 24)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale },
      });

      // A, B, C open troves
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(30000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: carol },
      });

      // defaulters open troves
      const { troveId: defaulter_1_TroveId } = await openTrove({
        extraBoldAmount: toBN(dec(15000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_1 },
      });
      const { troveId: defaulter_2_TroveId } = await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_2 },
      });
      const { troveId: defaulter_3_TroveId } = await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_3 },
      });

      // A, B, provide 10000, 5000 Bold to SP
      await th.provideToSPAndClaim(contracts, dec(10000, 18), {
        from: alice,
      });
      await th.provideToSPAndClaim(contracts, dec(5000, 18), { from: bob });

      // price drops
      await priceFeed.setPrice(dec(105, 18));

      // Liquidate defaulter 1. Empties the Pool
      await troveManager.liquidate(defaulter_1_TroveId);
      assert.isFalse(await sortedTroves.contains(defaulter_1_TroveId));

      const BoldinSP = (await stabilityPool.getTotalBoldDeposits()).toString();
      assert.equal(BoldinSP, "0");

      // Check Stability deposits have been fully cancelled with debt, and are now all zero
      const alice_Deposit = (
        await stabilityPool.getCompoundedBoldDeposit(alice)
      ).toString();
      const bob_Deposit = (
        await stabilityPool.getCompoundedBoldDeposit(bob)
      ).toString();

      assert.equal(alice_Deposit, "0");
      assert.equal(bob_Deposit, "0");

      // Get ETH gain for A and B
      const alice_ETHGain_1 = (
        await stabilityPool.getDepositorCollGain(alice)
      ).toString();
      const bob_ETHGain_1 = (
        await stabilityPool.getDepositorCollGain(bob)
      ).toString();

      // Whale deposits 10000 Bold to Stability Pool
      await th.provideToSPAndClaim(contracts, dec(1, 24), { from: whale });

      // Liquidation 2
      await troveManager.liquidate(defaulter_2_TroveId);
      assert.isFalse(await sortedTroves.contains(defaulter_2_TroveId));

      // Check Alice and Bob have not received ETH gain from liquidation 2 while their deposit was 0
      const alice_ETHGain_2 = (
        await stabilityPool.getDepositorCollGain(alice)
      ).toString();
      const bob_ETHGain_2 = (
        await stabilityPool.getDepositorCollGain(bob)
      ).toString();

      assert.equal(alice_ETHGain_1, alice_ETHGain_2);
      assert.equal(bob_ETHGain_1, bob_ETHGain_2);

      // Liquidation 3
      await troveManager.liquidate(defaulter_3_TroveId);
      assert.isFalse(await sortedTroves.contains(defaulter_3_TroveId));

      // Check Alice and Bob have not received ETH gain from liquidation 3 while their deposit was 0
      const alice_ETHGain_3 = (
        await stabilityPool.getDepositorCollGain(alice)
      ).toString();
      const bob_ETHGain_3 = (
        await stabilityPool.getDepositorCollGain(bob)
      ).toString();

      assert.equal(alice_ETHGain_1, alice_ETHGain_3);
      assert.equal(bob_ETHGain_1, bob_ETHGain_3);
    });

    it("withdrawFromSP(), full withdrawal: zero's depositor's snapshots", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(1000000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale },
      });

      const { troveId: defaulter_1_TroveId } = await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_1 },
      });

      //  SETUP: Execute a series of operations to make G, S > 0 and P < 1

      // E opens trove and makes a deposit
      await openTrove({
        extraBoldAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: E },
      });
      await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: E });

      // Fast-forward time and make a second deposit
      await time.increase(timeValues.SECONDS_IN_ONE_HOUR);
      await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: E });

      // perform a liquidation to make 0 < P < 1, and S > 0
      await priceFeed.setPrice(dec(105, 18));
      assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

      await troveManager.liquidate(defaulter_1_TroveId);

      const currentEpoch = await stabilityPool.currentEpoch();
      const currentScale = await stabilityPool.currentScale();

      const S_Before = await stabilityPool.epochToScaleToS(
        currentEpoch,
        currentScale,
      );
      const P_Before = await stabilityPool.P();

      // Confirm 0 < P < 1
      assert.isTrue(P_Before.gt(toBN("0")) && P_Before.lt(toBN(dec(1, 18))));
      // Confirm S, G are both > 0
      assert.isTrue(S_Before.gt(toBN("0")));

      // --- TEST ---

      // Whale transfers to A, B
      await boldToken.transfer(A, dec(10000, 18), { from: whale });
      await boldToken.transfer(B, dec(20000, 18), { from: whale });

      await priceFeed.setPrice(dec(200, 18));

      // C, D open troves
      await openTrove({
        extraBoldAmount: toBN(dec(30000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: C },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(40000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: D },
      });

      // A, B, C, D make their initial deposits
      await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: A });
      await th.provideToSPAndClaim(contracts, dec(20000, 18), {
        from: B,
      });
      await th.provideToSPAndClaim(contracts, dec(30000, 18), { from: C });
      await th.provideToSPAndClaim(contracts, dec(40000, 18), {
        from: D,
      });

      // Check deposits snapshots are non-zero

      for (depositor of [A, B, C, D]) {
        const snapshot = await stabilityPool.depositSnapshots(depositor);

        const ZERO = toBN("0");
        // Check S,P, G snapshots are non-zero
        assert.isTrue(snapshot[0].eq(S_Before)); // S
        assert.isTrue(snapshot[1].eq(P_Before)); // P
        assert.equal(snapshot[3], "0"); // scale
        assert.equal(snapshot[4], "0"); // epoch
      }

      // All depositors make full withdrawal
      await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: A });
      await th.withdrawFromSPAndClaim(contracts, dec(20000, 18), { from: B });
      await th.withdrawFromSPAndClaim(contracts, dec(30000, 18), { from: C });
      await th.withdrawFromSPAndClaim(contracts, dec(40000, 18), { from: D });

      // Check all depositors' snapshots have been zero'd
      for (depositor of [A, B, C, D]) {
        const snapshot = await stabilityPool.depositSnapshots(depositor);

        // Check S, P, G snapshots are now zero
        assert.equal(snapshot[0], "0"); // S
        assert.equal(snapshot[1], "0"); // P
        assert.equal(snapshot[2], "0"); // G
        assert.equal(snapshot[3], "0"); // scale
        assert.equal(snapshot[4], "0"); // epoch
      }
    });

    it("withdrawFromSP(), reverts when initial deposit value is 0", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(100000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale },
      });

      // A opens trove and join the Stability Pool
      await openTrove({
        extraBoldAmount: toBN(dec(10100, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: A },
      });
      await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: A });

      const { troveId: defaulter_1_TroveId } = await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_1 },
      });

      //  SETUP: Execute a series of operations to trigger ETH rewards for depositor A

      // Fast-forward time and make a second deposit
      await time.increase(timeValues.SECONDS_IN_ONE_HOUR);
      await th.provideToSPAndClaim(contracts, dec(100, 18), { from: A });

      // perform a liquidation to make 0 < P < 1, and S > 0
      await priceFeed.setPrice(dec(105, 18));
      assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

      await troveManager.liquidate(defaulter_1_TroveId);
      assert.isFalse(await sortedTroves.contains(defaulter_1_TroveId));

      await priceFeed.setPrice(dec(200, 18));

      // A successfully withraws deposit and all gains
      await th.withdrawFromSPAndClaim(contracts, dec(10100, 18), { from: A });

      // Confirm A's recorded deposit is 0
      const A_deposit = await stabilityPool.deposits(A); // get initialValue property on deposit struct
      assert.equal(A_deposit, "0");

      // --- TEST ---
      const expectedRevertMessage = "StabilityPool: User must have a non-zero deposit";

      // Further withdrawal attempt from A
      const withdrawalPromise_A = stabilityPool.withdrawFromSP(dec(10000, 18), {
        from: A,
      });
      await th.assertRevert(withdrawalPromise_A, expectedRevertMessage);

      // Withdrawal attempt of a non-existent deposit, from C
      const withdrawalPromise_C = stabilityPool.withdrawFromSP(dec(10000, 18), {
        from: C,
      });
      await th.assertRevert(withdrawalPromise_C, expectedRevertMessage);
    });
  });
});

contract("Reset chain state", async (accounts) => {});
