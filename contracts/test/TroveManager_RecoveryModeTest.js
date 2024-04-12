const { time } = require("@nomicfoundation/hardhat-network-helpers");
const {
  MoneyValues: mv,
  TestHelper: th,
  TimeValues: timeValues,
} = require("../utils/testHelpers.js");
const { createDeployAndFundFixture } = require("../utils/testFixtures.js");

const { assertRevert, dec, toBN } = th;

const TroveManagerTester = artifacts.require("./TroveManagerTester");

contract.skip("TroveManager - in Recovery Mode", async (accounts) => {
  const fundedAccounts = accounts.slice(0, 24);

  const _1_Ether = web3.utils.toWei("1", "ether");
  const _2_Ether = web3.utils.toWei("2", "ether");
  const _3_Ether = web3.utils.toWei("3", "ether");
  const _3pt5_Ether = web3.utils.toWei("3.5", "ether");
  const _6_Ether = web3.utils.toWei("6", "ether");
  const _10_Ether = web3.utils.toWei("10", "ether");
  const _20_Ether = web3.utils.toWei("20", "ether");
  const _21_Ether = web3.utils.toWei("21", "ether");
  const _22_Ether = web3.utils.toWei("22", "ether");
  const _24_Ether = web3.utils.toWei("24", "ether");
  const _25_Ether = web3.utils.toWei("25", "ether");
  const _30_Ether = web3.utils.toWei("30", "ether");

  const [
    owner,
    alice,
    bob,
    carol,
    dennis,
    erin,
    freddy,
    greta,
    harry,
    ida,
    whale,
    defaulter_1,
    defaulter_2,
    defaulter_3,
    defaulter_4,
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H,
    I,
  ] = fundedAccounts;

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000);

  let priceFeed;
  let boldToken;
  let sortedTroves;
  let troveManager;
  let activePool;
  let stabilityPool;
  let defaultPool;
  let functionCaller;
  let borrowerOperations;
  let collSurplusPool;

  let contracts;

  const getOpenTroveBoldAmount = async (totalDebt) => th.getOpenTroveBoldAmount(contracts, totalDebt);
  const getNetBorrowingAmount = async (debtWithFee) => th.getNetBorrowingAmount(contracts, debtWithFee);
  const openTrove = async (params) => th.openTrove(contracts, params);

  const deployFixture = createDeployAndFundFixture({
    accounts: fundedAccounts,
    mocks: { TroveManager: TroveManagerTester },
  });

  beforeEach(async () => {
    const result = await deployFixture();
    contracts = result.contracts;
    priceFeed = contracts.priceFeedTestnet;
    boldToken = contracts.boldToken;
    sortedTroves = contracts.sortedTroves;
    troveManager = contracts.troveManager;
    activePool = contracts.activePool;
    stabilityPool = contracts.stabilityPool;
    defaultPool = contracts.defaultPool;
    functionCaller = contracts.functionCaller;
    borrowerOperations = contracts.borrowerOperations;
    collSurplusPool = contracts.collSurplusPool;
  });

  it("checkRecoveryMode(): Returns true if TCR falls below CCR", async () => {
    // --- SETUP ---
    //  Alice and Bob withdraw such that the TCR is ~150%
    await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } });
    await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: bob } });

    const TCR = (await th.getTCR(contracts)).toString();
    assert.equal(TCR, dec(15, 17));

    const recoveryMode_Before = await th.checkRecoveryMode(contracts);
    assert.isFalse(recoveryMode_Before);

    // --- TEST ---

    // price drops to 1ETH:150Bold, reducing TCR below 150%.  setPrice() calls checkTCRAndSetRecoveryMode() internally.
    await priceFeed.setPrice(dec(15, 17));

    // const price = await priceFeed.getPrice()
    // await troveManager.checkTCRAndSetRecoveryMode(price)

    const recoveryMode_After = await th.checkRecoveryMode(contracts);
    assert.isTrue(recoveryMode_After);
  });

  it("checkRecoveryMode(): Returns true if TCR stays less than CCR", async () => {
    // --- SETUP ---
    await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } });
    await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: bob } });

    const TCR = (await th.getTCR(contracts)).toString();
    assert.equal(TCR, "1500000000000000000");

    // --- TEST ---

    // price drops to 1ETH:150Bold, reducing TCR below 150%
    await priceFeed.setPrice("150000000000000000000");

    const recoveryMode_Before = await th.checkRecoveryMode(contracts);
    assert.isTrue(recoveryMode_Before);

    await th.addCollWrapper(contracts, { from: alice, value: "1" });

    const recoveryMode_After = await th.checkRecoveryMode(contracts);
    assert.isTrue(recoveryMode_After);
  });

  it("checkRecoveryMode(): returns false if TCR stays above CCR", async () => {
    // --- SETUP ---
    await openTrove({ ICR: toBN(dec(450, 16)), extraParams: { from: alice } });
    await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: bob } });

    // --- TEST ---
    const recoveryMode_Before = await th.checkRecoveryMode(contracts);
    assert.isFalse(recoveryMode_Before);

    await borrowerOperations.withdrawColl(_1_Ether, {
      from: alice,
    });

    const recoveryMode_After = await th.checkRecoveryMode(contracts);
    assert.isFalse(recoveryMode_After);
  });

  it("checkRecoveryMode(): returns false if TCR rises above CCR", async () => {
    // --- SETUP ---
    const { collateral: A_coll } = await openTrove({
      ICR: toBN(dec(150, 16)),
      extraParams: { from: alice },
    });
    await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: bob } });

    const TCR = (await th.getTCR(contracts)).toString();
    assert.equal(TCR, "1500000000000000000");

    // --- TEST ---
    // price drops to 1ETH:150Bold, reducing TCR below 150%
    await priceFeed.setPrice("150000000000000000000");

    const recoveryMode_Before = await th.checkRecoveryMode(contracts);
    assert.isTrue(recoveryMode_Before);

    await th.addCollWrapper(contracts, {
      from: alice,
      value: A_coll,
    });

    const recoveryMode_After = await th.checkRecoveryMode(contracts);
    assert.isFalse(recoveryMode_After);
  });

  // --- liquidate() with ICR < 100% ---

  it("liquidate(), with ICR < 100%: removes stake and updates totalStakes", async () => {
    // --- SETUP ---
    //  Alice and Bob withdraw such that the TCR is ~150%
    const { collateral: A_coll } = await openTrove({
      ICR: toBN(dec(150, 16)),
      extraParams: { from: alice },
    });
    const { collateral: B_coll } = await openTrove({
      ICR: toBN(dec(150, 16)),
      extraBoldAmount: dec(2000, 18),
      extraParams: { from: bob },
    });

    const TCR = (await th.getTCR(contracts)).toString();
    assert.equal(TCR, "1500000000000000000");

    const bob_Stake_Before = (await troveManager.Troves(bob))[2];
    const totalStakes_Before = await troveManager.totalStakes();

    assert.equal(bob_Stake_Before.toString(), B_coll);
    assert.equal(totalStakes_Before.toString(), A_coll.add(B_coll));

    // --- TEST ---
    // price drops to 1ETH:100Bold, reducing TCR below 150%
    await priceFeed.setPrice("100000000000000000000");
    const price = await priceFeed.getPrice();

    const recoveryMode = await th.checkRecoveryMode(contracts);
    assert.isTrue(recoveryMode);

    // check Bob's ICR falls to 75%
    const bob_ICR = await troveManager.getCurrentICR(bob, price);
    assert.equal(bob_ICR, "750000000000000000");

    // Liquidate Bob
    await troveManager.liquidate(bob, { from: owner });

    const bob_Stake_After = (await troveManager.Troves(bob))[2];
    const totalStakes_After = await troveManager.totalStakes();

    assert.equal(bob_Stake_After, 0);
    assert.equal(totalStakes_After.toString(), A_coll);
  });

  it("liquidate(), with ICR < 100%: updates system snapshots correctly", async () => {
    // --- SETUP ---
    //  Alice, Bob and Dennis withdraw such that their ICRs and the TCR is ~150%
    const { collateral: A_coll } = await openTrove({
      ICR: toBN(dec(150, 16)),
      extraParams: { from: alice },
    });
    const { collateral: B_coll } = await openTrove({
      ICR: toBN(dec(150, 16)),
      extraParams: { from: bob },
    });
    const { collateral: D_coll } = await openTrove({
      ICR: toBN(dec(150, 16)),
      extraParams: { from: dennis },
    });

    const TCR = (await th.getTCR(contracts)).toString();
    assert.equal(TCR, "1500000000000000000");

    // --- TEST ---
    // price drops to 1ETH:100Bold, reducing TCR below 150%, and all Troves below 100% ICR
    await priceFeed.setPrice("100000000000000000000");

    const recoveryMode = await th.checkRecoveryMode(contracts);
    assert.isTrue(recoveryMode);

    // Dennis is liquidated
    await troveManager.liquidate(dennis, { from: owner });

    const totalStakesSnaphot_before = (
      await troveManager.totalStakesSnapshot()
    ).toString();
    const totalCollateralSnapshot_before = (
      await troveManager.totalCollateralSnapshot()
    ).toString();

    assert.equal(totalStakesSnaphot_before, A_coll.add(B_coll));
    assert.equal(
      totalCollateralSnapshot_before,
      A_coll.add(B_coll).add(th.applyLiquidationFee(D_coll)),
    ); // 6 + 3*0.995

    const A_reward = th
      .applyLiquidationFee(D_coll)
      .mul(A_coll)
      .div(A_coll.add(B_coll));
    const B_reward = th
      .applyLiquidationFee(D_coll)
      .mul(B_coll)
      .div(A_coll.add(B_coll));

    // Liquidate Bob
    await troveManager.liquidate(bob, { from: owner });

    const totalStakesSnaphot_After = await troveManager.totalStakesSnapshot();
    const totalCollateralSnapshot_After = await troveManager.totalCollateralSnapshot();

    assert.equal(totalStakesSnaphot_After.toString(), A_coll);
    // total collateral should always be 9 minus gas compensations, as all liquidations in this test case are full redistributions
    assert.isAtMost(
      th.getDifference(
        totalCollateralSnapshot_After,
        A_coll.add(A_reward).add(th.applyLiquidationFee(B_coll.add(B_reward))),
      ),
      1000,
    ); // 3 + 4.5*0.995 + 1.5*0.995^2
  });

  it("liquidate(), with ICR < 100%: closes the Trove and removes it from the Trove array", async () => {
    // --- SETUP ---
    //  Alice and Bob withdraw such that the TCR is ~150%
    await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } });
    await openTrove({
      ICR: toBN(dec(150, 16)),
      extraBoldAmount: dec(2000, 18),
      extraParams: { from: bob },
    });

    const TCR = (await th.getTCR(contracts)).toString();
    assert.equal(TCR, "1500000000000000000");

    const bob_TroveStatus_Before = (await troveManager.Troves(bob))[3];
    const bob_Trove_isInSortedList_Before = await sortedTroves.contains(bob);

    assert.equal(bob_TroveStatus_Before, 1); // status enum element 1 corresponds to "Active"
    assert.isTrue(bob_Trove_isInSortedList_Before);

    // --- TEST ---
    // price drops to 1ETH:100Bold, reducing TCR below 150%
    await priceFeed.setPrice("100000000000000000000");
    const price = await priceFeed.getPrice();

    const recoveryMode = await th.checkRecoveryMode(contracts);
    assert.isTrue(recoveryMode);

    // check Bob's ICR falls to 75%
    const bob_ICR = await troveManager.getCurrentICR(bob, price);
    assert.equal(bob_ICR, "750000000000000000");

    // Liquidate Bob
    await troveManager.liquidate(bob, { from: owner });

    // check Bob's Trove is successfully closed, and removed from sortedList
    const bob_TroveStatus_After = (await troveManager.Troves(bob))[3];
    const bob_Trove_isInSortedList_After = await sortedTroves.contains(bob);
    assert.equal(bob_TroveStatus_After, 3); // status enum element 3 corresponds to "Closed by liquidation"
    assert.isFalse(bob_Trove_isInSortedList_After);
  });

  it("liquidate(), with ICR < 100%: only redistributes to active Troves - no offset to Stability Pool", async () => {
    // --- SETUP ---
    //  Alice, Bob and Dennis withdraw such that their ICRs and the TCR is ~150%
    const spDeposit = toBN(dec(390, 18));
    const { collateral: A_coll } = await openTrove({
      ICR: toBN(dec(150, 16)),
      extraBoldAmount: spDeposit,
      extraParams: { from: alice },
    });
    const { collateral: B_coll } = await openTrove({
      ICR: toBN(dec(150, 16)),
      extraParams: { from: bob },
    });
    const { collateral: D_coll } = await openTrove({
      ICR: toBN(dec(150, 16)),
      extraParams: { from: dennis },
    });

    // Alice deposits to SP
    await stabilityPool.provideToSP(spDeposit, { from: alice });

    // check rewards-per-unit-staked before
    const P_Before = (await stabilityPool.P()).toString();

    assert.equal(P_Before, "1000000000000000000");

    // const TCR = (await th.getTCR(contracts)).toString()
    // assert.equal(TCR, '1500000000000000000')

    // --- TEST ---
    // price drops to 1ETH:100Bold, reducing TCR below 150%, and all Troves below 100% ICR
    await priceFeed.setPrice("100000000000000000000");

    const recoveryMode = await th.checkRecoveryMode(contracts);
    assert.isTrue(recoveryMode);

    // liquidate bob
    await troveManager.liquidate(bob, { from: owner });

    // check SP rewards-per-unit-staked after liquidation - should be no increase
    const P_After = (await stabilityPool.P()).toString();

    assert.equal(P_After, "1000000000000000000");
  });

  // --- liquidate() with 100% < ICR < 110%

  it("liquidate(), with 100 < ICR < 110%: removes stake and updates totalStakes", async () => {
    // --- SETUP ---
    //  Bob withdraws up to 2000 Bold of debt, bringing his ICR to 210%
    const { collateral: A_coll, totalDebt: A_totalDebt } = await openTrove({
      ICR: toBN(dec(150, 16)),
      extraParams: { from: alice },
    });
    const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({
      ICR: toBN(dec(210, 16)),
      extraBoldAmount: dec(2000, 18),
      extraParams: { from: bob },
    });

    let price = await priceFeed.getPrice();
    // Total TCR = 24*200/2050 = 234%
    const TCR = await th.getTCR(contracts);
    assert.isAtMost(
      th.getDifference(
        TCR,
        A_coll.add(B_coll).mul(price).div(A_totalDebt.add(B_totalDebt)),
      ),
      1000,
    );

    const bob_Stake_Before = (await troveManager.Troves(bob))[2];
    const totalStakes_Before = await troveManager.totalStakes();

    assert.equal(bob_Stake_Before.toString(), B_coll);
    assert.equal(totalStakes_Before.toString(), A_coll.add(B_coll));

    // --- TEST ---
    // price drops to 1ETH:100Bold, reducing TCR to 117%
    await priceFeed.setPrice("100000000000000000000");
    price = await priceFeed.getPrice();

    const recoveryMode = await th.checkRecoveryMode(contracts);
    assert.isTrue(recoveryMode);

    // check Bob's ICR falls to 105%
    const bob_ICR = await troveManager.getCurrentICR(bob, price);
    assert.equal(bob_ICR, "1050000000000000000");

    // Liquidate Bob
    await troveManager.liquidate(bob, { from: owner });

    const bob_Stake_After = (await troveManager.Troves(bob))[2];
    const totalStakes_After = await troveManager.totalStakes();

    assert.equal(bob_Stake_After, 0);
    assert.equal(totalStakes_After.toString(), A_coll);
  });

  it("liquidate(), with 100% < ICR < 110%: updates system snapshots correctly", async () => {
    // --- SETUP ---
    //  Alice and Dennis withdraw such that their ICR is ~150%
    //  Bob withdraws up to 20000 Bold of debt, bringing his ICR to 210%
    const { collateral: A_coll, totalDebt: A_totalDebt } = await openTrove({
      ICR: toBN(dec(150, 16)),
      extraParams: { from: alice },
    });
    const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({
      ICR: toBN(dec(210, 16)),
      extraBoldAmount: dec(20000, 18),
      extraParams: { from: bob },
    });
    const { collateral: D_coll } = await openTrove({
      ICR: toBN(dec(150, 16)),
      extraParams: { from: dennis },
    });

    const totalStakesSnaphot_1 = (
      await troveManager.totalStakesSnapshot()
    ).toString();
    const totalCollateralSnapshot_1 = (
      await troveManager.totalCollateralSnapshot()
    ).toString();
    assert.equal(totalStakesSnaphot_1, 0);
    assert.equal(totalCollateralSnapshot_1, 0);

    // --- TEST ---
    // price drops to 1ETH:100Bold, reducing TCR below 150%, and all Troves below 100% ICR
    await priceFeed.setPrice("100000000000000000000");
    const price = await priceFeed.getPrice();

    const recoveryMode = await th.checkRecoveryMode(contracts);
    assert.isTrue(recoveryMode);

    // Dennis is liquidated
    await troveManager.liquidate(dennis, { from: owner });

    const A_reward = th
      .applyLiquidationFee(D_coll)
      .mul(A_coll)
      .div(A_coll.add(B_coll));
    const B_reward = th
      .applyLiquidationFee(D_coll)
      .mul(B_coll)
      .div(A_coll.add(B_coll));

    /*
    Prior to Dennis liquidation, total stakes and total collateral were each 27 ether.

    Check snapshots. Dennis' liquidated collateral is distributed and remains in the system. His
    stake is removed, leaving 24+3*0.995 ether total collateral, and 24 ether total stakes. */

    const totalStakesSnaphot_2 = (
      await troveManager.totalStakesSnapshot()
    ).toString();
    const totalCollateralSnapshot_2 = (
      await troveManager.totalCollateralSnapshot()
    ).toString();
    assert.equal(totalStakesSnaphot_2, A_coll.add(B_coll));
    assert.equal(
      totalCollateralSnapshot_2,
      A_coll.add(B_coll).add(th.applyLiquidationFee(D_coll)),
    ); // 24 + 3*0.995

    // check Bob's ICR is now in range 100% < ICR 110%
    const _110percent = web3.utils.toBN("1100000000000000000");
    const _100percent = web3.utils.toBN("1000000000000000000");

    const bob_ICR = await troveManager.getCurrentICR(bob, price);

    assert.isTrue(bob_ICR.lt(_110percent));
    assert.isTrue(bob_ICR.gt(_100percent));

    // Liquidate Bob
    await troveManager.liquidate(bob, { from: owner });

    /* After Bob's liquidation, Bob's stake (21 ether) should be removed from total stakes,
    but his collateral should remain in the system (*0.995). */
    const totalStakesSnaphot_3 = await troveManager.totalStakesSnapshot();
    const totalCollateralSnapshot_3 = await troveManager.totalCollateralSnapshot();
    assert.equal(totalStakesSnaphot_3.toString(), A_coll);
    // total collateral should always be 27 minus gas compensations, as all liquidations in this test case are full redistributions
    assert.isAtMost(
      th.getDifference(
        totalCollateralSnapshot_3.toString(),
        A_coll.add(A_reward).add(th.applyLiquidationFee(B_coll.add(B_reward))),
      ),
      1000,
    );
  });

  it("liquidate(), with 100% < ICR < 110%: closes the Trove and removes it from the Trove array", async () => {
    // --- SETUP ---
    //  Bob withdraws up to 2000 Bold of debt, bringing his ICR to 210%
    const { collateral: A_coll, totalDebt: A_totalDebt } = await openTrove({
      ICR: toBN(dec(150, 16)),
      extraParams: { from: alice },
    });
    const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({
      ICR: toBN(dec(210, 16)),
      extraBoldAmount: dec(2000, 18),
      extraParams: { from: bob },
    });

    const bob_TroveStatus_Before = (await troveManager.Troves(bob))[3];
    const bob_Trove_isInSortedList_Before = await sortedTroves.contains(bob);

    assert.equal(bob_TroveStatus_Before, 1); // status enum element 1 corresponds to "Active"
    assert.isTrue(bob_Trove_isInSortedList_Before);

    // --- TEST ---
    // price drops to 1ETH:100Bold, reducing TCR below 150%
    await priceFeed.setPrice("100000000000000000000");
    const price = await priceFeed.getPrice();

    const recoveryMode = await th.checkRecoveryMode(contracts);
    assert.isTrue(recoveryMode);

    // check Bob's ICR has fallen to 105%
    const bob_ICR = await troveManager.getCurrentICR(bob, price);
    assert.equal(bob_ICR, "1050000000000000000");

    // Liquidate Bob
    await troveManager.liquidate(bob, { from: owner });

    // check Bob's Trove is successfully closed, and removed from sortedList
    const bob_TroveStatus_After = (await troveManager.Troves(bob))[3];
    const bob_Trove_isInSortedList_After = await sortedTroves.contains(bob);
    assert.equal(bob_TroveStatus_After, 3); // status enum element 3 corresponds to "Closed by liquidation"
    assert.isFalse(bob_Trove_isInSortedList_After);
  });

  it("liquidate(), with 100% < ICR < 110%: offsets as much debt as possible with the Stability Pool, then redistributes the remainder coll and debt", async () => {
    // --- SETUP ---
    //  Alice and Dennis withdraw such that their ICR is ~150%
    //  Bob withdraws up to 2000 Bold of debt, bringing his ICR to 210%
    const spDeposit = toBN(dec(390, 18));
    const { collateral: A_coll } = await openTrove({
      ICR: toBN(dec(150, 16)),
      extraBoldAmount: spDeposit,
      extraParams: { from: alice },
    });
    const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({
      ICR: toBN(dec(210, 16)),
      extraBoldAmount: dec(2000, 18),
      extraParams: { from: bob },
    });
    const { collateral: D_coll } = await openTrove({
      ICR: toBN(dec(150, 16)),
      extraParams: { from: dennis },
    });

    // Alice deposits 390Bold to the Stability Pool
    await stabilityPool.provideToSP(spDeposit, { from: alice });

    // --- TEST ---
    // price drops to 1ETH:100Bold, reducing TCR below 150%
    await priceFeed.setPrice("100000000000000000000");
    const price = await priceFeed.getPrice();

    const recoveryMode = await th.checkRecoveryMode(contracts);
    assert.isTrue(recoveryMode);

    // check Bob's ICR has fallen to 105%
    const bob_ICR = await troveManager.getCurrentICR(bob, price);
    assert.equal(bob_ICR, "1050000000000000000");

    // check pool Bold before liquidation
    const stabilityPoolBold_Before = (
      await stabilityPool.getTotalBoldDeposits()
    ).toString();
    assert.equal(stabilityPoolBold_Before, "390000000000000000000");

    // check Pool reward term before liquidation
    const P_Before = (await stabilityPool.P()).toString();

    assert.equal(P_Before, "1000000000000000000");

    /* Now, liquidate Bob. Liquidated coll is 21 ether, and liquidated debt is 2000 Bold.

    With 390 Bold in the StabilityPool, 390 Bold should be offset with the pool, leaving 0 in the pool.

    Stability Pool rewards for alice should be:
    BoldLoss: 390Bold
    ETHGain: (390 / 2000) * 21*0.995 = 4.074525 ether

    After offsetting 390 Bold and 4.074525 ether, the remainders - 1610 Bold and 16.820475 ether - should be redistributed to all active Troves.
   */
    // Liquidate Bob
    await troveManager.liquidate(bob, { from: owner });

    const aliceDeposit = await stabilityPool.getCompoundedBoldDeposit(alice);
    const aliceETHGain = await stabilityPool.getDepositorETHGain(alice);
    const aliceExpectedETHGain = spDeposit
      .mul(th.applyLiquidationFee(B_coll))
      .div(B_totalDebt);

    assert.equal(aliceDeposit.toString(), 0);
    assert.equal(aliceETHGain.toString(), aliceExpectedETHGain);

    /* Now, check redistribution to active Troves. Remainders of 1610 Bold and 16.82 ether are distributed.

    Now, only Alice and Dennis have a stake in the system - 3 ether each, thus total stakes is 6 ether.

    Rewards-per-unit-staked from the redistribution should be:

    L_boldDebt = 1610 / 6 = 268.333 Bold
    L_ETH = 16.820475 /6 =  2.8034125 ether
    */
    const L_boldDebt = (await troveManager.L_boldDebt()).toString();
    const L_ETH = (await troveManager.L_ETH()).toString();

    assert.isAtMost(
      th.getDifference(
        L_boldDebt,
        B_totalDebt.sub(spDeposit).mul(mv._1e18BN).div(A_coll.add(D_coll)),
      ),
      100,
    );
    assert.isAtMost(
      th.getDifference(
        L_ETH,
        th.applyLiquidationFee(
          B_coll.sub(B_coll.mul(spDeposit).div(B_totalDebt))
            .mul(mv._1e18BN)
            .div(A_coll.add(D_coll)),
        ),
      ),
      100,
    );
  });

  // --- liquidate(), applied to trove with ICR > 110% that has the lowest ICR

  it("liquidate(), with ICR > 110%, trove has lowest ICR, and StabilityPool is empty: does nothing", async () => {
    // --- SETUP ---
    // Alice and Dennis withdraw, resulting in ICRs of 266%.
    // Bob withdraws, resulting in ICR of 240%. Bob has lowest ICR.
    const { collateral: A_coll } = await openTrove({
      ICR: toBN(dec(266, 16)),
      extraParams: { from: alice },
    });
    const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({
      ICR: toBN(dec(240, 16)),
      extraBoldAmount: dec(2000, 18),
      extraParams: { from: bob },
    });
    const { collateral: D_coll } = await openTrove({
      ICR: toBN(dec(266, 16)),
      extraBoldAmount: dec(2000, 18),
      extraParams: { from: dennis },
    });

    // --- TEST ---
    // price drops to 1ETH:100Bold, reducing TCR below 150%
    await priceFeed.setPrice("100000000000000000000");
    const price = await priceFeed.getPrice();

    const recoveryMode = await th.checkRecoveryMode(contracts);
    assert.isTrue(recoveryMode);

    // Check Bob's ICR is >110% but still lowest
    const bob_ICR = (await troveManager.getCurrentICR(bob, price)).toString();
    const alice_ICR = (
      await troveManager.getCurrentICR(alice, price)
    ).toString();
    const dennis_ICR = (
      await troveManager.getCurrentICR(dennis, price)
    ).toString();
    assert.equal(bob_ICR, "1200000000000000000");
    assert.equal(alice_ICR, dec(133, 16));
    assert.equal(dennis_ICR, dec(133, 16));

    // console.log(`TCR: ${await th.getTCR(contracts)}`)
    // Try to liquidate Bob
    await assertRevert(
      troveManager.liquidate(bob, { from: owner }),
      "TroveManager: nothing to liquidate",
    );

    // Check that Pool rewards don't change
    const P_Before = (await stabilityPool.P()).toString();

    assert.equal(P_Before, "1000000000000000000");

    // Check that redistribution rewards don't change
    const L_boldDebt = (await troveManager.L_boldDebt()).toString();
    const L_ETH = (await troveManager.L_ETH()).toString();

    assert.equal(L_boldDebt, "0");
    assert.equal(L_ETH, "0");

    // Check that Bob's Trove and stake remains active with unchanged coll and debt
    const bob_Trove = await troveManager.Troves(bob);
    const bob_Debt = bob_Trove[0].toString();
    const bob_Coll = bob_Trove[1].toString();
    const bob_Stake = bob_Trove[2].toString();
    const bob_TroveStatus = bob_Trove[3].toString();
    const bob_isInSortedTrovesList = await sortedTroves.contains(bob);

    th.assertIsApproximatelyEqual(bob_Debt.toString(), B_totalDebt);
    assert.equal(bob_Coll.toString(), B_coll);
    assert.equal(bob_Stake.toString(), B_coll);
    assert.equal(bob_TroveStatus, "1");
    assert.isTrue(bob_isInSortedTrovesList);
  });

  // --- liquidate(), applied to trove with ICR > 110% that has the lowest ICR, and Stability Pool Bold is GREATER THAN liquidated debt ---

  it("liquidate(), with 110% < ICR < TCR, and StabilityPool Bold > debt to liquidate: offsets the trove entirely with the pool", async () => {
    // --- SETUP ---
    // Alice withdraws up to 1500 Bold of debt, and Dennis up to 150, resulting in ICRs of 266%.
    // Bob withdraws up to 250 Bold of debt, resulting in ICR of 240%. Bob has lowest ICR.
    const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({
      ICR: toBN(dec(240, 16)),
      extraBoldAmount: dec(250, 18),
      extraParams: { from: bob },
    });
    const { collateral: A_coll } = await openTrove({
      ICR: toBN(dec(266, 16)),
      extraBoldAmount: B_totalDebt,
      extraParams: { from: alice },
    });
    const { collateral: D_coll } = await openTrove({
      ICR: toBN(dec(266, 16)),
      extraBoldAmount: dec(2000, 18),
      extraParams: { from: dennis },
    });

    // Alice deposits Bold in the Stability Pool
    const spDeposit = B_totalDebt.add(toBN(1));
    await stabilityPool.provideToSP(spDeposit, { from: alice });

    // --- TEST ---
    // price drops to 1ETH:100Bold, reducing TCR below 150%
    await priceFeed.setPrice("100000000000000000000");
    const price = await priceFeed.getPrice();
    const TCR = await th.getTCR(contracts);

    const recoveryMode = await th.checkRecoveryMode(contracts);
    assert.isTrue(recoveryMode);

    // Check Bob's ICR is between 110 and TCR
    const bob_ICR = await troveManager.getCurrentICR(bob, price);
    assert.isTrue(bob_ICR.gt(mv._MCR) && bob_ICR.lt(TCR));

    // Liquidate Bob
    await troveManager.liquidate(bob, { from: owner });

    /* Check accrued Stability Pool rewards after. Total Pool deposits was 1490 Bold, Alice sole depositor.
    As liquidated debt (250 Bold) was completely offset

    Alice's expected compounded deposit: (1490 - 250) = 1240Bold
    Alice's expected ETH gain:  Bob's liquidated capped coll (minus gas comp), 2.75*0.995 ether

    */
    const aliceExpectedDeposit = await stabilityPool.getCompoundedBoldDeposit(
      alice,
    );
    const aliceExpectedETHGain = await stabilityPool.getDepositorETHGain(alice);

    assert.isAtMost(
      th.getDifference(
        aliceExpectedDeposit.toString(),
        spDeposit.sub(B_totalDebt),
      ),
      2000,
    );
    assert.isAtMost(
      th.getDifference(
        aliceExpectedETHGain,
        th.applyLiquidationFee(B_totalDebt.mul(th.toBN(dec(11, 17))).div(price)),
      ),
      3000,
    );

    // check Bob’s collateral surplus
    const bob_remainingCollateral = B_coll.sub(
      B_totalDebt.mul(th.toBN(dec(11, 17))).div(price),
    );
    th.assertIsApproximatelyEqual(
      await collSurplusPool.getCollateral(bob),
      bob_remainingCollateral,
    );
    // can claim collateral
    const bob_balanceBefore = th.toBN(await contracts.WETH.balanceOf(bob));
    await borrowerOperations.claimCollateral({ from: bob });
    const bob_balanceAfter = th.toBN(await contracts.WETH.balanceOf(bob));
    th.assertIsApproximatelyEqual(
      bob_balanceAfter,
      bob_balanceBefore.add(th.toBN(bob_remainingCollateral)),
    );
  });

  it("liquidate(), with ICR% = 110 < TCR, and StabilityPool Bold > debt to liquidate: offsets the trove entirely with the pool, there’s no collateral surplus", async () => {
    // --- SETUP ---
    // Alice withdraws up to 1500 Bold of debt, and Dennis up to 150, resulting in ICRs of 266%.
    // Bob withdraws up to 250 Bold of debt, resulting in ICR of 220%. Bob has lowest ICR.
    const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({
      ICR: toBN(dec(220, 16)),
      extraBoldAmount: dec(250, 18),
      extraParams: { from: bob },
    });
    const { collateral: A_coll } = await openTrove({
      ICR: toBN(dec(266, 16)),
      extraBoldAmount: B_totalDebt,
      extraParams: { from: alice },
    });
    const { collateral: D_coll } = await openTrove({
      ICR: toBN(dec(266, 16)),
      extraBoldAmount: dec(2000, 18),
      extraParams: { from: dennis },
    });

    // Alice deposits Bold in the Stability Pool
    const spDeposit = B_totalDebt.add(toBN(1));
    await stabilityPool.provideToSP(spDeposit, { from: alice });

    // --- TEST ---
    // price drops to 1ETH:100Bold, reducing TCR below 150%
    await priceFeed.setPrice("100000000000000000000");
    const price = await priceFeed.getPrice();
    const TCR = await th.getTCR(contracts);

    const recoveryMode = await th.checkRecoveryMode(contracts);
    assert.isTrue(recoveryMode);

    // Check Bob's ICR = 110
    const bob_ICR = await troveManager.getCurrentICR(bob, price);
    assert.isTrue(bob_ICR.eq(mv._MCR));

    // Liquidate Bob
    await troveManager.liquidate(bob, { from: owner });

    /* Check accrued Stability Pool rewards after. Total Pool deposits was 1490 Bold, Alice sole depositor.
    As liquidated debt (250 Bold) was completely offset

    Alice's expected compounded deposit: (1490 - 250) = 1240Bold
    Alice's expected ETH gain:  Bob's liquidated capped coll (minus gas comp), 2.75*0.995 ether

    */
    const aliceExpectedDeposit = await stabilityPool.getCompoundedBoldDeposit(
      alice,
    );
    const aliceExpectedETHGain = await stabilityPool.getDepositorETHGain(alice);

    assert.isAtMost(
      th.getDifference(
        aliceExpectedDeposit.toString(),
        spDeposit.sub(B_totalDebt),
      ),
      2000,
    );
    assert.isAtMost(
      th.getDifference(
        aliceExpectedETHGain,
        th.applyLiquidationFee(B_totalDebt.mul(th.toBN(dec(11, 17))).div(price)),
      ),
      3000,
    );

    // check Bob’s collateral surplus
    th.assertIsApproximatelyEqual(
      await collSurplusPool.getCollateral(bob),
      "0",
    );
  });

  it("liquidate(), with  110% < ICR < TCR, and StabilityPool Bold > debt to liquidate: removes stake and updates totalStakes", async () => {
    // --- SETUP ---
    // Alice withdraws up to 1500 Bold of debt, and Dennis up to 150, resulting in ICRs of 266%.
    // Bob withdraws up to 250 Bold of debt, resulting in ICR of 240%. Bob has lowest ICR.
    const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({
      ICR: toBN(dec(240, 16)),
      extraBoldAmount: dec(250, 18),
      extraParams: { from: bob },
    });
    const { collateral: A_coll } = await openTrove({
      ICR: toBN(dec(266, 16)),
      extraBoldAmount: B_totalDebt,
      extraParams: { from: alice },
    });
    const { collateral: D_coll } = await openTrove({
      ICR: toBN(dec(266, 16)),
      extraBoldAmount: dec(2000, 18),
      extraParams: { from: dennis },
    });

    // Alice deposits Bold in the Stability Pool
    await stabilityPool.provideToSP(B_totalDebt.add(toBN(1)), {
      from: alice,
    });

    // --- TEST ---
    // price drops to 1ETH:100Bold, reducing TCR below 150%
    await priceFeed.setPrice("100000000000000000000");
    const price = await priceFeed.getPrice();

    const recoveryMode = await th.checkRecoveryMode(contracts);
    assert.isTrue(recoveryMode);

    // check stake and totalStakes before
    const bob_Stake_Before = (await troveManager.Troves(bob))[2];
    const totalStakes_Before = await troveManager.totalStakes();

    assert.equal(bob_Stake_Before.toString(), B_coll);
    assert.equal(totalStakes_Before.toString(), A_coll.add(B_coll).add(D_coll));

    // Check Bob's ICR is between 110 and 150
    const bob_ICR = await troveManager.getCurrentICR(bob, price);
    assert.isTrue(
      bob_ICR.gt(mv._MCR) && bob_ICR.lt(await th.getTCR(contracts)),
    );

    // Liquidate Bob
    await troveManager.liquidate(bob, { from: owner });

    // check stake and totalStakes after
    const bob_Stake_After = (await troveManager.Troves(bob))[2];
    const totalStakes_After = await troveManager.totalStakes();

    assert.equal(bob_Stake_After, 0);
    assert.equal(totalStakes_After.toString(), A_coll.add(D_coll));

    // check Bob’s collateral surplus
    const bob_remainingCollateral = B_coll.sub(
      B_totalDebt.mul(th.toBN(dec(11, 17))).div(price),
    );
    th.assertIsApproximatelyEqual(
      await collSurplusPool.getCollateral(bob),
      bob_remainingCollateral,
    );
    // can claim collateral
    const bob_balanceBefore = th.toBN(await contracts.WETH.balanceOf(bob));
    await borrowerOperations.claimCollateral({ from: bob });
    const bob_balanceAfter = th.toBN(await contracts.WETH.balanceOf(bob));
    th.assertIsApproximatelyEqual(
      bob_balanceAfter,
      bob_balanceBefore.add(th.toBN(bob_remainingCollateral)),
    );
  });

  it("liquidate(), with  110% < ICR < TCR, and StabilityPool Bold > debt to liquidate: updates system snapshots", async () => {
    // --- SETUP ---
    // Alice withdraws up to 1500 Bold of debt, and Dennis up to 150, resulting in ICRs of 266%.
    // Bob withdraws up to 250 Bold of debt, resulting in ICR of 240%. Bob has lowest ICR.
    const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({
      ICR: toBN(dec(240, 16)),
      extraBoldAmount: dec(250, 18),
      extraParams: { from: bob },
    });
    const { collateral: A_coll } = await openTrove({
      ICR: toBN(dec(266, 16)),
      extraBoldAmount: B_totalDebt,
      extraParams: { from: alice },
    });
    const { collateral: D_coll } = await openTrove({
      ICR: toBN(dec(266, 16)),
      extraBoldAmount: dec(2000, 18),
      extraParams: { from: dennis },
    });

    // Alice deposits Bold in the Stability Pool
    await stabilityPool.provideToSP(B_totalDebt.add(toBN(1)), {
      from: alice,
    });

    // --- TEST ---
    // price drops to 1ETH:100Bold, reducing TCR below 150%
    await priceFeed.setPrice("100000000000000000000");
    const price = await priceFeed.getPrice();

    const recoveryMode = await th.checkRecoveryMode(contracts);
    assert.isTrue(recoveryMode);

    // check system snapshots before
    const totalStakesSnaphot_before = (
      await troveManager.totalStakesSnapshot()
    ).toString();
    const totalCollateralSnapshot_before = (
      await troveManager.totalCollateralSnapshot()
    ).toString();

    assert.equal(totalStakesSnaphot_before, "0");
    assert.equal(totalCollateralSnapshot_before, "0");

    // Check Bob's ICR is between 110 and TCR
    const bob_ICR = await troveManager.getCurrentICR(bob, price);
    assert.isTrue(
      bob_ICR.gt(mv._MCR) && bob_ICR.lt(await th.getTCR(contracts)),
    );

    // Liquidate Bob
    await troveManager.liquidate(bob, { from: owner });

    const totalStakesSnaphot_After = await troveManager.totalStakesSnapshot();
    const totalCollateralSnapshot_After = await troveManager.totalCollateralSnapshot();

    // totalStakesSnapshot should have reduced to 22 ether - the sum of Alice's coll( 20 ether) and Dennis' coll (2 ether )
    assert.equal(totalStakesSnaphot_After.toString(), A_coll.add(D_coll));
    // Total collateral should also reduce, since all liquidated coll has been moved to a reward for Stability Pool depositors
    assert.equal(totalCollateralSnapshot_After.toString(), A_coll.add(D_coll));
  });

  it("liquidate(), with 110% < ICR < TCR, and StabilityPool Bold > debt to liquidate: closes the Trove", async () => {
    // --- SETUP ---
    // Alice withdraws up to 1500 Bold of debt, and Dennis up to 150, resulting in ICRs of 266%.
    // Bob withdraws up to 250 Bold of debt, resulting in ICR of 240%. Bob has lowest ICR.
    const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({
      ICR: toBN(dec(240, 16)),
      extraBoldAmount: dec(250, 18),
      extraParams: { from: bob },
    });
    const { collateral: A_coll } = await openTrove({
      ICR: toBN(dec(266, 16)),
      extraBoldAmount: B_totalDebt,
      extraParams: { from: alice },
    });
    const { collateral: D_coll } = await openTrove({
      ICR: toBN(dec(266, 16)),
      extraBoldAmount: dec(2000, 18),
      extraParams: { from: dennis },
    });

    // Alice deposits Bold in the Stability Pool
    await stabilityPool.provideToSP(B_totalDebt.add(toBN(1)), {
      from: alice,
    });

    // --- TEST ---
    // price drops to 1ETH:100Bold, reducing TCR below 150%
    await priceFeed.setPrice("100000000000000000000");
    const price = await priceFeed.getPrice();

    const recoveryMode = await th.checkRecoveryMode(contracts);
    assert.isTrue(recoveryMode);

    // Check Bob's Trove is active
    const bob_TroveStatus_Before = (await troveManager.Troves(bob))[3];
    const bob_Trove_isInSortedList_Before = await sortedTroves.contains(bob);

    assert.equal(bob_TroveStatus_Before, 1); // status enum element 1 corresponds to "Active"
    assert.isTrue(bob_Trove_isInSortedList_Before);

    // Check Bob's ICR is between 110 and TCR
    const bob_ICR = await troveManager.getCurrentICR(bob, price);
    assert.isTrue(
      bob_ICR.gt(mv._MCR) && bob_ICR.lt(await th.getTCR(contracts)),
    );

    // Liquidate Bob
    await troveManager.liquidate(bob, { from: owner });

    // Check Bob's Trove is closed after liquidation
    const bob_TroveStatus_After = (await troveManager.Troves(bob))[3];
    const bob_Trove_isInSortedList_After = await sortedTroves.contains(bob);

    assert.equal(bob_TroveStatus_After, 3); // status enum element 3 corresponds to "Closed by liquidation"
    assert.isFalse(bob_Trove_isInSortedList_After);

    // check Bob’s collateral surplus
    const bob_remainingCollateral = B_coll.sub(
      B_totalDebt.mul(th.toBN(dec(11, 17))).div(price),
    );
    th.assertIsApproximatelyEqual(
      await collSurplusPool.getCollateral(bob),
      bob_remainingCollateral,
    );
    // can claim collateral
    const bob_balanceBefore = th.toBN(await contracts.WETH.balanceOf(bob));
    await borrowerOperations.claimCollateral({ from: bob });
    const bob_balanceAfter = th.toBN(await contracts.WETH.balanceOf(bob));
    th.assertIsApproximatelyEqual(
      bob_balanceAfter,
      bob_balanceBefore.add(th.toBN(bob_remainingCollateral)),
    );
  });

  it("liquidate(), with 110% < ICR < TCR, and StabilityPool Bold > debt to liquidate: can liquidate troves out of order", async () => {
    // taking out 1000 Bold, CR of 200%
    const { collateral: A_coll, totalDebt: A_totalDebt } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraParams: { from: alice },
    });
    const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({
      ICR: toBN(dec(202, 16)),
      extraParams: { from: bob },
    });
    const { collateral: C_coll, totalDebt: C_totalDebt } = await openTrove({
      ICR: toBN(dec(204, 16)),
      extraParams: { from: carol },
    });
    const { collateral: D_coll, totalDebt: D_totalDebt } = await openTrove({
      ICR: toBN(dec(206, 16)),
      extraParams: { from: dennis },
    });
    const { collateral: E_coll } = await openTrove({
      ICR: toBN(dec(240, 16)),
      extraParams: { from: erin },
    });
    const { collateral: F_coll } = await openTrove({
      ICR: toBN(dec(240, 16)),
      extraParams: { from: freddy },
    });

    const totalLiquidatedDebt = A_totalDebt.add(B_totalDebt)
      .add(C_totalDebt)
      .add(D_totalDebt);

    await openTrove({
      ICR: toBN(dec(200, 16)),
      extraBoldAmount: totalLiquidatedDebt,
      extraParams: { from: whale },
    });
    await stabilityPool.provideToSP(totalLiquidatedDebt, {
      from: whale,
    });

    // Price drops
    await priceFeed.setPrice(dec(120, 18));
    const price = await priceFeed.getPrice();
    const TCR = await th.getTCR(contracts);

    // Check Recovery Mode is active
    assert.isTrue(await th.checkRecoveryMode(contracts));

    // Troves are ordered by ICR, low to high: A, B, C, D.

    // Liquidate out of ICR order: D, B, C.  Prior to each, confirm that:
    // - Recovery Mode is active
    // - MCR < ICR < TCR
    assert.isTrue(await th.checkRecoveryMode(contracts));
    const ICR_D = await troveManager.getCurrentICR(dennis, price);
    assert.isTrue(ICR_D.gt(mv._MCR));
    assert.isTrue(ICR_D.lt(TCR));
    const liquidationTx_D = await troveManager.liquidate(dennis);
    assert.isTrue(liquidationTx_D.receipt.status);

    assert.isTrue(await th.checkRecoveryMode(contracts));
    const ICR_B = await troveManager.getCurrentICR(bob, price);
    assert.isTrue(ICR_B.gt(mv._MCR));
    assert.isTrue(ICR_B.lt(TCR));
    const liquidationTx_B = await troveManager.liquidate(bob);
    assert.isTrue(liquidationTx_B.receipt.status);

    assert.isTrue(await th.checkRecoveryMode(contracts));
    const ICR_C = await troveManager.getCurrentICR(carol, price);
    assert.isTrue(ICR_C.gt(mv._MCR));
    assert.isTrue(ICR_C.lt(TCR));
    const liquidationTx_C = await troveManager.liquidate(carol);
    assert.isTrue(liquidationTx_C.receipt.status);

    // Confirm troves D, B, C removed
    assert.isFalse(await sortedTroves.contains(dennis));
    assert.isFalse(await sortedTroves.contains(bob));
    assert.isFalse(await sortedTroves.contains(carol));

    // Confirm troves have status 'closed by liquidation' (Status enum element idx 3)
    assert.equal((await troveManager.Troves(dennis))[3], "3");
    assert.equal((await troveManager.Troves(bob))[3], "3");
    assert.equal((await troveManager.Troves(carol))[3], "3");

    // check collateral surplus
    const dennis_remainingCollateral = D_coll.sub(
      D_totalDebt.mul(th.toBN(dec(11, 17))).div(price),
    );
    const bob_remainingCollateral = B_coll.sub(
      B_totalDebt.mul(th.toBN(dec(11, 17))).div(price),
    );
    const carol_remainingCollateral = C_coll.sub(
      C_totalDebt.mul(th.toBN(dec(11, 17))).div(price),
    );
    th.assertIsApproximatelyEqual(
      await collSurplusPool.getCollateral(dennis),
      dennis_remainingCollateral,
    );
    th.assertIsApproximatelyEqual(
      await collSurplusPool.getCollateral(bob),
      bob_remainingCollateral,
    );
    th.assertIsApproximatelyEqual(
      await collSurplusPool.getCollateral(carol),
      carol_remainingCollateral,
    );

    // can claim collateral
    const dennis_balanceBefore = th.toBN(await contracts.WETH.balanceOf(dennis));
    await borrowerOperations.claimCollateral({ from: dennis });
    const dennis_balanceAfter = th.toBN(await contracts.WETH.balanceOf(dennis));
    assert.isTrue(
      dennis_balanceAfter.eq(
        dennis_balanceBefore.add(th.toBN(dennis_remainingCollateral)),
      ),
    );

    const bob_balanceBefore = th.toBN(await contracts.WETH.balanceOf(bob));
    await borrowerOperations.claimCollateral({ from: bob });
    const bob_balanceAfter = th.toBN(await contracts.WETH.balanceOf(bob));
    th.assertIsApproximatelyEqual(
      bob_balanceAfter,
      bob_balanceBefore.add(th.toBN(bob_remainingCollateral)),
    );

    const carol_balanceBefore = th.toBN(await contracts.WETH.balanceOf(carol));
    await borrowerOperations.claimCollateral({ from: carol });
    const carol_balanceAfter = th.toBN(await contracts.WETH.balanceOf(carol));
    th.assertIsApproximatelyEqual(
      carol_balanceAfter,
      carol_balanceBefore.add(th.toBN(carol_remainingCollateral)),
    );
  });

  /* --- liquidate() applied to trove with ICR > 110% that has the lowest ICR, and Stability Pool
  Bold is LESS THAN the liquidated debt: a non fullfilled liquidation --- */

  it("liquidate(), with ICR > 110%, and StabilityPool Bold < liquidated debt: Trove remains active", async () => {
    // --- SETUP ---
    // Alice withdraws up to 1500 Bold of debt, and Dennis up to 150, resulting in ICRs of 266%.
    // Bob withdraws up to 250 Bold of debt, resulting in ICR of 240%. Bob has lowest ICR.
    const { collateral: A_coll } = await openTrove({
      ICR: toBN(dec(266, 16)),
      extraBoldAmount: dec(1500, 18),
      extraParams: { from: alice },
    });
    const { collateral: B_coll } = await openTrove({
      ICR: toBN(dec(240, 16)),
      extraBoldAmount: dec(250, 18),
      extraParams: { from: bob },
    });
    const { collateral: D_coll } = await openTrove({
      ICR: toBN(dec(266, 16)),
      extraBoldAmount: dec(2000, 18),
      extraParams: { from: dennis },
    });

    // Alice deposits 1490 Bold in the Stability Pool
    await stabilityPool.provideToSP("1490000000000000000000", {
      from: alice,
    });

    // --- TEST ---
    // price drops to 1ETH:100Bold, reducing TCR below 150%
    await priceFeed.setPrice("100000000000000000000");

    const recoveryMode = await th.checkRecoveryMode(contracts);
    assert.isTrue(recoveryMode);

    // Check Bob's Trove is active
    const bob_TroveStatus_Before = (await troveManager.Troves(bob))[3];
    const bob_Trove_isInSortedList_Before = await sortedTroves.contains(bob);

    assert.equal(bob_TroveStatus_Before, 1); // status enum element 1 corresponds to "Active"
    assert.isTrue(bob_Trove_isInSortedList_Before);

    // Try to liquidate Bob
    await assertRevert(
      troveManager.liquidate(bob, { from: owner }),
      "TroveManager: nothing to liquidate",
    );

    /* Since the pool only contains 100 Bold, and Bob's pre-liquidation debt was 250 Bold,
    expect Bob's trove to remain untouched, and remain active after liquidation */

    const bob_TroveStatus_After = (await troveManager.Troves(bob))[3];
    const bob_Trove_isInSortedList_After = await sortedTroves.contains(bob);

    assert.equal(bob_TroveStatus_After, 1); // status enum element 1 corresponds to "Active"
    assert.isTrue(bob_Trove_isInSortedList_After);
  });

  it("liquidate(), with ICR > 110%, and StabilityPool Bold < liquidated debt: Trove remains in TroveIds array", async () => {
    // --- SETUP ---
    // Alice withdraws up to 1500 Bold of debt, and Dennis up to 150, resulting in ICRs of 266%.
    // Bob withdraws up to 250 Bold of debt, resulting in ICR of 240%. Bob has lowest ICR.
    const { collateral: A_coll } = await openTrove({
      ICR: toBN(dec(266, 16)),
      extraBoldAmount: dec(1500, 18),
      extraParams: { from: alice },
    });
    const { collateral: B_coll } = await openTrove({
      ICR: toBN(dec(240, 16)),
      extraBoldAmount: dec(250, 18),
      extraParams: { from: bob },
    });
    const { collateral: D_coll } = await openTrove({
      ICR: toBN(dec(266, 16)),
      extraBoldAmount: dec(2000, 18),
      extraParams: { from: dennis },
    });

    // Alice deposits 100 Bold in the Stability Pool
    await stabilityPool.provideToSP(dec(100, 18), {
      from: alice,
    });

    // --- TEST ---
    // price drops to 1ETH:100Bold, reducing TCR below 150%
    await priceFeed.setPrice("100000000000000000000");

    const recoveryMode = await th.checkRecoveryMode(contracts);
    assert.isTrue(recoveryMode);

    // Check Bob's Trove is active
    const bob_TroveStatus_Before = (await troveManager.Troves(bob))[3];
    const bob_Trove_isInSortedList_Before = await sortedTroves.contains(bob);

    assert.equal(bob_TroveStatus_Before, 1); // status enum element 1 corresponds to "Active"
    assert.isTrue(bob_Trove_isInSortedList_Before);

    // Try to liquidate Bob
    await assertRevert(
      troveManager.liquidate(bob, { from: owner }),
      "TroveManager: nothing to liquidate",
    );

    /* Since the pool only contains 100 Bold, and Bob's pre-liquidation debt was 250 Bold,
    expect Bob's trove to only be partially offset, and remain active after liquidation */

    // Check Bob is in Trove owners array
    const arrayLength = (await troveManager.getTroveIdsCount()).toNumber();
    let addressFound = false;
    let addressIdx = 0;

    for (let i = 0; i < arrayLength; i++) {
      const address = (await troveManager.TroveIds(i)).toString();
      if (address == bob) {
        addressFound = true;
        addressIdx = i;
      }
    }

    assert.isTrue(addressFound);

    // Check TroveIds idx on trove struct == idx of address found in TroveIds array
    const idxOnStruct = (await troveManager.Troves(bob))[4].toString();
    assert.equal(addressIdx.toString(), idxOnStruct);
  });

  it("liquidate(), with ICR > 110%, and StabilityPool Bold < liquidated debt: nothing happens", async () => {
    // --- SETUP ---
    // Alice withdraws up to 1500 Bold of debt, and Dennis up to 150, resulting in ICRs of 266%.
    // Bob withdraws up to 250 Bold of debt, resulting in ICR of 240%. Bob has lowest ICR.
    const { collateral: A_coll } = await openTrove({
      ICR: toBN(dec(266, 16)),
      extraBoldAmount: dec(1500, 18),
      extraParams: { from: alice },
    });
    const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({
      ICR: toBN(dec(240, 16)),
      extraBoldAmount: dec(250, 18),
      extraParams: { from: bob },
    });
    const { collateral: D_coll } = await openTrove({
      ICR: toBN(dec(266, 16)),
      extraBoldAmount: dec(2000, 18),
      extraParams: { from: dennis },
    });

    // Alice deposits 100 Bold in the Stability Pool
    await stabilityPool.provideToSP(dec(100, 18), {
      from: alice,
    });

    // --- TEST ---
    // price drops to 1ETH:100Bold, reducing TCR below 150%
    await priceFeed.setPrice("100000000000000000000");

    const recoveryMode = await th.checkRecoveryMode(contracts);
    assert.isTrue(recoveryMode);

    // Try to liquidate Bob
    await assertRevert(
      troveManager.liquidate(bob, { from: owner }),
      "TroveManager: nothing to liquidate",
    );

    /*  Since Bob's debt (250 Bold) is larger than all Bold in the Stability Pool, Liquidation won’t happen

    After liquidation, totalStakes snapshot should equal Alice's stake (20 ether) + Dennis stake (2 ether) = 22 ether.

    Since there has been no redistribution, the totalCollateral snapshot should equal the totalStakes snapshot: 22 ether.

    Bob's new coll and stake should remain the same, and the updated totalStakes should still equal 25 ether.
    */
    const bob_Trove = await troveManager.Troves(bob);
    const bob_DebtAfter = bob_Trove[0].toString();
    const bob_CollAfter = bob_Trove[1].toString();
    const bob_StakeAfter = bob_Trove[2].toString();

    th.assertIsApproximatelyEqual(bob_DebtAfter, B_totalDebt);
    assert.equal(bob_CollAfter.toString(), B_coll);
    assert.equal(bob_StakeAfter.toString(), B_coll);

    const totalStakes_After = (await troveManager.totalStakes()).toString();
    assert.equal(totalStakes_After.toString(), A_coll.add(B_coll).add(D_coll));
  });

  it("liquidate(), with ICR > 110%, and StabilityPool Bold < liquidated debt: updates system shapshots", async () => {
    // --- SETUP ---
    // Alice withdraws up to 1500 Bold of debt, and Dennis up to 150, resulting in ICRs of 266%.
    // Bob withdraws up to 250 Bold of debt, resulting in ICR of 240%. Bob has lowest ICR.
    const { collateral: A_coll } = await openTrove({
      ICR: toBN(dec(266, 16)),
      extraBoldAmount: dec(1500, 18),
      extraParams: { from: alice },
    });
    const { collateral: B_coll } = await openTrove({
      ICR: toBN(dec(240, 16)),
      extraBoldAmount: dec(250, 18),
      extraParams: { from: bob },
    });
    const { collateral: D_coll } = await openTrove({
      ICR: toBN(dec(266, 16)),
      extraBoldAmount: dec(2000, 18),
      extraParams: { from: dennis },
    });

    // Alice deposits 100 Bold in the Stability Pool
    await stabilityPool.provideToSP(dec(100, 18), {
      from: alice,
    });

    // --- TEST ---
    // price drops to 1ETH:100Bold, reducing TCR below 150%
    await priceFeed.setPrice("100000000000000000000");

    const recoveryMode = await th.checkRecoveryMode(contracts);
    assert.isTrue(recoveryMode);

    // Check snapshots before
    const totalStakesSnaphot_Before = (
      await troveManager.totalStakesSnapshot()
    ).toString();
    const totalCollateralSnapshot_Before = (
      await troveManager.totalCollateralSnapshot()
    ).toString();

    assert.equal(totalStakesSnaphot_Before, 0);
    assert.equal(totalCollateralSnapshot_Before, 0);

    // Liquidate Bob, it won’t happen as there are no funds in the SP
    await assertRevert(
      troveManager.liquidate(bob, { from: owner }),
      "TroveManager: nothing to liquidate",
    );

    /* After liquidation, totalStakes snapshot should still equal the total stake: 25 ether

    Since there has been no redistribution, the totalCollateral snapshot should equal the totalStakes snapshot: 25 ether.*/

    const totalStakesSnaphot_After = (
      await troveManager.totalStakesSnapshot()
    ).toString();
    const totalCollateralSnapshot_After = (
      await troveManager.totalCollateralSnapshot()
    ).toString();

    assert.equal(totalStakesSnaphot_After, totalStakesSnaphot_Before);
    assert.equal(totalCollateralSnapshot_After, totalCollateralSnapshot_Before);
  });

  it("liquidate(), with ICR > 110%, and StabilityPool Bold < liquidated debt: causes correct Pool offset and ETH gain, and doesn't redistribute to active troves", async () => {
    // --- SETUP ---
    // Alice withdraws up to 1500 Bold of debt, and Dennis up to 150, resulting in ICRs of 266%.
    // Bob withdraws up to 250 Bold of debt, resulting in ICR of 240%. Bob has lowest ICR.
    const { collateral: A_coll } = await openTrove({
      ICR: toBN(dec(266, 16)),
      extraBoldAmount: dec(1500, 18),
      extraParams: { from: alice },
    });
    const { collateral: B_coll } = await openTrove({
      ICR: toBN(dec(240, 16)),
      extraBoldAmount: dec(250, 18),
      extraParams: { from: bob },
    });
    const { collateral: D_coll } = await openTrove({
      ICR: toBN(dec(266, 16)),
      extraBoldAmount: dec(2000, 18),
      extraParams: { from: dennis },
    });

    // Alice deposits 100 Bold in the Stability Pool
    await stabilityPool.provideToSP(dec(100, 18), {
      from: alice,
    });

    // --- TEST ---
    // price drops to 1ETH:100Bold, reducing TCR below 150%
    await priceFeed.setPrice("100000000000000000000");

    const recoveryMode = await th.checkRecoveryMode(contracts);
    assert.isTrue(recoveryMode);

    // Try to liquidate Bob. Shouldn’t happen
    await assertRevert(
      troveManager.liquidate(bob, { from: owner }),
      "TroveManager: nothing to liquidate",
    );

    // check Stability Pool rewards. Nothing happened, so everything should remain the same

    const aliceExpectedDeposit = await stabilityPool.getCompoundedBoldDeposit(
      alice,
    );
    const aliceExpectedETHGain = await stabilityPool.getDepositorETHGain(alice);

    assert.equal(aliceExpectedDeposit.toString(), dec(100, 18));
    assert.equal(aliceExpectedETHGain.toString(), "0");

    /* For this Recovery Mode test case with ICR > 110%, there should be no redistribution of remainder to active Troves.
    Redistribution rewards-per-unit-staked should be zero. */

    const L_boldDebt_After = (await troveManager.L_boldDebt()).toString();
    const L_ETH_After = (await troveManager.L_ETH()).toString();

    assert.equal(L_boldDebt_After, "0");
    assert.equal(L_ETH_After, "0");
  });

  it("liquidate(), with ICR > 110%, and StabilityPool Bold < liquidated debt: ICR of non liquidated trove does not change", async () => {
    // --- SETUP ---
    // Alice withdraws up to 1500 Bold of debt, and Dennis up to 150, resulting in ICRs of 266%.
    // Bob withdraws up to 250 Bold of debt, resulting in ICR of 240%. Bob has lowest ICR.
    // Carol withdraws up to debt of 240 Bold, -> ICR of 250%.
    const { collateral: A_coll } = await openTrove({
      ICR: toBN(dec(266, 16)),
      extraBoldAmount: dec(1500, 18),
      extraParams: { from: alice },
    });
    const { collateral: B_coll } = await openTrove({
      ICR: toBN(dec(240, 16)),
      extraBoldAmount: dec(250, 18),
      extraParams: { from: bob },
    });
    const { collateral: D_coll } = await openTrove({
      ICR: toBN(dec(266, 16)),
      extraBoldAmount: dec(2000, 18),
      extraParams: { from: dennis },
    });
    const { collateral: C_coll } = await openTrove({
      ICR: toBN(dec(250, 16)),
      extraBoldAmount: dec(240, 18),
      extraParams: { from: carol },
    });

    // Alice deposits 100 Bold in the Stability Pool
    await stabilityPool.provideToSP(dec(100, 18), {
      from: alice,
    });

    // --- TEST ---
    // price drops to 1ETH:100Bold, reducing TCR below 150%
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice();

    const bob_ICR_Before = (
      await troveManager.getCurrentICR(bob, price)
    ).toString();
    const carol_ICR_Before = (
      await troveManager.getCurrentICR(carol, price)
    ).toString();

    assert.isTrue(await th.checkRecoveryMode(contracts));

    const bob_Coll_Before = (await troveManager.Troves(bob))[1];
    const bob_Debt_Before = (await troveManager.Troves(bob))[0];

    // confirm Bob has >110% ICR
    assert.isTrue((await troveManager.getCurrentICR(bob, price)).gt(mv._MCR));

    // L1: Try to liquidate Bob. Nothing happens
    await assertRevert(
      troveManager.liquidate(bob, { from: owner }),
      "TroveManager: nothing to liquidate",
    );

    // Check SP Bold has been completely emptied
    assert.equal(
      (await stabilityPool.getTotalBoldDeposits()).toString(),
      dec(100, 18),
    );

    // Check Bob remains active
    assert.isTrue(await sortedTroves.contains(bob));

    // Check Bob's collateral and debt remains the same
    const bob_Coll_After = (await troveManager.Troves(bob))[1];
    const bob_Debt_After = (await troveManager.Troves(bob))[0];
    assert.isTrue(bob_Coll_After.eq(bob_Coll_Before));
    assert.isTrue(bob_Debt_After.eq(bob_Debt_Before));

    const bob_ICR_After = (
      await troveManager.getCurrentICR(bob, price)
    ).toString();

    // check Bob's ICR has not changed
    assert.equal(bob_ICR_After, bob_ICR_Before);

    // to compensate borrowing fees
    await boldToken.transfer(bob, dec(100, 18), { from: alice });

    // Remove Bob from system to test Carol's trove: price rises, Bob closes trove, price drops to 100 again
    await priceFeed.setPrice(dec(200, 18));
    await borrowerOperations.closeTrove({ from: bob });
    await priceFeed.setPrice(dec(100, 18));
    assert.isFalse(await sortedTroves.contains(bob));

    // Alice provides another 50 Bold to pool
    await stabilityPool.provideToSP(dec(50, 18), { from: alice });

    assert.isTrue(await th.checkRecoveryMode(contracts));

    const carol_Coll_Before = (await troveManager.Troves(carol))[1];
    const carol_Debt_Before = (await troveManager.Troves(carol))[0];

    // Confirm Carol has >110% ICR
    assert.isTrue((await troveManager.getCurrentICR(carol, price)).gt(mv._MCR));

    // L2: Try to liquidate Carol. Nothing happens
    await assertRevert(
      troveManager.liquidate(carol),
      "TroveManager: nothing to liquidate",
    );

    // Check SP Bold has been completely emptied
    assert.equal(
      (await stabilityPool.getTotalBoldDeposits()).toString(),
      dec(150, 18),
    );

    // Check Carol's collateral and debt remains the same
    const carol_Coll_After = (await troveManager.Troves(carol))[1];
    const carol_Debt_After = (await troveManager.Troves(carol))[0];
    assert.isTrue(carol_Coll_After.eq(carol_Coll_Before));
    assert.isTrue(carol_Debt_After.eq(carol_Debt_Before));

    const carol_ICR_After = (
      await troveManager.getCurrentICR(carol, price)
    ).toString();

    // check Carol's ICR has not changed
    assert.equal(carol_ICR_After, carol_ICR_Before);

    // Confirm liquidations have not led to any redistributions to troves
    const L_boldDebt_After = (await troveManager.L_boldDebt()).toString();
    const L_ETH_After = (await troveManager.L_ETH()).toString();

    assert.equal(L_boldDebt_After, "0");
    assert.equal(L_ETH_After, "0");
  });

  it("liquidate() with ICR > 110%, and StabilityPool Bold < liquidated debt: total liquidated coll and debt is correct", async () => {
    // Whale provides 50 Bold to the SP
    await openTrove({
      ICR: toBN(dec(300, 16)),
      extraBoldAmount: dec(50, 18),
      extraParams: { from: whale },
    });
    await stabilityPool.provideToSP(dec(50, 18), { from: whale });

    const { collateral: A_coll } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraParams: { from: alice },
    });
    const { collateral: B_coll } = await openTrove({
      ICR: toBN(dec(202, 16)),
      extraParams: { from: bob },
    });
    const { collateral: C_coll } = await openTrove({
      ICR: toBN(dec(204, 16)),
      extraParams: { from: carol },
    });
    const { collateral: D_coll } = await openTrove({
      ICR: toBN(dec(206, 16)),
      extraParams: { from: dennis },
    });
    const { collateral: E_coll } = await openTrove({
      ICR: toBN(dec(208, 16)),
      extraParams: { from: erin },
    });

    // Price drops
    await priceFeed.setPrice(dec(120, 18));
    const price = await priceFeed.getPrice();

    // Check Recovery Mode is active
    assert.isTrue(await th.checkRecoveryMode(contracts));

    // Check C is in range 110% < ICR < 150%
    const ICR_A = await troveManager.getCurrentICR(alice, price);
    assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(await th.getTCR(contracts)));

    const entireSystemCollBefore = await troveManager.getEntireSystemColl();
    const entireSystemDebtBefore = await troveManager.getEntireSystemDebt();

    // Try to liquidate Alice
    await assertRevert(
      troveManager.liquidate(alice),
      "TroveManager: nothing to liquidate",
    );

    // Expect system debt and system coll not reduced
    const entireSystemCollAfter = await troveManager.getEntireSystemColl();
    const entireSystemDebtAfter = await troveManager.getEntireSystemDebt();

    const changeInEntireSystemColl = entireSystemCollBefore.sub(
      entireSystemCollAfter,
    );
    const changeInEntireSystemDebt = entireSystemDebtBefore.sub(
      entireSystemDebtAfter,
    );

    assert.equal(changeInEntireSystemColl, "0");
    assert.equal(changeInEntireSystemDebt, "0");
  });

  // ---

  it("liquidate(): Doesn't liquidate undercollateralized trove if it is the only trove in the system", async () => {
    // Alice creates a single trove with 0.62 ETH and a debt of 62 Bold, and provides 10 Bold to SP
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: alice } });
    await stabilityPool.provideToSP(dec(10, 18), { from: alice });

    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Set ETH:USD price to 105
    await priceFeed.setPrice("105000000000000000000");
    const price = await priceFeed.getPrice();

    assert.isTrue(await th.checkRecoveryMode(contracts));

    const alice_ICR = (
      await troveManager.getCurrentICR(alice, price)
    ).toString();
    assert.equal(alice_ICR, "1050000000000000000");

    const activeTrovesCount_Before = await troveManager.getTroveIdsCount();

    assert.equal(activeTrovesCount_Before, 1);

    // Try to liquidate the trove
    await assertRevert(
      troveManager.liquidate(alice, { from: owner }),
      "TroveManager: nothing to liquidate",
    );

    // Check Alice's trove has not been removed
    const activeTrovesCount_After = await troveManager.getTroveIdsCount();
    assert.equal(activeTrovesCount_After, 1);

    const alice_isInSortedList = await sortedTroves.contains(alice);
    assert.isTrue(alice_isInSortedList);
  });

  it("liquidate(): Liquidates undercollateralized trove if there are two troves in the system", async () => {
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: bob } });

    // Alice creates a single trove with 0.62 ETH and a debt of 62 Bold, and provides 10 Bold to SP
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: alice } });

    // Alice proves 10 Bold to SP
    await stabilityPool.provideToSP(dec(10, 18), { from: alice });

    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Set ETH:USD price to 105
    await priceFeed.setPrice("105000000000000000000");
    const price = await priceFeed.getPrice();

    assert.isTrue(await th.checkRecoveryMode(contracts));

    const alice_ICR = (
      await troveManager.getCurrentICR(alice, price)
    ).toString();
    assert.equal(alice_ICR, "1050000000000000000");

    const activeTrovesCount_Before = await troveManager.getTroveIdsCount();

    assert.equal(activeTrovesCount_Before, 2);

    // Liquidate the trove
    await troveManager.liquidate(alice, { from: owner });

    // Check Alice's trove is removed, and bob remains
    const activeTrovesCount_After = await troveManager.getTroveIdsCount();
    assert.equal(activeTrovesCount_After, 1);

    const alice_isInSortedList = await sortedTroves.contains(alice);
    assert.isFalse(alice_isInSortedList);

    const bob_isInSortedList = await sortedTroves.contains(bob);
    assert.isTrue(bob_isInSortedList);
  });

  it("liquidate(): does nothing if trove has >= 110% ICR and the Stability Pool is empty", async () => {
    await openTrove({ ICR: toBN(dec(400, 16)), extraParams: { from: alice } });
    await openTrove({ ICR: toBN(dec(220, 16)), extraParams: { from: bob } });
    await openTrove({ ICR: toBN(dec(266, 16)), extraParams: { from: carol } });

    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice();

    const TCR_Before = (await th.getTCR(contracts)).toString();
    const listSize_Before = (await sortedTroves.getSize()).toString();

    // Confirm Recovery Mode
    assert.isTrue(await th.checkRecoveryMode(contracts));

    // Check Bob's ICR > 110%
    const bob_ICR = await troveManager.getCurrentICR(bob, price);
    assert.isTrue(bob_ICR.gte(mv._MCR));

    // Confirm SP is empty
    const BoldinSP = (await stabilityPool.getTotalBoldDeposits()).toString();
    assert.equal(BoldinSP, "0");

    // Attempt to liquidate bob
    await assertRevert(
      troveManager.liquidate(bob),
      "TroveManager: nothing to liquidate",
    );

    // check A, B, C remain active
    assert.isTrue(await sortedTroves.contains(bob));
    assert.isTrue(await sortedTroves.contains(alice));
    assert.isTrue(await sortedTroves.contains(carol));

    const TCR_After = (await th.getTCR(contracts)).toString();
    const listSize_After = (await sortedTroves.getSize()).toString();

    // Check TCR and list size have not changed
    assert.equal(TCR_Before, TCR_After);
    assert.equal(listSize_Before, listSize_After);
  });

  it("liquidate(): does nothing if trove ICR >= TCR, and SP covers trove's debt", async () => {
    await openTrove({ ICR: toBN(dec(166, 16)), extraParams: { from: A } });
    await openTrove({ ICR: toBN(dec(154, 16)), extraParams: { from: B } });
    await openTrove({ ICR: toBN(dec(142, 16)), extraParams: { from: C } });

    // C fills SP with 130 Bold
    await stabilityPool.provideToSP(dec(130, 18), { from: C });

    await priceFeed.setPrice(dec(150, 18));
    const price = await priceFeed.getPrice();
    assert.isTrue(await th.checkRecoveryMode(contracts));

    const TCR = await th.getTCR(contracts);

    const ICR_A = await troveManager.getCurrentICR(A, price);
    const ICR_B = await troveManager.getCurrentICR(B, price);
    const ICR_C = await troveManager.getCurrentICR(C, price);

    assert.isTrue(ICR_A.gt(TCR));
    // Try to liquidate A
    await assertRevert(
      troveManager.liquidate(A),
      "TroveManager: nothing to liquidate",
    );

    // Check liquidation of A does nothing - trove remains in system
    assert.isTrue(await sortedTroves.contains(A));
    assert.equal(await troveManager.getTroveStatus(A), 1); // Status 1 -> active

    // Check C, with ICR < TCR, can be liquidated
    assert.isTrue(ICR_C.lt(TCR));
    const liqTxC = await troveManager.liquidate(C);
    assert.isTrue(liqTxC.receipt.status);

    assert.isFalse(await sortedTroves.contains(C));
    assert.equal(await troveManager.getTroveStatus(C), 3); // Status liquidated
  });

  it("liquidate(): reverts if trove is non-existent", async () => {
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: alice } });
    await openTrove({ ICR: toBN(dec(133, 16)), extraParams: { from: bob } });

    await priceFeed.setPrice(dec(100, 18));

    // Confirm Recovery Mode
    assert.isTrue(await th.checkRecoveryMode(contracts));

    // Check Carol does not have an existing trove
    assert.equal(await troveManager.getTroveStatus(carol), 0);
    assert.isFalse(await sortedTroves.contains(carol));

    try {
      await troveManager.liquidate(carol);

      assert.isFalse(txCarol.receipt.status);
    } catch (err) {
      assert.include(err.message, "revert");
    }
  });

  it("liquidate(): reverts if trove has been closed", async () => {
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: alice } });
    await openTrove({ ICR: toBN(dec(133, 16)), extraParams: { from: bob } });
    await openTrove({ ICR: toBN(dec(133, 16)), extraParams: { from: carol } });

    assert.isTrue(await sortedTroves.contains(carol));

    // Price drops, Carol ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18));

    // Confirm Recovery Mode
    assert.isTrue(await th.checkRecoveryMode(contracts));

    // Carol liquidated, and her trove is closed
    const txCarol_L1 = await troveManager.liquidate(carol);
    assert.isTrue(txCarol_L1.receipt.status);

    // Check Carol's trove is closed by liquidation
    assert.isFalse(await sortedTroves.contains(carol));
    assert.equal(await troveManager.getTroveStatus(carol), 3);

    try {
      await troveManager.liquidate(carol);
    } catch (err) {
      assert.include(err.message, "revert");
    }
  });

  it("liquidate(): liquidates based on entire/collateral debt (including pending rewards), not raw collateral/debt", async () => {
    await openTrove({ ICR: toBN(dec(400, 16)), extraParams: { from: alice } });
    await openTrove({ ICR: toBN(dec(220, 16)), extraParams: { from: bob } });
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: carol } });

    // Defaulter opens with 60 Bold, 0.6 ETH
    await openTrove({
      ICR: toBN(dec(200, 16)),
      extraParams: { from: defaulter_1 },
    });

    // Price drops
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice();

    // Confirm Recovery Mode
    assert.isTrue(await th.checkRecoveryMode(contracts));

    const alice_ICR_Before = await troveManager.getCurrentICR(alice, price);
    const bob_ICR_Before = await troveManager.getCurrentICR(bob, price);
    const carol_ICR_Before = await troveManager.getCurrentICR(carol, price);

    /* Before liquidation:
    Alice ICR: = (1 * 100 / 50) = 200%
    Bob ICR: (1 * 100 / 90.5) = 110.5%
    Carol ICR: (1 * 100 / 100 ) =  100%

    Therefore Alice and Bob above the MCR, Carol is below */
    assert.isTrue(alice_ICR_Before.gte(mv._MCR));
    assert.isTrue(bob_ICR_Before.gte(mv._MCR));
    assert.isTrue(carol_ICR_Before.lte(mv._MCR));

    // Liquidate defaulter. 30 Bold and 0.3 ETH is distributed uniformly between A, B and C. Each receive 10 Bold, 0.1 ETH
    await troveManager.liquidate(defaulter_1);

    const alice_ICR_After = await troveManager.getCurrentICR(alice, price);
    const bob_ICR_After = await troveManager.getCurrentICR(bob, price);
    const carol_ICR_After = await troveManager.getCurrentICR(carol, price);

    /* After liquidation:

    Alice ICR: (1.1 * 100 / 60) = 183.33%
    Bob ICR:(1.1 * 100 / 100.5) =  109.45%
    Carol ICR: (1.1 * 100 ) 100%

    Check Alice is above MCR, Bob below, Carol below. */
    assert.isTrue(alice_ICR_After.gte(mv._MCR));
    assert.isTrue(bob_ICR_After.lte(mv._MCR));
    assert.isTrue(carol_ICR_After.lte(mv._MCR));

    /* Though Bob's true ICR (including pending rewards) is below the MCR,
    check that Bob's raw coll and debt has not changed, and that his "raw" ICR is above the MCR */
    const bob_Coll = (await troveManager.Troves(bob))[1];
    const bob_Debt = (await troveManager.Troves(bob))[0];

    const bob_rawICR = bob_Coll.mul(th.toBN(dec(100, 18))).div(bob_Debt);
    assert.isTrue(bob_rawICR.gte(mv._MCR));

    // liquidate A, B, C
    await assertRevert(
      troveManager.liquidate(alice),
      "TroveManager: nothing to liquidate",
    );
    await troveManager.liquidate(bob);
    await troveManager.liquidate(carol);

    /*  Since there is 0 Bold in the stability Pool, A, with ICR >110%, should stay active.
    Check Alice stays active, Carol gets liquidated, and Bob gets liquidated
    (because his pending rewards bring his ICR < MCR) */
    assert.isTrue(await sortedTroves.contains(alice));
    assert.isFalse(await sortedTroves.contains(bob));
    assert.isFalse(await sortedTroves.contains(carol));

    // check trove statuses - A active (1), B and C liquidated (3)
    assert.equal((await troveManager.Troves(alice))[3].toString(), "1");
    assert.equal((await troveManager.Troves(bob))[3].toString(), "3");
    assert.equal((await troveManager.Troves(carol))[3].toString(), "3");
  });

  it("liquidate(): does not affect the SP deposit or ETH gain when called on an SP depositor's address that has no trove", async () => {
    const { collateral: C_coll, totalDebt: C_totalDebt } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraParams: { from: carol },
    });
    const spDeposit = C_totalDebt.add(toBN(dec(1000, 18)));
    await openTrove({
      ICR: toBN(dec(220, 16)),
      extraBoldAmount: spDeposit,
      extraParams: { from: bob },
    });

    // Bob sends tokens to Dennis, who has no trove
    await boldToken.transfer(dennis, spDeposit, { from: bob });

    // Dennis provides 200 Bold to SP
    await stabilityPool.provideToSP(spDeposit, { from: dennis });

    // Price drop
    await priceFeed.setPrice(dec(105, 18));

    // Confirm Recovery Mode
    assert.isTrue(await th.checkRecoveryMode(contracts));

    // Carol gets liquidated
    await troveManager.liquidate(carol);

    // Check Dennis' SP deposit has absorbed Carol's debt, and he has received her liquidated ETH
    const dennis_Deposit_Before = (
      await stabilityPool.getCompoundedBoldDeposit(dennis)
    ).toString();
    const dennis_ETHGain_Before = (
      await stabilityPool.getDepositorETHGain(dennis)
    ).toString();
    assert.isAtMost(
      th.getDifference(dennis_Deposit_Before, spDeposit.sub(C_totalDebt)),
      1000,
    );
    assert.isAtMost(
      th.getDifference(dennis_ETHGain_Before, th.applyLiquidationFee(C_coll)),
      1000,
    );

    // Attempt to liquidate Dennis
    try {
      await troveManager.liquidate(dennis);
    } catch (err) {
      assert.include(err.message, "revert");
    }

    // Check Dennis' SP deposit does not change after liquidation attempt
    const dennis_Deposit_After = (
      await stabilityPool.getCompoundedBoldDeposit(dennis)
    ).toString();
    const dennis_ETHGain_After = (
      await stabilityPool.getDepositorETHGain(dennis)
    ).toString();
    assert.equal(dennis_Deposit_Before, dennis_Deposit_After);
    assert.equal(dennis_ETHGain_Before, dennis_ETHGain_After);
  });

  it("liquidate(): does not alter the liquidated user's token balance", async () => {
    await openTrove({
      ICR: toBN(dec(220, 16)),
      extraBoldAmount: dec(1000, 18),
      extraParams: { from: whale },
    });

    const { boldAmount: A_boldAmount } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraBoldAmount: dec(300, 18),
      extraParams: { from: alice },
    });
    const { boldAmount: B_boldAmount } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraBoldAmount: dec(200, 18),
      extraParams: { from: bob },
    });
    const { boldAmount: C_boldAmount } = await openTrove({
      ICR: toBN(dec(206, 16)),
      extraBoldAmount: dec(100, 18),
      extraParams: { from: carol },
    });

    await priceFeed.setPrice(dec(105, 18));

    // Confirm Recovery Mode
    assert.isTrue(await th.checkRecoveryMode(contracts));

    // Check token balances
    assert.equal((await boldToken.balanceOf(alice)).toString(), A_boldAmount);
    assert.equal((await boldToken.balanceOf(bob)).toString(), B_boldAmount);
    assert.equal((await boldToken.balanceOf(carol)).toString(), C_boldAmount);

    // Check sortedList size is 4
    assert.equal((await sortedTroves.getSize()).toString(), "4");

    // Liquidate A, B and C
    await troveManager.liquidate(alice);
    await troveManager.liquidate(bob);
    await troveManager.liquidate(carol);

    // Confirm A, B, C closed
    assert.isFalse(await sortedTroves.contains(alice));
    assert.isFalse(await sortedTroves.contains(bob));
    assert.isFalse(await sortedTroves.contains(carol));

    // Check sortedList size reduced to 1
    assert.equal((await sortedTroves.getSize()).toString(), "1");

    // Confirm token balances have not changed
    assert.equal((await boldToken.balanceOf(alice)).toString(), A_boldAmount);
    assert.equal((await boldToken.balanceOf(bob)).toString(), B_boldAmount);
    assert.equal((await boldToken.balanceOf(carol)).toString(), C_boldAmount);
  });

  // TODO: test relies on specific redemption behavior, so rewrite in Solidity after we've finalized new redemption logic
  it.skip("liquidate(), with 110% < ICR < TCR, can claim collateral, re-open, be reedemed and claim again", async () => {
    // --- SETUP ---
    // Alice withdraws up to 1500 Bold of debt, resulting in ICRs of 266%.
    // Bob withdraws up to 480 Bold of debt, resulting in ICR of 240%. Bob has lowest interest rate.
    const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({
      ICR: toBN(dec(240, 16)),
      extraBoldAmount: dec(480, 18),
      extraParams: { from: bob, annualInterestRate: 0 },
    });
    const { collateral: A_coll } = await openTrove({
      ICR: toBN(dec(266, 16)),
      extraBoldAmount: B_totalDebt,
      extraParams: { from: alice },
      annualInterestRate: th.toBN(dec(5, 17)), // 50% interest rate
    });

    // Alice deposits Bold in the Stability Pool
    await stabilityPool.provideToSP(B_totalDebt, { from: alice });

    // --- TEST ---
    // price drops to 1ETH:100Bold, reducing TCR below 150%
    await priceFeed.setPrice("100000000000000000000");
    let price = await priceFeed.getPrice();
    const TCR = await th.getTCR(contracts);

    const recoveryMode = await th.checkRecoveryMode(contracts);
    assert.isTrue(recoveryMode);

    // Check Bob's ICR is between 110 and TCR
    const bob_ICR = await troveManager.getCurrentICR(bob, price);
    assert.isTrue(bob_ICR.gt(mv._MCR) && bob_ICR.lt(TCR));

    // Liquidate Bob
    await troveManager.liquidate(bob, { from: owner });

    // check Bob’s collateral surplus: 5.76 * 100 - 480 * 1.1
    const bob_remainingCollateral = B_coll.sub(
      B_totalDebt.mul(th.toBN(dec(11, 17))).div(price),
    );
    th.assertIsApproximatelyEqual(
      await collSurplusPool.getCollateral(bob),
      bob_remainingCollateral,
    );
    // can claim collateral
    const bob_balanceBefore = th.toBN(await contracts.WETH.balanceOf(bob));
    await borrowerOperations.claimCollateral({ from: bob });
    const bob_balanceAfter = th.toBN(await contracts.WETH.balanceOf(bob));
    th.assertIsApproximatelyEqual(
      bob_balanceAfter,
      bob_balanceBefore.add(th.toBN(bob_remainingCollateral)),
    );

    // skip bootstrapping phase
    await time.increase(timeValues.SECONDS_IN_ONE_WEEK * 2);

    // Bob re-opens the trove, price 200, total debt 80 Bold, ICR = 120%, 0 interest rate (lowest one)
    // Dennis redeems 30, so Bob has a surplus of (200 * 0.48 - 30) / 200 = 0.33 ETH
    await priceFeed.setPrice("200000000000000000000");
    const { collateral: B_coll_2, netDebt: B_netDebt_2 } = await openTrove({
      ICR: toBN(dec(150, 16)),
      extraBoldAmount: dec(480, 18),
      extraParams: { from: bob, value: bob_remainingCollateral, annualInterestRate: 0 },
    });
    const { collateral: D_coll } = await openTrove({
      ICR: toBN(dec(266, 16)),
      extraBoldAmount: B_netDebt_2,
      extraParams: { from: dennis },
      annualInterestRate: th.toBN(dec(5, 17)),
    });
    await th.redeemCollateral(dennis, contracts, B_netDebt_2);
    price = await priceFeed.getPrice();
    const bob_surplus = B_coll_2.sub(B_netDebt_2.mul(mv._1e18BN).div(price));
    th.assertIsApproximatelyEqual(
      await collSurplusPool.getCollateral(bob),
      bob_surplus,
    );
    // can claim collateral
    const bob_balanceBefore_2 = th.toBN(await contracts.WETH.balanceOf(bob));
    await borrowerOperations.claimCollateral({ from: bob });
    const bob_balanceAfter_2 = th.toBN(await contracts.WETH.balanceOf(bob));
    th.assertIsApproximatelyEqual(
      bob_balanceAfter_2,
      bob_balanceBefore_2.add(th.toBN(bob_surplus)),
    );
  });

  // TODO: Reassess this test once interest is correctly applied in redemptions
  it.skip("liquidate(), with 110% < ICR < TCR, can claim collateral, after another claim from a redemption", async () => {
    // --- SETUP ---
    // Bob withdraws up to 90 Bold of debt, resulting in ICR of 222%
    const { collateral: B_coll, netDebt: B_netDebt } = await openTrove({
      ICR: toBN(dec(222, 16)),
      extraBoldAmount: dec(90, 18),
      extraParams: { from: bob, annualInterestRate: toBN(dec(5, 16)) }, // 5% interest (lowest)
    });
    let price = await priceFeed.getPrice();
    th.logBN("bob ICR start", await troveManager.getCurrentICR(bob, price));

    // Dennis withdraws to 150 Bold of debt, resulting in ICRs of 266%.
    const { collateral: D_coll } = await openTrove({
      ICR: toBN(dec(266, 16)),
      extraBoldAmount: B_netDebt,
      extraParams: { from: dennis, annualInterestRate: toBN(dec(10, 16)) }, // 10% interest
    });

    // --- TEST ---
    // skip bootstrapping phase
    await time.increase(timeValues.SECONDS_IN_ONE_WEEK * 2);

    // Dennis redeems 40, hits Bob (lowest ICR) so Bob has a surplus of (200 * 1 - 40) / 200 = 0.8 ETH
    await th.redeemCollateral(dennis, contracts, B_netDebt);
    price = await priceFeed.getPrice();
    const bob_surplus = B_coll.sub(B_netDebt.mul(mv._1e18BN).div(price));
    th.assertIsApproximatelyEqual(
      await collSurplusPool.getCollateral(bob),
      bob_surplus,
    );

    // can claim collateral
    const bob_balanceBefore = th.toBN(await contracts.WETH.balanceOf(bob));
    await borrowerOperations.claimCollateral({ from: bob });
    const bob_balanceAfter = th.toBN(await contracts.WETH.balanceOf(bob));
    th.assertIsApproximatelyEqual(
      bob_balanceAfter,
      bob_balanceBefore.add(bob_surplus),
    );

    // Bob re-opens the trove, price 200, total debt 250 Bold, interest = 5% (lowest one)
    const { collateral: B_coll_2, totalDebt: B_totalDebt_2 } = await openTrove({
      ICR: toBN(dec(240, 16)),
      extraParams: { from: bob, value: _3_Ether, annualInterestRate: th.toBN(dec(5, 16)) },
    });
    // Alice opens (20 % interest, highest) and deposits Bold in the Stability Pool
    await openTrove({
      ICR: toBN(dec(266, 16)),
      extraBoldAmount: B_totalDebt_2,
      extraParams: { from: alice, annualInterestRate: th.toBN(dec(20, 16)) },
    });
    await stabilityPool.provideToSP(B_totalDebt_2, {
      from: alice,
    });

    // price drops to 1ETH:100Bold, reducing TCR below 150%
    await priceFeed.setPrice("100000000000000000000");
    price = await priceFeed.getPrice();
    const TCR = await th.getTCR(contracts);
    th.logBN("TCR", TCR);

    const recoveryMode = await th.checkRecoveryMode(contracts);
    assert.isTrue(recoveryMode);

    // Check Bob's ICR is between 110 and TCR
    const bob_ICR = await troveManager.getCurrentICR(bob, price);
    th.logBN("bob_ICR", bob_ICR);
    assert.isTrue(bob_ICR.gt(mv._MCR) && bob_ICR.lt(TCR));
    // debt is increased by fee, due to previous redemption
    const bob_debt = await troveManager.getTroveDebt(bob);

    // Liquidate Bob
    await troveManager.liquidate(bob, { from: owner });

    // check Bob’s collateral surplus
    const bob_remainingCollateral = B_coll_2.sub(
      B_totalDebt_2.mul(th.toBN(dec(11, 17))).div(price),
    );
    th.assertIsApproximatelyEqual(
      (await collSurplusPool.getCollateral(bob)).toString(),
      bob_remainingCollateral.toString(),
    );

    // can claim collateral
    const bob_balanceBefore_2 = th.toBN(await contracts.WETH.balanceOf(bob));
    await borrowerOperations.claimCollateral({ from: bob });
    const bob_balanceAfter_2 = th.toBN(await contracts.WETH.balanceOf(bob));
    th.assertIsApproximatelyEqual(
      bob_balanceAfter_2,
      bob_balanceBefore_2.add(th.toBN(bob_remainingCollateral)),
    );
  });

  // --- batchLiquidateTroves() ---

  it("batchLiquidateTroves(): Liquidates all troves with ICR < 110%, transitioning Normal -> Recovery Mode", async () => {
    // make 6 Troves accordingly
    // --- SETUP ---
    const { totalDebt: B_totalDebt } = await openTrove({
      ICR: toBN(dec(240, 16)),
      extraParams: { from: bob },
    });
    const { totalDebt: C_totalDebt } = await openTrove({
      ICR: toBN(dec(240, 16)),
      extraParams: { from: carol },
    });
    const { totalDebt: D_totalDebt } = await openTrove({
      ICR: toBN(dec(230, 16)),
      extraParams: { from: dennis },
    });
    const { totalDebt: E_totalDebt } = await openTrove({
      ICR: toBN(dec(240, 16)),
      extraParams: { from: erin },
    });
    const { totalDebt: F_totalDebt } = await openTrove({
      ICR: toBN(dec(240, 16)),
      extraParams: { from: freddy },
    });

    const spDeposit = B_totalDebt.add(C_totalDebt)
      .add(D_totalDebt)
      .add(E_totalDebt)
      .add(F_totalDebt);
    await openTrove({
      ICR: toBN(dec(426, 16)),
      extraBoldAmount: spDeposit,
      extraParams: { from: alice },
    });

    // Alice deposits Bold to Stability Pool
    await stabilityPool.provideToSP(spDeposit, { from: alice });

    // price drops to 1ETH:85Bold, reducing TCR below 150%
    await priceFeed.setPrice("85000000000000000000");
    const price = await priceFeed.getPrice();

    // check Recovery Mode kicks in

    const recoveryMode_Before = await th.checkRecoveryMode(contracts);
    assert.isTrue(recoveryMode_Before);

    // check TCR < 150%
    const _150percent = web3.utils.toBN("1500000000000000000");
    const TCR_Before = await th.getTCR(contracts);
    assert.isTrue(TCR_Before.lt(_150percent));

    /*
    After the price drop and prior to any liquidations, ICR should be:

    Trove         ICR
    Alice       182%
    Bob         102%
    Carol       102%
    Dennis      102%
    Elisa       102%
    Freddy      102%
    */
    alice_ICR = await troveManager.getCurrentICR(alice, price);
    bob_ICR = await troveManager.getCurrentICR(bob, price);
    carol_ICR = await troveManager.getCurrentICR(carol, price);
    dennis_ICR = await troveManager.getCurrentICR(dennis, price);
    erin_ICR = await troveManager.getCurrentICR(erin, price);
    freddy_ICR = await troveManager.getCurrentICR(freddy, price);

    // Alice should have ICR > 150%
    assert.isTrue(alice_ICR.gt(_150percent));
    // All other Troves should have ICR < 150%
    assert.isTrue(carol_ICR.lt(_150percent));
    assert.isTrue(dennis_ICR.lt(_150percent));
    assert.isTrue(erin_ICR.lt(_150percent));
    assert.isTrue(freddy_ICR.lt(_150percent));

    /* After liquidating Bob and Carol, the the TCR of the system rises above the CCR, to 154%.
    (see calculations in Google Sheet)

    Liquidations continue until all Troves with ICR < MCR have been closed.
    Only Alice should remain active - all others should be closed. */

    // call batchLiquidateTroves
    await troveManager.batchLiquidateTroves([
      alice,
      bob,
      carol,
      dennis,
      erin,
      freddy,
    ]);

    // check system is no longer in Recovery Mode
    const recoveryMode_After = await th.checkRecoveryMode(contracts);
    assert.isFalse(recoveryMode_After);

    // After liquidation, TCR should rise to above 150%.
    const TCR_After = await th.getTCR(contracts);
    assert.isTrue(TCR_After.gt(_150percent));

    // get all Troves
    const alice_Trove = await troveManager.Troves(alice);
    const bob_Trove = await troveManager.Troves(bob);
    const carol_Trove = await troveManager.Troves(carol);
    const dennis_Trove = await troveManager.Troves(dennis);
    const erin_Trove = await troveManager.Troves(erin);
    const freddy_Trove = await troveManager.Troves(freddy);

    // check that Alice's Trove remains active
    assert.equal(alice_Trove[3], 1);
    assert.isTrue(await sortedTroves.contains(alice));

    // check all other Troves are liquidated
    assert.equal(bob_Trove[3], 3);
    assert.equal(carol_Trove[3], 3);
    assert.equal(dennis_Trove[3], 3);
    assert.equal(erin_Trove[3], 3);
    assert.equal(freddy_Trove[3], 3);

    assert.isFalse(await sortedTroves.contains(bob));
    assert.isFalse(await sortedTroves.contains(carol));
    assert.isFalse(await sortedTroves.contains(dennis));
    assert.isFalse(await sortedTroves.contains(erin));
    assert.isFalse(await sortedTroves.contains(freddy));
  });

  it("batchLiquidateTroves(): Liquidates all troves with ICR < 110%, transitioning Recovery -> Normal Mode", async () => {
    /* This is essentially the same test as before, but changing the order of the batch,
     * now the remaining trove (alice) goes at the end.
     * This way alice will be skipped in a different part of the code, as in the previous test,
     * when attempting alice the system was in Recovery mode, while in this test,
     * when attempting alice the system has gone back to Normal mode
     * (see function `_getTotalFromBatchLiquidate_RecoveryMode`)
     */
    // make 6 Troves accordingly
    // --- SETUP ---

    const { totalDebt: B_totalDebt } = await openTrove({
      ICR: toBN(dec(240, 16)),
      extraParams: { from: bob },
    });
    const { totalDebt: C_totalDebt } = await openTrove({
      ICR: toBN(dec(240, 16)),
      extraParams: { from: carol },
    });
    const { totalDebt: D_totalDebt } = await openTrove({
      ICR: toBN(dec(230, 16)),
      extraParams: { from: dennis },
    });
    const { totalDebt: E_totalDebt } = await openTrove({
      ICR: toBN(dec(240, 16)),
      extraParams: { from: erin },
    });
    const { totalDebt: F_totalDebt } = await openTrove({
      ICR: toBN(dec(240, 16)),
      extraParams: { from: freddy },
    });

    const spDeposit = B_totalDebt.add(C_totalDebt)
      .add(D_totalDebt)
      .add(E_totalDebt)
      .add(F_totalDebt);
    await openTrove({
      ICR: toBN(dec(426, 16)),
      extraBoldAmount: spDeposit,
      extraParams: { from: alice },
    });

    // Alice deposits Bold to Stability Pool
    await stabilityPool.provideToSP(spDeposit, { from: alice });

    // price drops to 1ETH:85Bold, reducing TCR below 150%
    await priceFeed.setPrice("85000000000000000000");
    const price = await priceFeed.getPrice();

    // check Recovery Mode kicks in

    const recoveryMode_Before = await th.checkRecoveryMode(contracts);
    assert.isTrue(recoveryMode_Before);

    // check TCR < 150%
    const _150percent = web3.utils.toBN("1500000000000000000");
    const TCR_Before = await th.getTCR(contracts);
    assert.isTrue(TCR_Before.lt(_150percent));

    /*
    After the price drop and prior to any liquidations, ICR should be:

    Trove         ICR
    Alice       182%
    Bob         102%
    Carol       102%
    Dennis      102%
    Elisa       102%
    Freddy      102%
    */
    const alice_ICR = await troveManager.getCurrentICR(alice, price);
    const bob_ICR = await troveManager.getCurrentICR(bob, price);
    const carol_ICR = await troveManager.getCurrentICR(carol, price);
    const dennis_ICR = await troveManager.getCurrentICR(dennis, price);
    const erin_ICR = await troveManager.getCurrentICR(erin, price);
    const freddy_ICR = await troveManager.getCurrentICR(freddy, price);

    // Alice should have ICR > 150%
    assert.isTrue(alice_ICR.gt(_150percent));
    // All other Troves should have ICR < 150%
    assert.isTrue(carol_ICR.lt(_150percent));
    assert.isTrue(dennis_ICR.lt(_150percent));
    assert.isTrue(erin_ICR.lt(_150percent));
    assert.isTrue(freddy_ICR.lt(_150percent));

    /* After liquidating Bob and Carol, the the TCR of the system rises above the CCR, to 154%.
    (see calculations in Google Sheet)

    Liquidations continue until all Troves with ICR < MCR have been closed.
    Only Alice should remain active - all others should be closed. */

    // call batchLiquidateTroves
    await troveManager.batchLiquidateTroves([
      bob,
      carol,
      dennis,
      erin,
      freddy,
      alice,
    ]);

    // check system is no longer in Recovery Mode
    const recoveryMode_After = await th.checkRecoveryMode(contracts);
    assert.isFalse(recoveryMode_After);

    // After liquidation, TCR should rise to above 150%.
    const TCR_After = await th.getTCR(contracts);
    assert.isTrue(TCR_After.gt(_150percent));

    // get all Troves
    const alice_Trove = await troveManager.Troves(alice);
    const bob_Trove = await troveManager.Troves(bob);
    const carol_Trove = await troveManager.Troves(carol);
    const dennis_Trove = await troveManager.Troves(dennis);
    const erin_Trove = await troveManager.Troves(erin);
    const freddy_Trove = await troveManager.Troves(freddy);

    // check that Alice's Trove remains active
    assert.equal(alice_Trove[3], 1);
    assert.isTrue(await sortedTroves.contains(alice));

    // check all other Troves are liquidated
    assert.equal(bob_Trove[3], 3);
    assert.equal(carol_Trove[3], 3);
    assert.equal(dennis_Trove[3], 3);
    assert.equal(erin_Trove[3], 3);
    assert.equal(freddy_Trove[3], 3);

    assert.isFalse(await sortedTroves.contains(bob));
    assert.isFalse(await sortedTroves.contains(carol));
    assert.isFalse(await sortedTroves.contains(dennis));
    assert.isFalse(await sortedTroves.contains(erin));
    assert.isFalse(await sortedTroves.contains(freddy));
  });

  it("batchLiquidateTroves(): Liquidates all troves with ICR < 110%, transitioning Normal -> Recovery Mode", async () => {
    // This is again the same test as the before the last one, but now Alice is skipped because she is not active
    // It also skips bob, as he is added twice, for being already liquidated
    // make 6 Troves accordingly
    // --- SETUP ---
    const { totalDebt: B_totalDebt } = await openTrove({
      ICR: toBN(dec(240, 16)),
      extraParams: { from: bob },
    });
    const { totalDebt: C_totalDebt } = await openTrove({
      ICR: toBN(dec(240, 16)),
      extraParams: { from: carol },
    });
    const { totalDebt: D_totalDebt } = await openTrove({
      ICR: toBN(dec(230, 16)),
      extraParams: { from: dennis },
    });
    const { totalDebt: E_totalDebt } = await openTrove({
      ICR: toBN(dec(240, 16)),
      extraParams: { from: erin },
    });
    const { totalDebt: F_totalDebt } = await openTrove({
      ICR: toBN(dec(240, 16)),
      extraParams: { from: freddy },
    });

    const spDeposit = B_totalDebt.add(C_totalDebt)
      .add(D_totalDebt)
      .add(E_totalDebt)
      .add(F_totalDebt);
    const { totalDebt: A_totalDebt } = await openTrove({
      ICR: toBN(dec(426, 16)),
      extraBoldAmount: spDeposit,
      extraParams: { from: alice },
    });
    await openTrove({
      ICR: toBN(dec(426, 16)),
      extraBoldAmount: A_totalDebt,
      extraParams: { from: whale },
    });

    // Alice deposits Bold to Stability Pool
    await stabilityPool.provideToSP(spDeposit, { from: alice });

    // to compensate borrowing fee
    await boldToken.transfer(alice, A_totalDebt, { from: whale });
    // Alice closes trove
    await borrowerOperations.closeTrove({ from: alice });

    // price drops to 1ETH:85Bold, reducing TCR below 150%
    await priceFeed.setPrice("85000000000000000000");
    const price = await priceFeed.getPrice();

    // check Recovery Mode kicks in

    const recoveryMode_Before = await th.checkRecoveryMode(contracts);
    assert.isTrue(recoveryMode_Before);

    // check TCR < 150%
    const _150percent = web3.utils.toBN("1500000000000000000");
    const TCR_Before = await th.getTCR(contracts);
    assert.isTrue(TCR_Before.lt(_150percent));

    /*
    After the price drop and prior to any liquidations, ICR should be:

    Trove         ICR
    Alice       182%
    Bob         102%
    Carol       102%
    Dennis      102%
    Elisa       102%
    Freddy      102%
    */
    alice_ICR = await troveManager.getCurrentICR(alice, price);
    bob_ICR = await troveManager.getCurrentICR(bob, price);
    carol_ICR = await troveManager.getCurrentICR(carol, price);
    dennis_ICR = await troveManager.getCurrentICR(dennis, price);
    erin_ICR = await troveManager.getCurrentICR(erin, price);
    freddy_ICR = await troveManager.getCurrentICR(freddy, price);

    // Alice should have ICR > 150%
    assert.isTrue(alice_ICR.gt(_150percent));
    // All other Troves should have ICR < 150%
    assert.isTrue(carol_ICR.lt(_150percent));
    assert.isTrue(dennis_ICR.lt(_150percent));
    assert.isTrue(erin_ICR.lt(_150percent));
    assert.isTrue(freddy_ICR.lt(_150percent));

    /* After liquidating Bob and Carol, the the TCR of the system rises above the CCR, to 154%.
    (see calculations in Google Sheet)

    Liquidations continue until all Troves with ICR < MCR have been closed.
    Only Alice should remain active - all others should be closed. */

    // call batchLiquidateTroves
    await troveManager.batchLiquidateTroves([
      alice,
      bob,
      bob,
      carol,
      dennis,
      erin,
      freddy,
    ]);

    // check system is no longer in Recovery Mode
    const recoveryMode_After = await th.checkRecoveryMode(contracts);
    assert.isFalse(recoveryMode_After);

    // After liquidation, TCR should rise to above 150%.
    const TCR_After = await th.getTCR(contracts);
    assert.isTrue(TCR_After.gt(_150percent));

    // get all Troves
    const alice_Trove = await troveManager.Troves(alice);
    const bob_Trove = await troveManager.Troves(bob);
    const carol_Trove = await troveManager.Troves(carol);
    const dennis_Trove = await troveManager.Troves(dennis);
    const erin_Trove = await troveManager.Troves(erin);
    const freddy_Trove = await troveManager.Troves(freddy);

    // check that Alice's Trove is closed
    assert.equal(alice_Trove[3], 2);

    // check all other Troves are liquidated
    assert.equal(bob_Trove[3], 3);
    assert.equal(carol_Trove[3], 3);
    assert.equal(dennis_Trove[3], 3);
    assert.equal(erin_Trove[3], 3);
    assert.equal(freddy_Trove[3], 3);

    assert.isFalse(await sortedTroves.contains(bob));
    assert.isFalse(await sortedTroves.contains(carol));
    assert.isFalse(await sortedTroves.contains(dennis));
    assert.isFalse(await sortedTroves.contains(erin));
    assert.isFalse(await sortedTroves.contains(freddy));
  });

  it("batchLiquidateTroves() with a non fullfilled liquidation: non liquidated trove remains active", async () => {
    const { totalDebt: A_totalDebt } = await openTrove({
      ICR: toBN(dec(211, 16)),
      extraParams: { from: alice },
    });
    const { totalDebt: B_totalDebt } = await openTrove({
      ICR: toBN(dec(212, 16)),
      extraParams: { from: bob },
    });
    const { totalDebt: C_totalDebt } = await openTrove({
      ICR: toBN(dec(210, 16)),
      extraParams: { from: carol },
    });
    await openTrove({ ICR: toBN(dec(219, 16)), extraParams: { from: dennis } });
    await openTrove({ ICR: toBN(dec(221, 16)), extraParams: { from: erin } });

    // Whale provides Bold to the SP
    const spDeposit = A_totalDebt.add(B_totalDebt).add(
      C_totalDebt.div(toBN(2)),
    );
    await openTrove({
      ICR: toBN(dec(220, 16)),
      extraBoldAmount: spDeposit,
      extraParams: { from: whale },
    });
    await stabilityPool.provideToSP(spDeposit, { from: whale });

    // Price drops
    await priceFeed.setPrice(dec(120, 18));
    const price = await priceFeed.getPrice();
    const TCR = await th.getTCR(contracts);

    // Check Recovery Mode is active
    assert.isTrue(await th.checkRecoveryMode(contracts));

    // Check A, B, C troves are in range 110% < ICR < TCR
    const ICR_A = await troveManager.getCurrentICR(alice, price);
    const ICR_B = await troveManager.getCurrentICR(bob, price);
    const ICR_C = await troveManager.getCurrentICR(carol, price);

    assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR));
    assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR));
    assert.isTrue(ICR_C.gt(mv._MCR) && ICR_C.lt(TCR));

    const trovesToLiquidate = [alice, bob, carol];
    await troveManager.batchLiquidateTroves(trovesToLiquidate);

    // Check A and B closed
    assert.isFalse(await sortedTroves.contains(alice));
    assert.isFalse(await sortedTroves.contains(bob));

    // Check C remains active
    assert.isTrue(await sortedTroves.contains(carol));
    assert.equal((await troveManager.Troves(carol))[3].toString(), "1"); // check Status is active
  });

  it("batchLiquidateTroves() with a non fullfilled liquidation: non liquidated trove remains in Trove Owners array", async () => {
    const { totalDebt: A_totalDebt } = await openTrove({
      ICR: toBN(dec(211, 16)),
      extraParams: { from: alice },
    });
    const { totalDebt: B_totalDebt } = await openTrove({
      ICR: toBN(dec(212, 16)),
      extraParams: { from: bob },
    });
    const { totalDebt: C_totalDebt } = await openTrove({
      ICR: toBN(dec(210, 16)),
      extraParams: { from: carol },
    });
    await openTrove({ ICR: toBN(dec(219, 16)), extraParams: { from: dennis } });
    await openTrove({ ICR: toBN(dec(221, 16)), extraParams: { from: erin } });

    // Whale provides Bold to the SP
    const spDeposit = A_totalDebt.add(B_totalDebt).add(
      C_totalDebt.div(toBN(2)),
    );
    await openTrove({
      ICR: toBN(dec(220, 16)),
      extraBoldAmount: spDeposit,
      extraParams: { from: whale },
    });
    await stabilityPool.provideToSP(spDeposit, { from: whale });

    // Price drops
    await priceFeed.setPrice(dec(120, 18));
    const price = await priceFeed.getPrice();
    const TCR = await th.getTCR(contracts);

    // Check Recovery Mode is active
    assert.isTrue(await th.checkRecoveryMode(contracts));

    // Check A, B, C troves are in range 110% < ICR < TCR
    const ICR_A = await troveManager.getCurrentICR(alice, price);
    const ICR_B = await troveManager.getCurrentICR(bob, price);
    const ICR_C = await troveManager.getCurrentICR(carol, price);

    assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR));
    assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR));
    assert.isTrue(ICR_C.gt(mv._MCR) && ICR_C.lt(TCR));

    const trovesToLiquidate = [alice, bob, carol];
    await troveManager.batchLiquidateTroves(trovesToLiquidate);

    // Check C is in Trove owners array
    const arrayLength = (await troveManager.getTroveIdsCount()).toNumber();
    let addressFound = false;
    let addressIdx = 0;

    for (let i = 0; i < arrayLength; i++) {
      const address = (await troveManager.TroveIds(i)).toString();
      if (address == carol) {
        addressFound = true;
        addressIdx = i;
      }
    }

    assert.isTrue(addressFound);

    // Check TroveIds idx on trove struct == idx of address found in TroveIds array
    const idxOnStruct = (await troveManager.Troves(carol))[4].toString();
    assert.equal(addressIdx.toString(), idxOnStruct);
  });

  it("batchLiquidateTroves() with a non fullfilled liquidation: still can liquidate further troves after the non-liquidated, emptied pool", async () => {
    const { totalDebt: A_totalDebt } = await openTrove({
      ICR: toBN(dec(196, 16)),
      extraParams: { from: alice },
    });
    const { totalDebt: B_totalDebt } = await openTrove({
      ICR: toBN(dec(198, 16)),
      extraParams: { from: bob },
    });
    const { totalDebt: D_totalDebt } = await openTrove({
      ICR: toBN(dec(206, 16)),
      extraParams: { from: dennis },
    });
    const { totalDebt: C_totalDebt } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraBoldAmount: D_totalDebt,
      extraParams: { from: carol },
    });
    await openTrove({ ICR: toBN(dec(208, 16)), extraParams: { from: erin } });

    // Whale provides Bold to the SP
    const spDeposit = A_totalDebt.add(B_totalDebt).add(
      C_totalDebt.div(toBN(2)),
    );
    await openTrove({
      ICR: toBN(dec(220, 16)),
      extraBoldAmount: spDeposit,
      extraParams: { from: whale },
    });
    await stabilityPool.provideToSP(spDeposit, { from: whale });

    // Price drops
    await priceFeed.setPrice(dec(120, 18));
    const price = await priceFeed.getPrice();
    const TCR = await th.getTCR(contracts);

    // Check Recovery Mode is active
    assert.isTrue(await th.checkRecoveryMode(contracts));

    // Check A, B, C, D, E troves are in range 110% < ICR < TCR
    const ICR_A = await troveManager.getCurrentICR(alice, price);
    const ICR_B = await troveManager.getCurrentICR(bob, price);
    const ICR_C = await troveManager.getCurrentICR(carol, price);
    const ICR_D = await troveManager.getCurrentICR(dennis, price);
    const ICR_E = await troveManager.getCurrentICR(erin, price);

    assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR));
    assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR));
    assert.isTrue(ICR_C.gt(mv._MCR) && ICR_C.lt(TCR));
    assert.isTrue(ICR_D.gt(mv._MCR) && ICR_D.lt(TCR));
    assert.isTrue(ICR_E.gt(mv._MCR) && ICR_E.lt(TCR));

    /* With 300 in the SP, Alice (102 debt) and Bob (101 debt) should be entirely liquidated.
     That leaves 97 Bold in the Pool that won’t be enough to absorb Carol,
     but it will be enough to liquidate Dennis. Afterwards the pool will be empty,
     so Erin won’t liquidated. */
    const trovesToLiquidate = [alice, bob, carol, dennis, erin];
    const tx = await troveManager.batchLiquidateTroves(trovesToLiquidate);
    console.log("gasUsed: ", tx.receipt.gasUsed);

    // Check A, B and D are closed
    assert.isFalse(await sortedTroves.contains(alice));
    assert.isFalse(await sortedTroves.contains(bob));
    assert.isFalse(await sortedTroves.contains(dennis));

    // Check whale, C, D and E stay active
    assert.isTrue(await sortedTroves.contains(whale));
    assert.isTrue(await sortedTroves.contains(carol));
    assert.isTrue(await sortedTroves.contains(erin));
  });

  it("batchLiquidateTroves() with a non fullfilled liquidation: still can liquidate further troves after the non-liquidated, non emptied pool", async () => {
    const { totalDebt: A_totalDebt } = await openTrove({
      ICR: toBN(dec(196, 16)),
      extraParams: { from: alice },
    });
    const { totalDebt: B_totalDebt } = await openTrove({
      ICR: toBN(dec(198, 16)),
      extraParams: { from: bob },
    });
    const { totalDebt: D_totalDebt } = await openTrove({
      ICR: toBN(dec(206, 16)),
      extraParams: { from: dennis },
    });
    const { totalDebt: C_totalDebt } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraBoldAmount: D_totalDebt,
      extraParams: { from: carol },
    });
    await openTrove({ ICR: toBN(dec(208, 16)), extraParams: { from: erin } });

    // Whale provides Bold to the SP
    const spDeposit = A_totalDebt.add(B_totalDebt).add(
      C_totalDebt.div(toBN(2)),
    );
    await openTrove({
      ICR: toBN(dec(220, 16)),
      extraBoldAmount: spDeposit,
      extraParams: { from: whale },
    });
    await stabilityPool.provideToSP(spDeposit, { from: whale });

    // Price drops
    await priceFeed.setPrice(dec(120, 18));
    const price = await priceFeed.getPrice();
    const TCR = await th.getTCR(contracts);

    // Check Recovery Mode is active
    assert.isTrue(await th.checkRecoveryMode(contracts));

    // Check A, B, C, D, E troves are in range 110% < ICR < TCR
    const ICR_A = await troveManager.getCurrentICR(alice, price);
    const ICR_B = await troveManager.getCurrentICR(bob, price);
    const ICR_C = await troveManager.getCurrentICR(carol, price);
    const ICR_D = await troveManager.getCurrentICR(dennis, price);
    const ICR_E = await troveManager.getCurrentICR(erin, price);

    assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR));
    assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR));
    assert.isTrue(ICR_C.gt(mv._MCR) && ICR_C.lt(TCR));
    assert.isTrue(ICR_D.gt(mv._MCR) && ICR_D.lt(TCR));
    assert.isTrue(ICR_E.gt(mv._MCR) && ICR_E.lt(TCR));

    /* With 301 in the SP, Alice (102 debt) and Bob (101 debt) should be entirely liquidated.
     That leaves 97 Bold in the Pool that won’t be enough to absorb Carol,
     but it will be enough to liquidate Dennis. Afterwards the pool will be empty,
     so Erin won’t liquidated.
     Note that, compared to the previous test, this one will make 1 more loop iteration,
     so it will consume more gas. */
    const trovesToLiquidate = [alice, bob, carol, dennis, erin];
    const tx = await troveManager.batchLiquidateTroves(trovesToLiquidate);
    console.log("gasUsed: ", tx.receipt.gasUsed);

    // Check A, B and D are closed
    assert.isFalse(await sortedTroves.contains(alice));
    assert.isFalse(await sortedTroves.contains(bob));
    assert.isFalse(await sortedTroves.contains(dennis));

    // Check whale, C, D and E stay active
    assert.isTrue(await sortedTroves.contains(whale));
    assert.isTrue(await sortedTroves.contains(carol));
    assert.isTrue(await sortedTroves.contains(erin));
  });

  it("batchLiquidateTroves() with a non fullfilled liquidation: total liquidated coll and debt is correct", async () => {
    const { collateral: A_coll, totalDebt: A_totalDebt } = await openTrove({
      ICR: toBN(dec(196, 16)),
      extraParams: { from: alice },
    });
    const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({
      ICR: toBN(dec(198, 16)),
      extraParams: { from: bob },
    });
    const { collateral: C_coll, totalDebt: C_totalDebt } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraParams: { from: carol },
    });
    const { collateral: D_coll, totalDebt: D_totalDebt } = await openTrove({
      ICR: toBN(dec(206, 16)),
      extraParams: { from: dennis },
    });
    const { collateral: E_coll, totalDebt: E_totalDebt } = await openTrove({
      ICR: toBN(dec(208, 16)),
      extraParams: { from: erin },
    });

    // Whale provides Bold to the SP
    const spDeposit = A_totalDebt.add(B_totalDebt).add(
      C_totalDebt.div(toBN(2)),
    );
    await openTrove({
      ICR: toBN(dec(220, 16)),
      extraBoldAmount: spDeposit,
      extraParams: { from: whale },
    });
    await stabilityPool.provideToSP(spDeposit, { from: whale });

    // Price drops
    await priceFeed.setPrice(dec(120, 18));
    const price = await priceFeed.getPrice();
    const TCR = await th.getTCR(contracts);

    // Check Recovery Mode is active
    assert.isTrue(await th.checkRecoveryMode(contracts));

    // Check A, B, C, D, E troves are in range 110% < ICR < TCR
    const ICR_A = await troveManager.getCurrentICR(alice, price);
    const ICR_B = await troveManager.getCurrentICR(bob, price);
    const ICR_C = await troveManager.getCurrentICR(carol, price);

    assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR));
    assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR));
    assert.isTrue(ICR_C.gt(mv._MCR) && ICR_C.lt(TCR));

    const entireSystemCollBefore = await troveManager.getEntireSystemColl();
    const entireSystemDebtBefore = await troveManager.getEntireSystemDebt();

    const trovesToLiquidate = [alice, bob, carol];
    await troveManager.batchLiquidateTroves(trovesToLiquidate);

    // Expect system debt reduced by 203 Bold and system coll by 2 ETH
    const entireSystemCollAfter = await troveManager.getEntireSystemColl();
    const entireSystemDebtAfter = await troveManager.getEntireSystemDebt();

    const changeInEntireSystemColl = entireSystemCollBefore.sub(
      entireSystemCollAfter,
    );
    const changeInEntireSystemDebt = entireSystemDebtBefore.sub(
      entireSystemDebtAfter,
    );

    assert.equal(changeInEntireSystemColl.toString(), A_coll.add(B_coll));
    th.assertIsApproximatelyEqual(
      changeInEntireSystemDebt.toString(),
      A_totalDebt.add(B_totalDebt),
    );
  });

  it("batchLiquidateTroves() with a non fullfilled liquidation: emits correct liquidation event values", async () => {
    const { collateral: A_coll, totalDebt: A_totalDebt } = await openTrove({
      ICR: toBN(dec(210, 16)),
      extraParams: { from: alice },
    });
    const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({
      ICR: toBN(dec(211, 16)),
      extraParams: { from: bob },
    });
    const { totalDebt: C_totalDebt } = await openTrove({
      ICR: toBN(dec(212, 16)),
      extraParams: { from: carol },
    });
    await openTrove({ ICR: toBN(dec(219, 16)), extraParams: { from: dennis } });
    await openTrove({ ICR: toBN(dec(221, 16)), extraParams: { from: erin } });

    // Whale provides Bold to the SP
    const spDeposit = A_totalDebt.add(B_totalDebt).add(
      C_totalDebt.div(toBN(2)),
    );
    await openTrove({
      ICR: toBN(dec(220, 16)),
      extraBoldAmount: spDeposit,
      extraParams: { from: whale },
    });
    await stabilityPool.provideToSP(spDeposit, { from: whale });

    // Price drops
    await priceFeed.setPrice(dec(120, 18));
    const price = await priceFeed.getPrice();
    const TCR = await th.getTCR(contracts);

    // Check Recovery Mode is active
    assert.isTrue(await th.checkRecoveryMode(contracts));

    // Check A, B, C troves are in range 110% < ICR < TCR
    const ICR_A = await troveManager.getCurrentICR(alice, price);
    const ICR_B = await troveManager.getCurrentICR(bob, price);
    const ICR_C = await troveManager.getCurrentICR(carol, price);

    assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR));
    assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR));
    assert.isTrue(ICR_C.gt(mv._MCR) && ICR_C.lt(TCR));

    const trovesToLiquidate = [alice, bob, carol];
    const liquidationTx = await troveManager.batchLiquidateTroves(
      trovesToLiquidate,
    );

    const [liquidatedDebt, liquidatedColl, collGasComp, boldGasComp] = th.getEmittedLiquidationValues(liquidationTx);

    th.assertIsApproximatelyEqual(liquidatedDebt, A_totalDebt.add(B_totalDebt));
    const equivalentColl = A_totalDebt.add(B_totalDebt)
      .mul(toBN(dec(11, 17)))
      .div(price);
    th.assertIsApproximatelyEqual(
      liquidatedColl,
      th.applyLiquidationFee(equivalentColl),
    );
    th.assertIsApproximatelyEqual(
      collGasComp,
      equivalentColl.sub(th.applyLiquidationFee(equivalentColl)),
    ); // 0.5% of 283/120*1.1
    assert.equal(boldGasComp.toString(), dec(400, 18));

    // check collateral surplus
    const alice_remainingCollateral = A_coll.sub(
      A_totalDebt.mul(th.toBN(dec(11, 17))).div(price),
    );
    const bob_remainingCollateral = B_coll.sub(
      B_totalDebt.mul(th.toBN(dec(11, 17))).div(price),
    );
    th.assertIsApproximatelyEqual(
      await collSurplusPool.getCollateral(alice),
      alice_remainingCollateral,
    );
    th.assertIsApproximatelyEqual(
      await collSurplusPool.getCollateral(bob),
      bob_remainingCollateral,
    );

    // can claim collateral
    const alice_balanceBefore = th.toBN(await contracts.WETH.balanceOf(alice));
    await borrowerOperations.claimCollateral({ from: alice });
    const alice_balanceAfter = th.toBN(await contracts.WETH.balanceOf(alice));
    // th.assertIsApproximatelyEqual(alice_balanceAfter, alice_balanceBefore.add(th.toBN(alice_remainingCollateral)))

    const bob_balanceBefore = th.toBN(await contracts.WETH.balanceOf(bob));
    await borrowerOperations.claimCollateral({ from: bob });
    const bob_balanceAfter = th.toBN(await contracts.WETH.balanceOf(bob));
    th.assertIsApproximatelyEqual(
      bob_balanceAfter,
      bob_balanceBefore.add(th.toBN(bob_remainingCollateral)),
    );
  });

  it("batchLiquidateTroves() with a non fullfilled liquidation: ICR of non liquidated trove does not change", async () => {
    const { totalDebt: A_totalDebt } = await openTrove({
      ICR: toBN(dec(211, 16)),
      extraParams: { from: alice },
    });
    const { totalDebt: B_totalDebt } = await openTrove({
      ICR: toBN(dec(212, 16)),
      extraParams: { from: bob },
    });
    const { totalDebt: C_totalDebt } = await openTrove({
      ICR: toBN(dec(210, 16)),
      extraParams: { from: carol },
    });
    await openTrove({ ICR: toBN(dec(219, 16)), extraParams: { from: dennis } });
    await openTrove({ ICR: toBN(dec(221, 16)), extraParams: { from: erin } });

    // Whale provides Bold to the SP
    const spDeposit = A_totalDebt.add(B_totalDebt).add(
      C_totalDebt.div(toBN(2)),
    );
    await openTrove({
      ICR: toBN(dec(220, 16)),
      extraBoldAmount: spDeposit,
      extraParams: { from: whale },
    });
    await stabilityPool.provideToSP(spDeposit, { from: whale });

    // Price drops
    await priceFeed.setPrice(dec(120, 18));
    const price = await priceFeed.getPrice();
    const TCR = await th.getTCR(contracts);

    // Check Recovery Mode is active
    assert.isTrue(await th.checkRecoveryMode(contracts));

    // Check A, B, C troves are in range 110% < ICR < TCR
    const ICR_A = await troveManager.getCurrentICR(alice, price);
    const ICR_B = await troveManager.getCurrentICR(bob, price);
    const ICR_C_Before = await troveManager.getCurrentICR(carol, price);

    assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR));
    assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR));
    assert.isTrue(ICR_C_Before.gt(mv._MCR) && ICR_C_Before.lt(TCR));

    const trovesToLiquidate = [alice, bob, carol];
    await troveManager.batchLiquidateTroves(trovesToLiquidate);

    const ICR_C_After = await troveManager.getCurrentICR(carol, price);
    assert.equal(ICR_C_Before.toString(), ICR_C_After);
  });

  it("batchLiquidateTroves(), with 110% < ICR < TCR, and StabilityPool Bold > debt to liquidate: can liquidate troves out of order", async () => {
    const { totalDebt: A_totalDebt } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraParams: { from: alice },
    });
    const { totalDebt: B_totalDebt } = await openTrove({
      ICR: toBN(dec(202, 16)),
      extraParams: { from: bob },
    });
    const { totalDebt: C_totalDebt } = await openTrove({
      ICR: toBN(dec(204, 16)),
      extraParams: { from: carol },
    });
    const { totalDebt: D_totalDebt } = await openTrove({
      ICR: toBN(dec(206, 16)),
      extraParams: { from: dennis },
    });
    await openTrove({
      ICR: toBN(dec(280, 16)),
      extraBoldAmount: dec(500, 18),
      extraParams: { from: erin },
    });
    await openTrove({
      ICR: toBN(dec(282, 16)),
      extraBoldAmount: dec(500, 18),
      extraParams: { from: freddy },
    });

    // Whale provides 1000 Bold to the SP
    const spDeposit = A_totalDebt.add(C_totalDebt).add(D_totalDebt);
    await openTrove({
      ICR: toBN(dec(219, 16)),
      extraBoldAmount: spDeposit,
      extraParams: { from: whale },
    });
    await stabilityPool.provideToSP(spDeposit, { from: whale });

    // Price drops
    await priceFeed.setPrice(dec(120, 18));
    const price = await priceFeed.getPrice();

    // Check Recovery Mode is active
    assert.isTrue(await th.checkRecoveryMode(contracts));

    // Check troves A-D are in range 110% < ICR < TCR
    const ICR_A = await troveManager.getCurrentICR(alice, price);
    const ICR_B = await troveManager.getCurrentICR(bob, price);
    const ICR_C = await troveManager.getCurrentICR(carol, price);
    const ICR_D = await troveManager.getCurrentICR(dennis, price);
    const TCR = await th.getTCR(contracts);

    assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR));
    assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR));
    assert.isTrue(ICR_C.gt(mv._MCR) && ICR_C.lt(TCR));
    assert.isTrue(ICR_D.gt(mv._MCR) && ICR_D.lt(TCR));

    // Troves are ordered by ICR, low to high: A, B, C, D.

    // Liquidate out of ICR order: D, B, C. A (lowest ICR) not included.
    const trovesToLiquidate = [dennis, bob, carol];

    const liquidationTx = await troveManager.batchLiquidateTroves(
      trovesToLiquidate,
    );

    // Check transaction succeeded
    assert.isTrue(liquidationTx.receipt.status);

    // Confirm troves D, B, C removed
    assert.isFalse(await sortedTroves.contains(dennis));
    assert.isFalse(await sortedTroves.contains(bob));
    assert.isFalse(await sortedTroves.contains(carol));

    // Confirm troves have status 'liquidated' (Status enum element idx 3)
    assert.equal((await troveManager.Troves(dennis))[3], "3");
    assert.equal((await troveManager.Troves(dennis))[3], "3");
    assert.equal((await troveManager.Troves(dennis))[3], "3");
  });

  it("batchLiquidateTroves(), with 110% < ICR < TCR, and StabilityPool empty: doesn't liquidate any troves", async () => {
    await openTrove({ ICR: toBN(dec(222, 16)), extraParams: { from: alice } });
    const { totalDebt: bobDebt_Before } = await openTrove({
      ICR: toBN(dec(224, 16)),
      extraParams: { from: bob },
    });
    const { totalDebt: carolDebt_Before } = await openTrove({
      ICR: toBN(dec(226, 16)),
      extraParams: { from: carol },
    });
    const { totalDebt: dennisDebt_Before } = await openTrove({
      ICR: toBN(dec(228, 16)),
      extraParams: { from: dennis },
    });

    const bobColl_Before = (await troveManager.Troves(bob))[1];
    const carolColl_Before = (await troveManager.Troves(carol))[1];
    const dennisColl_Before = (await troveManager.Troves(dennis))[1];

    await openTrove({ ICR: toBN(dec(228, 16)), extraParams: { from: erin } });
    await openTrove({ ICR: toBN(dec(230, 16)), extraParams: { from: freddy } });

    // Price drops
    await priceFeed.setPrice(dec(120, 18));
    const price = await priceFeed.getPrice();
    const TCR = await th.getTCR(contracts);

    // Check Recovery Mode is active
    assert.isTrue(await th.checkRecoveryMode(contracts));

    // Check troves A-D are in range 110% < ICR < TCR
    const ICR_A = await troveManager.getCurrentICR(alice, price);
    const ICR_B = await troveManager.getCurrentICR(bob, price);
    const ICR_C = await troveManager.getCurrentICR(carol, price);

    assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR));
    assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR));
    assert.isTrue(ICR_C.gt(mv._MCR) && ICR_C.lt(TCR));

    // Troves are ordered by ICR, low to high: A, B, C, D.
    // Liquidate out of ICR order: D, B, C. A (lowest ICR) not included.
    const trovesToLiquidate = [dennis, bob, carol];
    await assertRevert(
      troveManager.batchLiquidateTroves(trovesToLiquidate),
      "TroveManager: nothing to liquidate",
    );

    // Confirm troves D, B, C remain in system
    assert.isTrue(await sortedTroves.contains(dennis));
    assert.isTrue(await sortedTroves.contains(bob));
    assert.isTrue(await sortedTroves.contains(carol));

    // Confirm troves have status 'active' (Status enum element idx 1)
    assert.equal((await troveManager.Troves(dennis))[3], "1");
    assert.equal((await troveManager.Troves(dennis))[3], "1");
    assert.equal((await troveManager.Troves(dennis))[3], "1");

    // Confirm D, B, C coll & debt have not changed
    const dennisDebt_After = (await troveManager.Troves(dennis))[0].add(
      await troveManager.getPendingBoldDebtReward(dennis),
    );
    const bobDebt_After = (await troveManager.Troves(bob))[0].add(
      await troveManager.getPendingBoldDebtReward(bob),
    );
    const carolDebt_After = (await troveManager.Troves(carol))[0].add(
      await troveManager.getPendingBoldDebtReward(carol),
    );

    const dennisColl_After = (await troveManager.Troves(dennis))[1].add(
      await troveManager.getPendingETHReward(dennis),
    );
    const bobColl_After = (await troveManager.Troves(bob))[1].add(
      await troveManager.getPendingETHReward(bob),
    );
    const carolColl_After = (await troveManager.Troves(carol))[1].add(
      await troveManager.getPendingETHReward(carol),
    );

    assert.isTrue(dennisColl_After.eq(dennisColl_Before));
    assert.isTrue(bobColl_After.eq(bobColl_Before));
    assert.isTrue(carolColl_After.eq(carolColl_Before));

    th.assertIsApproximatelyEqual(
      th.toBN(dennisDebt_Before).toString(),
      dennisDebt_After.toString(),
    );
    th.assertIsApproximatelyEqual(
      th.toBN(bobDebt_Before).toString(),
      bobDebt_After.toString(),
    );
    th.assertIsApproximatelyEqual(
      th.toBN(carolDebt_Before).toString(),
      carolDebt_After.toString(),
    );
  });

  it("batchLiquidateTroves(): skips liquidation of troves with ICR > TCR, regardless of Stability Pool size", async () => {
    // Troves that will fall into ICR range 100-MCR
    const { totalDebt: A_totalDebt } = await openTrove({
      ICR: toBN(dec(194, 16)),
      extraParams: { from: A },
    });
    const { totalDebt: B_totalDebt } = await openTrove({
      ICR: toBN(dec(196, 16)),
      extraParams: { from: B },
    });
    const { totalDebt: C_totalDebt } = await openTrove({
      ICR: toBN(dec(198, 16)),
      extraParams: { from: C },
    });

    // Troves that will fall into ICR range 110-TCR
    const { totalDebt: D_totalDebt } = await openTrove({
      ICR: toBN(dec(221, 16)),
      extraParams: { from: D },
    });
    await openTrove({ ICR: toBN(dec(223, 16)), extraParams: { from: E } });
    await openTrove({ ICR: toBN(dec(225, 16)), extraParams: { from: F } });

    // Troves that will fall into ICR range >= TCR
    const { totalDebt: G_totalDebt } = await openTrove({
      ICR: toBN(dec(250, 16)),
      extraParams: { from: G },
    });
    const { totalDebt: H_totalDebt } = await openTrove({
      ICR: toBN(dec(270, 16)),
      extraParams: { from: H },
    });
    const { totalDebt: I_totalDebt } = await openTrove({
      ICR: toBN(dec(290, 16)),
      extraParams: { from: I },
    });

    // Whale adds Bold to SP
    const spDeposit = A_totalDebt.add(C_totalDebt)
      .add(D_totalDebt)
      .add(G_totalDebt)
      .add(H_totalDebt)
      .add(I_totalDebt);
    await openTrove({
      ICR: toBN(dec(245, 16)),
      extraBoldAmount: spDeposit,
      extraParams: { from: whale },
    });
    await stabilityPool.provideToSP(spDeposit, { from: whale });

    // Price drops, but all troves remain active
    await priceFeed.setPrice(dec(110, 18));
    const price = await priceFeed.getPrice();
    const TCR = await th.getTCR(contracts);

    // Confirm Recovery Mode
    assert.isTrue(await th.checkRecoveryMode(contracts));

    const G_collBefore = (await troveManager.Troves(G))[1];
    const G_debtBefore = (await troveManager.Troves(G))[0];
    const H_collBefore = (await troveManager.Troves(H))[1];
    const H_debtBefore = (await troveManager.Troves(H))[0];
    const I_collBefore = (await troveManager.Troves(I))[1];
    const I_debtBefore = (await troveManager.Troves(I))[0];

    const ICR_A = await troveManager.getCurrentICR(A, price);
    const ICR_B = await troveManager.getCurrentICR(B, price);
    const ICR_C = await troveManager.getCurrentICR(C, price);
    const ICR_D = await troveManager.getCurrentICR(D, price);
    const ICR_E = await troveManager.getCurrentICR(E, price);
    const ICR_F = await troveManager.getCurrentICR(F, price);
    const ICR_G = await troveManager.getCurrentICR(G, price);
    const ICR_H = await troveManager.getCurrentICR(H, price);
    const ICR_I = await troveManager.getCurrentICR(I, price);

    // Check A-C are in range 100-110
    assert.isTrue(ICR_A.gte(mv._ICR100) && ICR_A.lt(mv._MCR));
    assert.isTrue(ICR_B.gte(mv._ICR100) && ICR_B.lt(mv._MCR));
    assert.isTrue(ICR_C.gte(mv._ICR100) && ICR_C.lt(mv._MCR));

    // Check D-F are in range 110-TCR
    assert.isTrue(ICR_D.gt(mv._MCR) && ICR_D.lt(TCR));
    assert.isTrue(ICR_E.gt(mv._MCR) && ICR_E.lt(TCR));
    assert.isTrue(ICR_F.gt(mv._MCR) && ICR_F.lt(TCR));

    // Check G-I are in range >= TCR
    assert.isTrue(ICR_G.gte(TCR));
    assert.isTrue(ICR_H.gte(TCR));
    assert.isTrue(ICR_I.gte(TCR));

    // Attempt to liquidate only troves with ICR > TCR%
    await assertRevert(
      troveManager.batchLiquidateTroves([G, H, I]),
      "TroveManager: nothing to liquidate",
    );

    // Check G, H, I remain in system
    assert.isTrue(await sortedTroves.contains(G));
    assert.isTrue(await sortedTroves.contains(H));
    assert.isTrue(await sortedTroves.contains(I));

    // Check G, H, I coll and debt have not changed
    assert.equal(G_collBefore.eq(await troveManager.Troves(G))[1]);
    assert.equal(G_debtBefore.eq(await troveManager.Troves(G))[0]);
    assert.equal(H_collBefore.eq(await troveManager.Troves(H))[1]);
    assert.equal(H_debtBefore.eq(await troveManager.Troves(H))[0]);
    assert.equal(I_collBefore.eq(await troveManager.Troves(I))[1]);
    assert.equal(I_debtBefore.eq(await troveManager.Troves(I))[0]);

    // Confirm Recovery Mode
    assert.isTrue(await th.checkRecoveryMode(contracts));

    // Attempt to liquidate a variety of troves with SP covering whole batch.
    // Expect A, C, D to be liquidated, and G, H, I to remain in system
    await troveManager.batchLiquidateTroves([C, D, G, H, A, I]);

    // Confirm A, C, D liquidated
    assert.isFalse(await sortedTroves.contains(C));
    assert.isFalse(await sortedTroves.contains(A));
    assert.isFalse(await sortedTroves.contains(D));

    // Check G, H, I remain in system
    assert.isTrue(await sortedTroves.contains(G));
    assert.isTrue(await sortedTroves.contains(H));
    assert.isTrue(await sortedTroves.contains(I));

    // Check coll and debt have not changed
    assert.equal(G_collBefore.eq(await troveManager.Troves(G))[1]);
    assert.equal(G_debtBefore.eq(await troveManager.Troves(G))[0]);
    assert.equal(H_collBefore.eq(await troveManager.Troves(H))[1]);
    assert.equal(H_debtBefore.eq(await troveManager.Troves(H))[0]);
    assert.equal(I_collBefore.eq(await troveManager.Troves(I))[1]);
    assert.equal(I_debtBefore.eq(await troveManager.Troves(I))[0]);

    // Confirm Recovery Mode
    assert.isTrue(await th.checkRecoveryMode(contracts));

    // Whale withdraws entire deposit, and re-deposits 132 Bold
    // Increasing the price for a moment to avoid pending liquidations to block withdrawal
    await priceFeed.setPrice(dec(200, 18));
    await stabilityPool.withdrawFromSP(spDeposit, { from: whale });
    await priceFeed.setPrice(dec(110, 18));
    await stabilityPool.provideToSP(
      B_totalDebt.add(toBN(dec(50, 18))),
      { from: whale },
    );

    // B and E are still in range 110-TCR.
    // Attempt to liquidate B, G, H, I, E.
    // Expected Stability Pool to fully absorb B (92 Bold + 10 virtual debt),
    // but not E as there are not enough funds in Stability Pool

    const stabilityBefore = await stabilityPool.getTotalBoldDeposits();
    const dEbtBefore = (await troveManager.Troves(E))[0];

    await troveManager.batchLiquidateTroves([B, G, H, I, E]);

    const dEbtAfter = (await troveManager.Troves(E))[0];
    const stabilityAfter = await stabilityPool.getTotalBoldDeposits();

    const stabilityDelta = stabilityBefore.sub(stabilityAfter);
    const dEbtDelta = dEbtBefore.sub(dEbtAfter);

    th.assertIsApproximatelyEqual(stabilityDelta, B_totalDebt);
    assert.equal(dEbtDelta.toString(), "0");

    // Confirm B removed and E active
    assert.isFalse(await sortedTroves.contains(B));
    assert.isTrue(await sortedTroves.contains(E));

    // Check G, H, I remain in system
    assert.isTrue(await sortedTroves.contains(G));
    assert.isTrue(await sortedTroves.contains(H));
    assert.isTrue(await sortedTroves.contains(I));

    // Check coll and debt have not changed
    assert.equal(G_collBefore.eq(await troveManager.Troves(G))[1]);
    assert.equal(G_debtBefore.eq(await troveManager.Troves(G))[0]);
    assert.equal(H_collBefore.eq(await troveManager.Troves(H))[1]);
    assert.equal(H_debtBefore.eq(await troveManager.Troves(H))[0]);
    assert.equal(I_collBefore.eq(await troveManager.Troves(I))[1]);
    assert.equal(I_debtBefore.eq(await troveManager.Troves(I))[0]);
  });

  it("batchLiquidateTroves(): emits liquidation event with correct values when all troves have ICR > 110% and Stability Pool covers a subset of troves", async () => {
    // Troves to be absorbed by SP
    const { collateral: F_coll, totalDebt: F_totalDebt } = await openTrove({
      ICR: toBN(dec(222, 16)),
      extraParams: { from: freddy },
    });
    const { collateral: G_coll, totalDebt: G_totalDebt } = await openTrove({
      ICR: toBN(dec(222, 16)),
      extraParams: { from: greta },
    });

    // Troves to be spared
    await openTrove({ ICR: toBN(dec(250, 16)), extraParams: { from: alice } });
    await openTrove({ ICR: toBN(dec(266, 16)), extraParams: { from: bob } });
    await openTrove({ ICR: toBN(dec(285, 16)), extraParams: { from: carol } });
    await openTrove({ ICR: toBN(dec(308, 16)), extraParams: { from: dennis } });

    // Whale adds Bold to SP
    const spDeposit = F_totalDebt.add(G_totalDebt);
    await openTrove({
      ICR: toBN(dec(285, 16)),
      extraBoldAmount: spDeposit,
      extraParams: { from: whale },
    });
    await stabilityPool.provideToSP(spDeposit, { from: whale });

    // Price drops, but all troves remain active
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice();

    // Confirm Recovery Mode
    assert.isTrue(await th.checkRecoveryMode(contracts));

    // Confirm all troves have ICR > MCR
    assert.isTrue(
      (await troveManager.getCurrentICR(freddy, price)).gte(mv._MCR),
    );
    assert.isTrue(
      (await troveManager.getCurrentICR(greta, price)).gte(mv._MCR),
    );
    assert.isTrue(
      (await troveManager.getCurrentICR(alice, price)).gte(mv._MCR),
    );
    assert.isTrue((await troveManager.getCurrentICR(bob, price)).gte(mv._MCR));
    assert.isTrue(
      (await troveManager.getCurrentICR(carol, price)).gte(mv._MCR),
    );

    // Confirm Bold in Stability Pool
    assert.equal(
      (await stabilityPool.getTotalBoldDeposits()).toString(),
      spDeposit.toString(),
    );

    const trovesToLiquidate = [freddy, greta, alice, bob, carol, dennis, whale];

    // Attempt liqudation sequence
    const liquidationTx = await troveManager.batchLiquidateTroves(
      trovesToLiquidate,
    );
    const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx);

    // Check F and G were liquidated
    assert.isFalse(await sortedTroves.contains(freddy));
    assert.isFalse(await sortedTroves.contains(greta));

    // Check whale and A-D remain active
    assert.isTrue(await sortedTroves.contains(alice));
    assert.isTrue(await sortedTroves.contains(bob));
    assert.isTrue(await sortedTroves.contains(carol));
    assert.isTrue(await sortedTroves.contains(dennis));
    assert.isTrue(await sortedTroves.contains(whale));

    // Liquidation event emits coll = (F_debt + G_debt)/price*1.1*0.995, and debt = (F_debt + G_debt)
    th.assertIsApproximatelyEqual(liquidatedDebt, F_totalDebt.add(G_totalDebt));
    th.assertIsApproximatelyEqual(
      liquidatedColl,
      th.applyLiquidationFee(
        F_totalDebt.add(G_totalDebt)
          .mul(toBN(dec(11, 17)))
          .div(price),
      ),
    );

    // check collateral surplus
    const freddy_remainingCollateral = F_coll.sub(
      F_totalDebt.mul(th.toBN(dec(11, 17))).div(price),
    );
    const greta_remainingCollateral = G_coll.sub(
      G_totalDebt.mul(th.toBN(dec(11, 17))).div(price),
    );
    th.assertIsApproximatelyEqual(
      await collSurplusPool.getCollateral(freddy),
      freddy_remainingCollateral,
    );
    th.assertIsApproximatelyEqual(
      await collSurplusPool.getCollateral(greta),
      greta_remainingCollateral,
    );

    // can claim collateral
    const freddy_balanceBefore = th.toBN(await contracts.WETH.balanceOf(freddy));
    await borrowerOperations.claimCollateral({ from: freddy });
    const freddy_balanceAfter = th.toBN(await contracts.WETH.balanceOf(freddy));
    th.assertIsApproximatelyEqual(
      freddy_balanceAfter,
      freddy_balanceBefore.add(th.toBN(freddy_remainingCollateral)),
    );

    const greta_balanceBefore = th.toBN(await contracts.WETH.balanceOf(greta));
    await borrowerOperations.claimCollateral({ from: greta });
    const greta_balanceAfter = th.toBN(await contracts.WETH.balanceOf(greta));
    th.assertIsApproximatelyEqual(
      greta_balanceAfter,
      greta_balanceBefore.add(th.toBN(greta_remainingCollateral)),
    );
  });

  it("batchLiquidateTroves(): emits liquidation event with correct values when all troves have ICR > 110% and Stability Pool covers a subset of troves, including a partial", async () => {
    // Troves to be absorbed by SP
    const { collateral: F_coll, totalDebt: F_totalDebt } = await openTrove({
      ICR: toBN(dec(222, 16)),
      extraParams: { from: freddy },
    });
    const { collateral: G_coll, totalDebt: G_totalDebt } = await openTrove({
      ICR: toBN(dec(222, 16)),
      extraParams: { from: greta },
    });

    // Troves to be spared
    const { collateral: A_coll, totalDebt: A_totalDebt } = await openTrove({
      ICR: toBN(dec(250, 16)),
      extraParams: { from: alice },
    });
    await openTrove({ ICR: toBN(dec(266, 16)), extraParams: { from: bob } });
    await openTrove({ ICR: toBN(dec(285, 16)), extraParams: { from: carol } });
    await openTrove({ ICR: toBN(dec(308, 16)), extraParams: { from: dennis } });

    // Whale opens trove and adds 220 Bold to SP
    const spDeposit = F_totalDebt.add(G_totalDebt).add(
      A_totalDebt.div(toBN(2)),
    );
    await openTrove({
      ICR: toBN(dec(285, 16)),
      extraBoldAmount: spDeposit,
      extraParams: { from: whale },
    });
    await stabilityPool.provideToSP(spDeposit, { from: whale });

    // Price drops, but all troves remain active
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice();

    // Confirm Recovery Mode
    assert.isTrue(await th.checkRecoveryMode(contracts));

    // Confirm all troves have ICR > MCR
    assert.isTrue(
      (await troveManager.getCurrentICR(freddy, price)).gte(mv._MCR),
    );
    assert.isTrue(
      (await troveManager.getCurrentICR(greta, price)).gte(mv._MCR),
    );
    assert.isTrue(
      (await troveManager.getCurrentICR(alice, price)).gte(mv._MCR),
    );
    assert.isTrue((await troveManager.getCurrentICR(bob, price)).gte(mv._MCR));
    assert.isTrue(
      (await troveManager.getCurrentICR(carol, price)).gte(mv._MCR),
    );

    // Confirm Bold in Stability Pool
    assert.equal(
      (await stabilityPool.getTotalBoldDeposits()).toString(),
      spDeposit.toString(),
    );

    const trovesToLiquidate = [freddy, greta, alice, bob, carol, dennis, whale];

    // Attempt liqudation sequence
    const liquidationTx = await troveManager.batchLiquidateTroves(
      trovesToLiquidate,
    );
    const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx);

    // Check F and G were liquidated
    assert.isFalse(await sortedTroves.contains(freddy));
    assert.isFalse(await sortedTroves.contains(greta));

    // Check whale and A-D remain active
    assert.isTrue(await sortedTroves.contains(alice));
    assert.isTrue(await sortedTroves.contains(bob));
    assert.isTrue(await sortedTroves.contains(carol));
    assert.isTrue(await sortedTroves.contains(dennis));
    assert.isTrue(await sortedTroves.contains(whale));

    // Check A's collateral and debt are the same
    const entireColl_A = (await troveManager.Troves(alice))[1].add(
      await troveManager.getPendingETHReward(alice),
    );
    const entireDebt_A = (await troveManager.Troves(alice))[0].add(
      await troveManager.getPendingBoldDebtReward(alice),
    );

    assert.equal(entireColl_A.toString(), A_coll);
    th.assertIsApproximatelyEqual(entireDebt_A.toString(), A_totalDebt);

    /* Liquidation event emits:
    coll = (F_debt + G_debt)/price*1.1*0.995
    debt = (F_debt + G_debt) */
    th.assertIsApproximatelyEqual(liquidatedDebt, F_totalDebt.add(G_totalDebt));
    th.assertIsApproximatelyEqual(
      liquidatedColl,
      th.applyLiquidationFee(
        F_totalDebt.add(G_totalDebt)
          .mul(toBN(dec(11, 17)))
          .div(price),
      ),
    );

    // check collateral surplus
    const freddy_remainingCollateral = F_coll.sub(
      F_totalDebt.mul(th.toBN(dec(11, 17))).div(price),
    );
    const greta_remainingCollateral = G_coll.sub(
      G_totalDebt.mul(th.toBN(dec(11, 17))).div(price),
    );
    th.assertIsApproximatelyEqual(
      await collSurplusPool.getCollateral(freddy),
      freddy_remainingCollateral,
    );
    th.assertIsApproximatelyEqual(
      await collSurplusPool.getCollateral(greta),
      greta_remainingCollateral,
    );

    // can claim collateral
    const freddy_balanceBefore = th.toBN(await contracts.WETH.balanceOf(freddy));
    await borrowerOperations.claimCollateral({ from: freddy });
    const freddy_balanceAfter = th.toBN(await contracts.WETH.balanceOf(freddy));
    th.assertIsApproximatelyEqual(
      freddy_balanceAfter,
      freddy_balanceBefore.add(th.toBN(freddy_remainingCollateral)),
    );

    const greta_balanceBefore = th.toBN(await contracts.WETH.balanceOf(greta));
    await borrowerOperations.claimCollateral({ from: greta });
    const greta_balanceAfter = th.toBN(await contracts.WETH.balanceOf(greta));
    th.assertIsApproximatelyEqual(
      greta_balanceAfter,
      greta_balanceBefore.add(th.toBN(greta_remainingCollateral)),
    );
  });
});

contract("Reset chain state", async (accounts) => {});
