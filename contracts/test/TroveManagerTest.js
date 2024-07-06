const { time } = require("@nomicfoundation/hardhat-network-helpers");
const {
  MoneyValues: mv,
  TestHelper: th,
  TimeValues: timeValues,
} = require("../utils/testHelpers.js");
const { createDeployAndFundFixture } = require("../utils/testFixtures.js");

const TroveManagerTester = artifacts.require("./TroveManagerTester.sol");

const {
  assertRevert,
  dec,
  toBN,
} = th;

const GAS_PRICE = 10000000;
let ETH_GAS_COMPENSATION;

/* NOTE: Some tests involving ETH redemption fees do not test for specific fee values.
 * Some only test that the fees are non-zero when they should occur.
 *
 * Specific ETH gain values will depend on the final fee schedule used, and the final choices for
 * the parameter BETA in the TroveManager, which is still TBD based on economic modelling.
 *
 */
contract("TroveManager", async (accounts) => {
  const fundedAccounts = accounts.slice(0, 20);

  const _18_zeros = "000000000000000000";
  const ZERO_ADDRESS = th.ZERO_ADDRESS;

  const [
    owner,
    alice,
    bob,
    carol,
    dennis,
    erin,
    flyn,
    graham,
    harriet,
    ida,
    defaulter_1,
    defaulter_2,
    defaulter_3,
    defaulter_4,
    whale,
    A,
    B,
    C,
    D,
    E,
  ] = fundedAccounts;

  let contracts;

  let priceFeed;
  let boldToken;
  let sortedTroves;
  let troveManager;
  let activePool;
  let stabilityPool;
  let defaultPool;
  let borrowerOperations;

  const deployFixture = createDeployAndFundFixture({
    accounts: fundedAccounts,
    mocks: { TroveManager: TroveManagerTester },
    callback: async (contracts) => {
      const { constants } = contracts;
      const [
        CCR,
        ETH_GAS_COMPENSATION,
        MIN_DEBT,
      ] = await Promise.all([
        constants._CCR(),
        constants._ETH_GAS_COMPENSATION(),
        constants._MIN_DEBT(),
      ]);
      return {
        CCR,
        ETH_GAS_COMPENSATION,
        MIN_DEBT,
      };
    },
  });
  const getOpenTroveTotalDebt = async (boldAmount) => th.getOpenTroveTotalDebt(contracts, boldAmount);
  const getOpenTroveBoldAmount = async (totalDebt) => th.getOpenTroveBoldAmount(contracts, totalDebt);
  const getActualDebtFromComposite = async (compositeDebt) => th.getActualDebtFromComposite(compositeDebt, contracts);
  const getNetBorrowingAmount = async (debtWithFee) => th.getNetBorrowingAmount(contracts, debtWithFee);
  const openTrove = async (params) => th.openTrove(contracts, params);
  const withdrawBold = async (params) => th.withdrawBold(contracts, params);

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
    borrowerOperations = contracts.borrowerOperations;

    ETH_GAS_COMPENSATION = result.ETH_GAS_COMPENSATION;
  });

  it("liquidate(): closes a Trove that has ICR < MCR", async () => {
    await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } });
    const { troveId: aliceTroveId } = await openTrove({ ICR: toBN(dec(4, 18)), extraParams: { from: alice } });

    const price = await priceFeed.getPrice();
    const ICR_Before = await troveManager.getCurrentICR(aliceTroveId, price);
    assert.equal(ICR_Before, dec(4, 18));

    const MCR = (await troveManager.MCR()).toString();
    assert.equal(MCR.toString(), "1100000000000000000");

    // Alice increases debt to 180 Bold, lowering her ICR to 1.11
    const A_BoldWithdrawal = await getNetBorrowingAmount(dec(130, 18));

    const targetICR = toBN("1111111111111111111");
    await withdrawBold({ ICR: targetICR, extraParams: { from: alice } });

    const ICR_AfterWithdrawal = await troveManager.getCurrentICR(aliceTroveId, price);
    assert.isAtMost(th.getDifference(ICR_AfterWithdrawal, targetICR), 100);

    // price drops to 1ETH:100Bold, reducing Alice's ICR below MCR
    await priceFeed.setPrice("100000000000000000000");

    // Confirm system is not below CT
    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    // close Trove
    await troveManager.liquidate(aliceTroveId, { from: owner });

    // check the Trove is successfully closed, and removed from sortedList
    const status = (await troveManager.Troves(aliceTroveId))[3];
    assert.equal(status, 3); // status enum 3 corresponds to "Closed by liquidation"
    const alice_Trove_isInSortedList = await sortedTroves.contains(aliceTroveId);
    assert.isFalse(alice_Trove_isInSortedList);
  });

  it("liquidate(): decreases ActivePool ETH and BoldDebt by correct amounts", async () => {
    // --- SETUP ---
    const { troveId: aliceTroveId, collateral: A_collateral, totalDebt: A_totalDebt } = await openTrove({
      ICR: toBN(dec(4, 18)),
      extraParams: { from: alice },
    });
    const { troveId: bobTroveId, collateral: B_collateral, totalDebt: B_totalDebt } = await openTrove({
      ICR: toBN(dec(21, 17)),
      extraParams: { from: bob },
    });

    // --- TEST ---

    // check ActivePool ETH and Bold debt before
    const activePool_ETH_Before = (await activePool.getCollBalance()).toString();
    const activePool_RawEther_Before = (
      await contracts.WETH.balanceOf(activePool.address)
    ).toString();
    const activePool_BoldDebt_Before = (
      await activePool.getBoldDebt()
    ).toString();

    assert.equal(activePool_ETH_Before, A_collateral.add(B_collateral));
    assert.equal(activePool_RawEther_Before, A_collateral.add(B_collateral));
    th.assertIsApproximatelyEqual(
      activePool_BoldDebt_Before,
      A_totalDebt.add(B_totalDebt),
    );

    // price drops to 1ETH:100Bold, reducing Bob's ICR below MCR
    await priceFeed.setPrice("100000000000000000000");

    // Confirm system is not below CT
    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    /* close Bob's Trove. Should liquidate his ether and Bold,
    leaving Alice’s ether and Bold debt in the ActivePool. */
    await troveManager.liquidate(bobTroveId, { from: owner });

    // check ActivePool ETH and Bold debt
    const activePool_ETH_After = (await activePool.getCollBalance()).toString();
    const activePool_RawEther_After = (
      await contracts.WETH.balanceOf(activePool.address)
    ).toString();
    const activePool_BoldDebt_After = (
      await activePool.getBoldDebt()
    ).toString();

    assert.equal(activePool_ETH_After, A_collateral);
    assert.equal(activePool_RawEther_After, A_collateral);
    th.assertIsApproximatelyEqual(activePool_BoldDebt_After, A_totalDebt);
  });

  it("liquidate(): increases DefaultPool ETH and Bold debt by correct amounts", async () => {
    // --- SETUP ---
    const { troveId: aliceTroveId, collateral: A_collateral, totalDebt: A_totalDebt } = await openTrove({
      ICR: toBN(dec(4, 18)),
      extraParams: { from: alice },
    });
    const { troveId: bobTroveId, collateral: B_collateral, totalDebt: B_totalDebt } = await openTrove({
      ICR: toBN(dec(21, 17)),
      extraParams: { from: bob },
    });

    // --- TEST ---

    // check DefaultPool ETH and Bold debt before
    const defaultPool_ETH_Before = await defaultPool.getCollBalance();
    const defaultPool_RawEther_Before = (
      await contracts.WETH.balanceOf(defaultPool.address)
    ).toString();
    const defaultPool_BoldDebt_Before = (
      await defaultPool.getBoldDebt()
    ).toString();

    assert.equal(defaultPool_ETH_Before, "0");
    assert.equal(defaultPool_RawEther_Before, "0");
    assert.equal(defaultPool_BoldDebt_Before, "0");

    // price drops to 1ETH:100Bold, reducing Bob's ICR below MCR
    await priceFeed.setPrice("100000000000000000000");

    // Confirm system is not below CT
    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    // close Bob's Trove
    await troveManager.liquidate(bobTroveId, { from: owner });

    // check after
    const defaultPool_ETH_After = (await defaultPool.getCollBalance()).toString();
    const defaultPool_RawEther_After = (
      await contracts.WETH.balanceOf(defaultPool.address)
    ).toString();
    const defaultPool_BoldDebt_After = (
      await defaultPool.getBoldDebt()
    ).toString();

    const defaultPool_ETH = th.applyLiquidationFee(B_collateral);
    assert.equal(defaultPool_ETH_After, defaultPool_ETH);
    assert.equal(defaultPool_RawEther_After, defaultPool_ETH);
    th.assertIsApproximatelyEqual(defaultPool_BoldDebt_After, B_totalDebt);
  });

  it("liquidate(): removes the Trove's stake from the total stakes", async () => {
    // --- SETUP ---
    const { troveId: aliceTroveId, collateral: A_collateral, totalDebt: A_totalDebt } = await openTrove({
      ICR: toBN(dec(4, 18)),
      extraParams: { from: alice },
    });
    const { troveId: bobTroveId, collateral: B_collateral, totalDebt: B_totalDebt } = await openTrove({
      ICR: toBN(dec(21, 17)),
      extraParams: { from: bob },
    });

    // --- TEST ---

    // check totalStakes before
    const totalStakes_Before = (await troveManager.totalStakes()).toString();
    assert.equal(totalStakes_Before, A_collateral.add(B_collateral));

    // price drops to 1ETH:100Bold, reducing Bob's ICR below MCR
    await priceFeed.setPrice("100000000000000000000");

    // Confirm system is not below CT
    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    // Close Bob's Trove
    await troveManager.liquidate(bobTroveId, { from: owner });

    // check totalStakes after
    const totalStakes_After = (await troveManager.totalStakes()).toString();
    assert.equal(totalStakes_After, A_collateral);
  });

  it("liquidate(): Removes the correct trove from the TroveIds array, and moves the last array element to the new empty slot", async () => {
    // --- SETUP ---
    const { troveId: whaleTroveId } = await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } });

    // Alice, Bob, Carol, Dennis, Erin open troves with consecutively decreasing collateral ratio
    const { troveId: aliceTroveId } = await openTrove({ ICR: toBN(dec(218, 16)), extraParams: { from: alice } });
    const { troveId: bobTroveId } = await openTrove({ ICR: toBN(dec(216, 16)), extraParams: { from: bob } });
    const { troveId: carolTroveId } = await openTrove({ ICR: toBN(dec(214, 16)), extraParams: { from: carol } });
    const { troveId: dennisTroveId } = await openTrove({ ICR: toBN(dec(212, 16)), extraParams: { from: dennis } });
    const { troveId: erinTroveId } = await openTrove({ ICR: toBN(dec(210, 16)), extraParams: { from: erin } });

    // At this stage, TroveIds array should be: [W, A, B, C, D, E]

    // Drop price
    await priceFeed.setPrice(dec(100, 18));

    const arrayLength_Before = await troveManager.getTroveIdsCount();
    assert.equal(arrayLength_Before, 6);

    // Confirm system is not below CT
    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    // Liquidate carol
    await troveManager.liquidate(carolTroveId);

    // Check Carol no longer has an active trove
    assert.isFalse(await sortedTroves.contains(carolTroveId));

    // Check length of array has decreased by 1
    const arrayLength_After = await troveManager.getTroveIdsCount();
    assert.equal(arrayLength_After, 5);

    /* After Carol is removed from array, the last element (Erin's address) should have been moved to fill
    the empty slot left by Carol, and the array length decreased by one.  The final TroveIds array should be:

    [W, A, B, E, D]

    Check all remaining troves in the array are in the correct order */
    const trove_0 = await troveManager.TroveIds(0);
    const trove_1 = await troveManager.TroveIds(1);
    const trove_2 = await troveManager.TroveIds(2);
    const trove_3 = await troveManager.TroveIds(3);
    const trove_4 = await troveManager.TroveIds(4);

    assert.isTrue(trove_0.eq(whaleTroveId));
    assert.isTrue(trove_1.eq(aliceTroveId));
    assert.isTrue(trove_2.eq(bobTroveId));
    assert.isTrue(trove_3.eq(erinTroveId));
    assert.isTrue(trove_4.eq(dennisTroveId));

    // Check correct indices recorded on the active trove structs
    const whale_arrayIndex = (await troveManager.Troves(whaleTroveId))[4];
    const alice_arrayIndex = (await troveManager.Troves(aliceTroveId))[4];
    const bob_arrayIndex = (await troveManager.Troves(bobTroveId))[4];
    const dennis_arrayIndex = (await troveManager.Troves(dennisTroveId))[4];
    const erin_arrayIndex = (await troveManager.Troves(erinTroveId))[4];

    // [W, A, B, E, D]
    assert.equal(whale_arrayIndex, 0);
    assert.equal(alice_arrayIndex, 1);
    assert.equal(bob_arrayIndex, 2);
    assert.equal(erin_arrayIndex, 3);
    assert.equal(dennis_arrayIndex, 4);
  });

  it("liquidate(): updates the snapshots of total stakes and total collateral", async () => {
    // --- SETUP ---
    const { troveId: aliceTroveId, collateral: A_collateral, totalDebt: A_totalDebt } = await openTrove({
      ICR: toBN(dec(4, 18)),
      extraParams: { from: alice },
    });
    const { troveId: bobTroveId, collateral: B_collateral, totalDebt: B_totalDebt } = await openTrove({
      ICR: toBN(dec(21, 17)),
      extraParams: { from: bob },
    });

    // --- TEST ---

    // check snapshots before
    const totalStakesSnapshot_Before = (
      await troveManager.totalStakesSnapshot()
    ).toString();
    const totalCollateralSnapshot_Before = (
      await troveManager.totalCollateralSnapshot()
    ).toString();
    assert.equal(totalStakesSnapshot_Before, "0");
    assert.equal(totalCollateralSnapshot_Before, "0");

    // price drops to 1ETH:100Bold, reducing Bob's ICR below MCR
    await priceFeed.setPrice("100000000000000000000");

    // Confirm system is not below CT
    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    // close Bob's Trove.  His ether*0.995 and Bold should be added to the DefaultPool.
    await troveManager.liquidate(bobTroveId, { from: owner });

    /* check snapshots after. Total stakes should be equal to the  remaining stake then the system:
    10 ether, Alice's stake.

    Total collateral should be equal to Alice's collateral plus her pending ETH reward (Bob’s collaterale*0.995 ether), earned
    from the liquidation of Bob's Trove */
    const totalStakesSnapshot_After = (
      await troveManager.totalStakesSnapshot()
    ).toString();
    const totalCollateralSnapshot_After = (
      await troveManager.totalCollateralSnapshot()
    ).toString();

    assert.equal(totalStakesSnapshot_After, A_collateral);
    assert.equal(
      totalCollateralSnapshot_After,
      A_collateral.add(th.applyLiquidationFee(B_collateral)),
    );
  });

  it("liquidate(): updates the L_coll and L_boldDebt reward-per-unit-staked totals", async () => {
    // --- SETUP ---
    const { troveId: aliceTroveId, collateral: A_collateral, totalDebt: A_totalDebt } = await openTrove({
      ICR: toBN(dec(8, 18)),
      extraParams: { from: alice },
    });
    const { troveId: bobTroveId, collateral: B_collateral, totalDebt: B_totalDebt } = await openTrove({
      ICR: toBN(dec(4, 18)),
      extraParams: { from: bob },
    });
    const { troveId: carolTroveId, collateral: C_collateral, totalDebt: C_totalDebt } = await openTrove({
      ICR: toBN(dec(111, 16)),
      extraParams: { from: carol },
    });

    // --- TEST ---

    // price drops to 1ETH:100Bold, reducing Carols's ICR below MCR
    await priceFeed.setPrice("100000000000000000000");

    // Confirm system is not below CT
    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    // close Carol's Trove.
    assert.isTrue(await sortedTroves.contains(carolTroveId));
    await troveManager.liquidate(carolTroveId, { from: owner });
    assert.isFalse(await sortedTroves.contains(carolTroveId));

    // Carol's ether*0.995 and Bold should be added to the DefaultPool.
    const L_coll_AfterCarolLiquidated = await troveManager.L_coll();
    const L_boldDebt_AfterCarolLiquidated = await troveManager.L_boldDebt();

    const L_coll_expected_1 = th
      .applyLiquidationFee(C_collateral)
      .mul(mv._1e18BN)
      .div(A_collateral.add(B_collateral));
    const L_boldDebt_expected_1 = C_totalDebt.mul(mv._1e18BN).div(
      A_collateral.add(B_collateral),
    );
    assert.isAtMost(
      th.getDifference(L_coll_AfterCarolLiquidated, L_coll_expected_1),
      100,
    );
    assert.isAtMost(
      th.getDifference(L_boldDebt_AfterCarolLiquidated, L_boldDebt_expected_1),
      100,
    );

    assert.isTrue(await sortedTroves.contains(bobTroveId));
    // Bob now withdraws Bold, bringing his ICR to 1.11
    const { increasedTotalDebt: B_increasedTotalDebt } = await withdrawBold({
      ICR: toBN(dec(111, 16)),
      extraParams: { from: bob },
    });

    // Confirm system is not below CT
    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    // price drops to 1ETH:50Bold, reducing Bob's ICR below MCR
    await priceFeed.setPrice(dec(50, 18));
    const price = await priceFeed.getPrice();

    // close Bob's Trove
    assert.isTrue(await sortedTroves.contains(bobTroveId));
    await troveManager.liquidate(bobTroveId, { from: owner });
    assert.isFalse(await sortedTroves.contains(bobTroveId));

    /* Alice now has all the active stake. totalStakes in the system is now 10 ether.

   Bob's pending collateral reward and debt reward are applied to his Trove
   before his liquidation.
   His total collateral*0.995 and debt are then added to the DefaultPool.

   The system rewards-per-unit-staked should now be:

   L_coll = (0.995 / 20) + (10.4975*0.995  / 10) = 1.09425125 ETH
   L_boldDebt = (180 / 20) + (890 / 10) = 98 Bold */
    const L_coll_AfterBobLiquidated = await troveManager.L_coll();
    const L_boldDebt_AfterBobLiquidated = await troveManager.L_boldDebt();

    const L_coll_expected_2 = L_coll_expected_1.add(
      th
        .applyLiquidationFee(
          B_collateral.add(B_collateral.mul(L_coll_expected_1).div(mv._1e18BN)),
        )
        .mul(mv._1e18BN)
        .div(A_collateral),
    );
    const L_boldDebt_expected_2 = L_boldDebt_expected_1.add(
      B_totalDebt.add(B_increasedTotalDebt)
        .add(B_collateral.mul(L_boldDebt_expected_1).div(mv._1e18BN))
        .mul(mv._1e18BN)
        .div(A_collateral),
    );
    assert.isAtMost(
      th.getDifference(L_coll_AfterBobLiquidated, L_coll_expected_2),
      100,
    );
    assert.isAtMost(
      th.getDifference(L_boldDebt_AfterBobLiquidated, L_boldDebt_expected_2),
      100,
    );
  });

  it("liquidate(): Liquidates undercollateralized trove if there are two troves in the system", async () => {
    const { troveId: bobTroveId } = await openTrove({
      ICR: toBN(dec(200, 18)),
      extraParams: { from: bob, value: dec(100, "ether") },
    });

    // Alice creates a single trove with 0.7 ETH and a debt of 70 Bold, and provides 10 Bold to SP
    const { troveId: aliceTroveId, collateral: A_collateral, totalDebt: A_totalDebt } = await openTrove({
      ICR: toBN(dec(2, 18)),
      extraParams: { from: alice },
    });

    // Alice proves 10 Bold to SP
    await th.provideToSPAndClaim(contracts, dec(10, 18), { from: alice });

    // Set ETH:USD price to 105
    await priceFeed.setPrice("105000000000000000000");
    const price = await priceFeed.getPrice();

    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    const alice_ICR = (
      await troveManager.getCurrentICR(aliceTroveId, price)
    ).toString();
    assert.equal(alice_ICR, "1050000000000000000");

    const activeTrovesCount_Before = await troveManager.getTroveIdsCount();

    assert.equal(activeTrovesCount_Before, 2);

    // Confirm system is not below CT
    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    // Liquidate the trove
    await troveManager.liquidate(aliceTroveId, { from: owner });

    // Check Alice's trove is removed, and bob remains
    const activeTrovesCount_After = await troveManager.getTroveIdsCount();
    assert.equal(activeTrovesCount_After, 1);

    const alice_isInSortedList = await sortedTroves.contains(aliceTroveId);
    assert.isFalse(alice_isInSortedList);

    const bob_isInSortedList = await sortedTroves.contains(bobTroveId);
    assert.isTrue(bob_isInSortedList);
  });

  it("liquidate(): reverts if trove is non-existent", async () => {
    const { troveId: aliceTroveId } = await openTrove({ ICR: toBN(dec(4, 18)), extraParams: { from: alice } });
    const { troveId: bobTroveId } = await openTrove({ ICR: toBN(dec(21, 17)), extraParams: { from: bob } });

    assert.equal(await troveManager.getTroveStatus(th.addressToTroveId(carol)), 0); // check trove non-existent

    assert.isFalse(await sortedTroves.contains(th.addressToTroveId(carol)));

    // Confirm system is not below CT
    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    try {
      const txCarol = await troveManager.liquidate(th.addressToTroveId(carol));

      assert.isFalse(txCarol.receipt.status);
    } catch (err) {
      assert.include(err.message, "revert");
      assert.include(err.message, "Trove does not exist or is closed");
    }
  });

  it("liquidate(): reverts if trove has been closed", async () => {
    await openTrove({ ICR: toBN(dec(8, 18)), extraParams: { from: alice } });
    await openTrove({ ICR: toBN(dec(4, 18)), extraParams: { from: bob } });
    const { troveId: carolTroveId } = await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: carol } });

    assert.isTrue(await sortedTroves.contains(carolTroveId));

    // price drops, Carol ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18));

    // Carol liquidated, and her trove is closed
    const txCarol_L1 = await troveManager.liquidate(carolTroveId);
    assert.isTrue(txCarol_L1.receipt.status);

    assert.isFalse(await sortedTroves.contains(carolTroveId));

    assert.equal(await troveManager.getTroveStatus(carolTroveId), 3); // check trove closed by liquidation

    // Confirm system is not below CT
    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    try {
      const txCarol_L2 = await troveManager.liquidate(carolTroveId);

      assert.isFalse(txCarol_L2.receipt.status);
    } catch (err) {
      assert.include(err.message, "revert");
      assert.include(err.message, "Trove does not exist or is closed");
    }
  });

  it("liquidate(): does nothing if trove has >= 110% ICR", async () => {
    const { troveId: whaleTroveId } = await openTrove({ ICR: toBN(dec(3, 18)), extraParams: { from: whale } });
    const { troveId: bobTroveId } = await openTrove({ ICR: toBN(dec(3, 18)), extraParams: { from: bob } });

    const TCR_Before = (await th.getTCR(contracts)).toString();
    const listSize_Before = (await sortedTroves.getSize()).toString();

    const price = await priceFeed.getPrice();

    // Check Bob's ICR > 110%
    const bob_ICR = await troveManager.getCurrentICR(bobTroveId, price);
    assert.isTrue(bob_ICR.gte(mv._MCR));

    // Confirm system is not below CT
    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    // Attempt to liquidate bob
    await assertRevert(
      troveManager.liquidate(bobTroveId),
      "TroveManager: nothing to liquidate",
    );

    // Check bob active, check whale active
    assert.isTrue(await sortedTroves.contains(bobTroveId));
    assert.isTrue(await sortedTroves.contains(whaleTroveId));

    const TCR_After = (await th.getTCR(contracts)).toString();
    const listSize_After = (await sortedTroves.getSize()).toString();

    assert.equal(TCR_Before, TCR_After);
    assert.equal(listSize_Before, listSize_After);
  });

  it("liquidate(): Given the same price and no other trove changes, complete Pool offsets restore the TCR to its value prior to the defaulters opening troves", async () => {
    // Whale provides Bold to SP
    const spDeposit = toBN(dec(100, 24));
    await openTrove({
      ICR: toBN(dec(4, 18)),
      extraBoldAmount: spDeposit,
      extraParams: { from: whale },
    });
    await th.provideToSPAndClaim(contracts, spDeposit, { from: whale });

    await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: alice } });
    await openTrove({ ICR: toBN(dec(70, 18)), extraParams: { from: bob } });
    await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: carol } });
    await openTrove({ ICR: toBN(dec(200, 18)), extraParams: { from: dennis } });

    const TCR_Before = (await th.getTCR(contracts)).toString();

    const { troveId: defaulter_1_TroveId } = await openTrove({
      ICR: toBN(dec(202, 16)),
      extraParams: { from: defaulter_1 },
    });
    const { troveId: defaulter_2_TroveId } = await openTrove({
      ICR: toBN(dec(190, 16)),
      extraParams: { from: defaulter_2 },
    });
    const { troveId: defaulter_3_TroveId } = await openTrove({
      ICR: toBN(dec(196, 16)),
      extraParams: { from: defaulter_3 },
    });
    const { troveId: defaulter_4_TroveId } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraParams: { from: defaulter_4 },
    });

    assert.isTrue(await sortedTroves.contains(defaulter_1_TroveId));
    assert.isTrue(await sortedTroves.contains(defaulter_2_TroveId));
    assert.isTrue(await sortedTroves.contains(defaulter_3_TroveId));
    assert.isTrue(await sortedTroves.contains(defaulter_4_TroveId));

    // Price drop
    await priceFeed.setPrice(dec(100, 18));

    // Confirm system is not below CT
    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    // All defaulters liquidated
    await troveManager.liquidate(defaulter_1_TroveId);
    assert.isFalse(await sortedTroves.contains(defaulter_1_TroveId));

    await troveManager.liquidate(defaulter_2_TroveId);
    assert.isFalse(await sortedTroves.contains(defaulter_2_TroveId));

    await troveManager.liquidate(defaulter_3_TroveId);
    assert.isFalse(await sortedTroves.contains(defaulter_3_TroveId));

    await troveManager.liquidate(defaulter_4_TroveId);
    assert.isFalse(await sortedTroves.contains(defaulter_4_TroveId));

    // Price bounces back
    await priceFeed.setPrice(dec(200, 18));

    const TCR_After = (await th.getTCR(contracts)).toString();
    assert.equal(TCR_Before, TCR_After);
  });

  it("liquidate(): Pool offsets increase the TCR", async () => {
    // Whale provides Bold to SP
    const spDeposit = toBN(dec(100, 24));
    await openTrove({
      ICR: toBN(dec(4, 18)),
      extraBoldAmount: spDeposit,
      extraParams: { from: whale },
    });
    await th.provideToSPAndClaim(contracts, spDeposit, { from: whale });

    await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: alice } });
    await openTrove({ ICR: toBN(dec(70, 18)), extraParams: { from: bob } });
    await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: carol } });
    await openTrove({ ICR: toBN(dec(200, 18)), extraParams: { from: dennis } });

    const { troveId: defaulter_1_TroveId } = await openTrove({
      ICR: toBN(dec(202, 16)),
      extraParams: { from: defaulter_1 },
    });
    const { troveId: defaulter_2_TroveId } = await openTrove({
      ICR: toBN(dec(190, 16)),
      extraParams: { from: defaulter_2 },
    });
    const { troveId: defaulter_3_TroveId } = await openTrove({
      ICR: toBN(dec(196, 16)),
      extraParams: { from: defaulter_3 },
    });
    const { troveId: defaulter_4_TroveId } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraParams: { from: defaulter_4 },
    });

    assert.isTrue(await sortedTroves.contains(defaulter_1_TroveId));
    assert.isTrue(await sortedTroves.contains(defaulter_2_TroveId));
    assert.isTrue(await sortedTroves.contains(defaulter_3_TroveId));
    assert.isTrue(await sortedTroves.contains(defaulter_4_TroveId));

    await priceFeed.setPrice(dec(100, 18));

    const TCR_1 = await th.getTCR(contracts);

    // Confirm system is not below CT
    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    // Check TCR improves with each liquidation that is offset with Pool
    await troveManager.liquidate(defaulter_1_TroveId);
    assert.isFalse(await sortedTroves.contains(defaulter_1_TroveId));
    const TCR_2 = await th.getTCR(contracts);
    assert.isTrue(TCR_2.gte(TCR_1));

    await troveManager.liquidate(defaulter_2_TroveId);
    assert.isFalse(await sortedTroves.contains(defaulter_2_TroveId));
    const TCR_3 = await th.getTCR(contracts);
    assert.isTrue(TCR_3.gte(TCR_2));

    await troveManager.liquidate(defaulter_3_TroveId);
    assert.isFalse(await sortedTroves.contains(defaulter_3_TroveId));
    const TCR_4 = await th.getTCR(contracts);
    assert.isTrue(TCR_4.gte(TCR_3));

    await troveManager.liquidate(defaulter_4_TroveId);
    assert.isFalse(await sortedTroves.contains(defaulter_4_TroveId));
    const TCR_5 = await th.getTCR(contracts);
    assert.isTrue(TCR_5.gte(TCR_4));
  });

  it("liquidate(): a pure redistribution reduces the TCR only as a result of compensation", async () => {
    await openTrove({ ICR: toBN(dec(4, 18)), extraParams: { from: whale } });

    await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: alice } });
    await openTrove({ ICR: toBN(dec(70, 18)), extraParams: { from: bob } });
    await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: carol } });
    await openTrove({ ICR: toBN(dec(200, 18)), extraParams: { from: dennis } });

    const { troveId: defaulter_1_TroveId } = await openTrove({
      ICR: toBN(dec(202, 16)),
      extraParams: { from: defaulter_1 },
    });
    const { troveId: defaulter_2_TroveId } = await openTrove({
      ICR: toBN(dec(190, 16)),
      extraParams: { from: defaulter_2 },
    });
    const { troveId: defaulter_3_TroveId } = await openTrove({
      ICR: toBN(dec(196, 16)),
      extraParams: { from: defaulter_3 },
    });
    const { troveId: defaulter_4_TroveId } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraParams: { from: defaulter_4 },
    });

    assert.isTrue(await sortedTroves.contains(defaulter_1_TroveId));
    assert.isTrue(await sortedTroves.contains(defaulter_2_TroveId));
    assert.isTrue(await sortedTroves.contains(defaulter_3_TroveId));
    assert.isTrue(await sortedTroves.contains(defaulter_4_TroveId));

    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice();

    const TCR_0 = await th.getTCR(contracts);

    const entireSystemCollBefore = await troveManager.getEntireSystemColl();
    const entireSystemDebtBefore = await troveManager.getEntireSystemDebt();

    const expectedTCR_0 = entireSystemCollBefore
      .mul(price)
      .div(entireSystemDebtBefore);

    assert.isTrue(expectedTCR_0.eq(TCR_0));

    // Confirm system is not below CT
    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    // Check TCR does not decrease with each liquidation
    const liquidationTx_1 = await troveManager.liquidate(defaulter_1_TroveId);
    const [liquidatedDebt_1, liquidatedColl_1, gasComp_1] = th.getEmittedLiquidationValues(liquidationTx_1);
    assert.isFalse(await sortedTroves.contains(defaulter_1_TroveId));
    const TCR_1 = await th.getTCR(contracts);

    // Expect only change to TCR to be due to the issued gas compensation
    const expectedTCR_1 = entireSystemCollBefore
      .sub(gasComp_1)
      .mul(price)
      .div(entireSystemDebtBefore);

    assert.isTrue(expectedTCR_1.eq(TCR_1));

    const liquidationTx_2 = await troveManager.liquidate(defaulter_2_TroveId);
    const [liquidatedDebt_2, liquidatedColl_2, gasComp_2] = th.getEmittedLiquidationValues(liquidationTx_2);
    assert.isFalse(await sortedTroves.contains(defaulter_2_TroveId));

    const TCR_2 = await th.getTCR(contracts);

    const expectedTCR_2 = entireSystemCollBefore
      .sub(gasComp_1)
      .sub(gasComp_2)
      .mul(price)
      .div(entireSystemDebtBefore);

    assert.isTrue(expectedTCR_2.eq(TCR_2));

    const liquidationTx_3 = await troveManager.liquidate(defaulter_3_TroveId);
    const [liquidatedDebt_3, liquidatedColl_3, gasComp_3] = th.getEmittedLiquidationValues(liquidationTx_3);

    assert.isFalse(await sortedTroves.contains(defaulter_3_TroveId));

    const TCR_3 = await th.getTCR(contracts);

    const expectedTCR_3 = entireSystemCollBefore
      .sub(gasComp_1)
      .sub(gasComp_2)
      .sub(gasComp_3)
      .mul(price)
      .div(entireSystemDebtBefore);

    assert.isTrue(expectedTCR_3.eq(TCR_3));

    const liquidationTx_4 = await troveManager.liquidate(defaulter_4_TroveId);
    const [liquidatedDebt_4, liquidatedColl_4, gasComp_4] = th.getEmittedLiquidationValues(liquidationTx_4);
    assert.isFalse(await sortedTroves.contains(defaulter_4_TroveId));

    const TCR_4 = await th.getTCR(contracts);

    const expectedTCR_4 = entireSystemCollBefore
      .sub(gasComp_1)
      .sub(gasComp_2)
      .sub(gasComp_3)
      .sub(gasComp_4)
      .mul(price)
      .div(entireSystemDebtBefore);

    assert.isTrue(expectedTCR_4.eq(TCR_4));
  });

  it("liquidate(): does not affect the SP deposit or ETH gain when called on an SP depositor's address that has no trove", async () => {
    await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } });
    const spDeposit = toBN(dec(1, 24));
    await openTrove({
      ICR: toBN(dec(3, 18)),
      extraBoldAmount: spDeposit,
      extraParams: { from: bob },
    });
    const { troveId: carolTroveId, C_totalDebt, C_collateral } = await openTrove({
      ICR: toBN(dec(218, 16)),
      extraBoldAmount: toBN(dec(100, 18)),
      extraParams: { from: carol },
    });

    // Bob sends tokens to Dennis, who has no trove
    await boldToken.transfer(dennis, spDeposit, { from: bob });

    // Dennis provides Bold to SP
    await th.provideToSPAndClaim(contracts, spDeposit, { from: dennis });

    // Carol gets liquidated
    await priceFeed.setPrice(dec(100, 18));
    const liquidationTX_C = await troveManager.liquidate(carolTroveId);
    const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTX_C);

    assert.isFalse(await sortedTroves.contains(carolTroveId));
    // Check Dennis' SP deposit has absorbed Carol's debt, and he has received her liquidated ETH
    const dennis_Deposit_Before = (
      await stabilityPool.getCompoundedBoldDeposit(dennis)
    ).toString();
    const dennis_ETHGain_Before = (
      await stabilityPool.getDepositorCollGain(dennis)
    ).toString();
    assert.isAtMost(
      th.getDifference(dennis_Deposit_Before, spDeposit.sub(liquidatedDebt)),
      1000000,
    );
    assert.isAtMost(
      th.getDifference(dennis_ETHGain_Before, liquidatedColl),
      1000,
    );

    // Confirm system is not below CT
    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    // Attempt to liquidate Dennis
    try {
      const txDennis = await troveManager.liquidate(th.addressToTroveId(dennis));
      assert.isFalse(txDennis.receipt.status);
    } catch (err) {
      assert.include(err.message, "revert");
      assert.include(err.message, "Trove does not exist or is closed");
    }

    // Check Dennis' SP deposit does not change after liquidation attempt
    const dennis_Deposit_After = (
      await stabilityPool.getCompoundedBoldDeposit(dennis)
    ).toString();
    const dennis_ETHGain_After = (
      await stabilityPool.getDepositorCollGain(dennis)
    ).toString();
    assert.equal(dennis_Deposit_Before, dennis_Deposit_After);
    assert.equal(dennis_ETHGain_Before, dennis_ETHGain_After);
  });

  it("liquidate(): does not liquidate a SP depositor's trove with ICR > 110%, and does not affect their SP deposit or ETH gain", async () => {
    await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } });
    const spDeposit = toBN(dec(1, 24));
    const { troveId: bobTroveId } = await openTrove({
      ICR: toBN(dec(3, 18)),
      extraBoldAmount: spDeposit,
      extraParams: { from: bob },
    });
    const { troveId: carolTroveId } = await openTrove({
      ICR: toBN(dec(218, 16)),
      extraBoldAmount: toBN(dec(100, 18)),
      extraParams: { from: carol },
    });

    // Bob provides Bold to SP
    await th.provideToSPAndClaim(contracts, spDeposit, { from: bob });

    // Carol gets liquidated
    await priceFeed.setPrice(dec(100, 18));
    const liquidationTX_C = await troveManager.liquidate(carolTroveId);
    const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTX_C);
    assert.isFalse(await sortedTroves.contains(carolTroveId));

    // price bounces back - Bob's trove is >110% ICR again
    await priceFeed.setPrice(dec(200, 18));
    const price = await priceFeed.getPrice();
    assert.isTrue((await troveManager.getCurrentICR(bobTroveId, price)).gt(mv._MCR));

    // Check Bob' SP deposit has absorbed Carol's debt, and he has received her liquidated ETH
    const bob_Deposit_Before = (
      await stabilityPool.getCompoundedBoldDeposit(bob)
    ).toString();
    const bob_ETHGain_Before = (
      await stabilityPool.getDepositorCollGain(bob)
    ).toString();
    assert.isAtMost(
      th.getDifference(bob_Deposit_Before, spDeposit.sub(liquidatedDebt)),
      1000000,
    );
    assert.isAtMost(th.getDifference(bob_ETHGain_Before, liquidatedColl), 1000);

    // Confirm system is not below CT
    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    // Attempt to liquidate Bob
    await assertRevert(
      troveManager.liquidate(bobTroveId),
      "TroveManager: nothing to liquidate",
    );

    // Confirm Bob's trove is still active
    assert.isTrue(await sortedTroves.contains(bobTroveId));

    // Check Bob' SP deposit does not change after liquidation attempt
    const bob_Deposit_After = (
      await stabilityPool.getCompoundedBoldDeposit(bob)
    ).toString();
    const bob_ETHGain_After = (
      await stabilityPool.getDepositorCollGain(bob)
    ).toString();
    assert.equal(bob_Deposit_Before, bob_Deposit_After);
    assert.equal(bob_ETHGain_Before, bob_ETHGain_After);
  });

  it("liquidate(): liquidates a SP depositor's trove with ICR < 110%, and the liquidation correctly impacts their SP deposit and ETH gain", async () => {
    const A_spDeposit = toBN(dec(3, 24));
    const B_spDeposit = toBN(dec(1, 24));
    await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } });
    await openTrove({
      ICR: toBN(dec(8, 18)),
      extraBoldAmount: A_spDeposit,
      extraParams: { from: alice },
    });
    const { troveId: bobTroveId, collateral: B_collateral, totalDebt: B_debt } = await openTrove({
      ICR: toBN(dec(218, 16)),
      extraBoldAmount: B_spDeposit,
      extraParams: { from: bob },
    });
    const { troveId: carolTroveId, collateral: C_collateral, totalDebt: C_debt } = await openTrove({
      ICR: toBN(dec(210, 16)),
      extraBoldAmount: toBN(dec(100, 18)),
      extraParams: { from: carol },
    });

    // Bob provides Bold to SP
    await th.provideToSPAndClaim(contracts, B_spDeposit, { from: bob });

    // Carol gets liquidated
    await priceFeed.setPrice(dec(100, 18));
    await troveManager.liquidate(carolTroveId);

    // Check Bob' SP deposit has absorbed Carol's debt, and he has received her liquidated ETH
    const bob_Deposit_Before = await stabilityPool.getCompoundedBoldDeposit(
      bob,
    );
    const bob_ETHGain_Before = await stabilityPool.getDepositorCollGain(bob);
    assert.isAtMost(
      th.getDifference(bob_Deposit_Before, B_spDeposit.sub(C_debt)),
      1000000,
    );
    assert.isAtMost(
      th.getDifference(
        bob_ETHGain_Before,
        th.applyLiquidationFee(C_collateral),
      ),
      1000,
    );

    // Alice provides Bold to SP
    await th.provideToSPAndClaim(contracts, A_spDeposit, { from: alice });

    // Confirm system is not below CT
    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    // Liquidate Bob
    await troveManager.liquidate(bobTroveId);

    // Confirm Bob's trove has been closed
    assert.isFalse(await sortedTroves.contains(bobTroveId));
    const bob_Trove_Status = (await troveManager.Troves(bobTroveId))[3].toString();
    assert.equal(bob_Trove_Status, 3); // check closed by liquidation

    /* Alice's Bold Loss = (300 / 400) * 200 = 150 Bold
      Alice's ETH gain = (300 / 400) * 2*0.995 = 1.4925 ETH

      Bob's BoldLoss = (100 / 400) * 200 = 50 Bold
      Bob's ETH gain = (100 / 400) * 2*0.995 = 0.4975 ETH

     Check Bob' SP deposit has been reduced to 50 Bold, and his ETH gain has increased to 1.5 ETH. */
    const alice_Deposit_After = (
      await stabilityPool.getCompoundedBoldDeposit(alice)
    ).toString();
    const alice_ETHGain_After = (
      await stabilityPool.getDepositorCollGain(alice)
    ).toString();

    const totalDeposits = bob_Deposit_Before.add(A_spDeposit);

    assert.isAtMost(
      th.getDifference(
        alice_Deposit_After,
        A_spDeposit.sub(B_debt.mul(A_spDeposit).div(totalDeposits)),
      ),
      2000000, // TODO: Unclear why the error margin on these two asserts increased. Rewrite test in Solidity
    );
    assert.isAtMost(
      th.getDifference(
        alice_ETHGain_After,
        th.applyLiquidationFee(B_collateral).mul(A_spDeposit).div(totalDeposits),
      ),
      2000000, // // TODO: Unclear why the error margin on these two asserts increased. Rewrite test in Solidity
    );

    const bob_Deposit_After = await stabilityPool.getCompoundedBoldDeposit(bob);
    const bob_ETHGain_After = await stabilityPool.getDepositorCollGain(bob);

    assert.isAtMost(
      th.getDifference(
        bob_Deposit_After,
        bob_Deposit_Before.sub(
          B_debt.mul(bob_Deposit_Before).div(totalDeposits),
        ),
      ),
      1000000,
    );
    assert.isAtMost(
      th.getDifference(
        bob_ETHGain_After,
        bob_ETHGain_Before.add(
          th
            .applyLiquidationFee(B_collateral)
            .mul(bob_Deposit_Before)
            .div(totalDeposits),
        ),
      ),
      1000000,
    );
  });

  it("liquidate(): does not alter the liquidated user's token balance", async () => {
    await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } });
    const { troveId: aliceTroveId, boldAmount: A_boldAmount } = await openTrove({
      ICR: toBN(dec(2, 18)),
      extraBoldAmount: toBN(dec(300, 18)),
      extraParams: { from: alice },
    });
    const { troveId: bobTroveId, boldAmount: B_boldAmount } = await openTrove({
      ICR: toBN(dec(2, 18)),
      extraBoldAmount: toBN(dec(200, 18)),
      extraParams: { from: bob },
    });
    const { troveId: carolTroveId, boldAmount: C_boldAmount } = await openTrove({
      ICR: toBN(dec(2, 18)),
      extraBoldAmount: toBN(dec(100, 18)),
      extraParams: { from: carol },
    });

    await priceFeed.setPrice(dec(100, 18));

    // Check sortedList size
    assert.equal((await sortedTroves.getSize()).toString(), "4");

    // Confirm system is not below CT
    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    // Liquidate A, B and C
    const activeBoldDebt_0 = await activePool.getBoldDebt();
    const defaultBoldDebt_0 = await defaultPool.getBoldDebt();

    await troveManager.liquidate(aliceTroveId);
    const activeBoldDebt_A = await activePool.getBoldDebt();
    const defaultBoldDebt_A = await defaultPool.getBoldDebt();

    await troveManager.liquidate(bobTroveId);
    const activeBoldDebt_B = await activePool.getBoldDebt();
    const defaultBoldDebt_B = await defaultPool.getBoldDebt();

    await troveManager.liquidate(carolTroveId);

    // Confirm A, B, C closed
    assert.isFalse(await sortedTroves.contains(aliceTroveId));
    assert.isFalse(await sortedTroves.contains(bobTroveId));
    assert.isFalse(await sortedTroves.contains(carolTroveId));

    // Check sortedList size reduced to 1
    assert.equal((await sortedTroves.getSize()).toString(), "1");

    // Confirm token balances have not changed
    assert.equal((await boldToken.balanceOf(alice)).toString(), A_boldAmount);
    assert.equal((await boldToken.balanceOf(bob)).toString(), B_boldAmount);
    assert.equal((await boldToken.balanceOf(carol)).toString(), C_boldAmount);
  });

  it("liquidate(): liquidates based on entire/collateral debt (including pending rewards), not raw collateral/debt", async () => {
    const { troveId: aliceTroveId } = await openTrove({
      ICR: toBN(dec(8, 18)),
      extraBoldAmount: toBN(dec(100, 18)),
      extraParams: { from: alice },
    });
    const { troveId: bobTroveId } = await openTrove({
      ICR: toBN(dec(221, 16)),
      extraBoldAmount: toBN(dec(100, 18)),
      extraParams: { from: bob },
    });
    const { troveId: carolTroveId } = await openTrove({
      ICR: toBN(dec(2, 18)),
      extraBoldAmount: toBN(dec(100, 18)),
      extraParams: { from: carol },
    });

    // Defaulter opens with 60 Bold, 0.6 ETH
    const { troveId: defaulter_1_TroveId } = await openTrove({
      ICR: toBN(dec(2, 18)),
      extraParams: { from: defaulter_1 },
    });

    // Price drops
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice();

    const alice_ICR_Before = await troveManager.getCurrentICR(aliceTroveId, price);
    const bob_ICR_Before = await troveManager.getCurrentICR(bobTroveId, price);
    const carol_ICR_Before = await troveManager.getCurrentICR(carolTroveId, price);

    /* Before liquidation:
    Alice ICR: = (2 * 100 / 50) = 400%
    Bob ICR: (1 * 100 / 90.5) = 110.5%
    Carol ICR: (1 * 100 / 100 ) =  100%

    Therefore Alice and Bob above the MCR, Carol is below */
    assert.isTrue(alice_ICR_Before.gte(mv._MCR));
    assert.isTrue(bob_ICR_Before.gte(mv._MCR));
    assert.isTrue(carol_ICR_Before.lte(mv._MCR));

    // Confirm system is not below CT
    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    /* Liquidate defaulter. 30 Bold and 0.3 ETH is distributed between A, B and C.

    A receives (30 * 2/4) = 15 Bold, and (0.3*2/4) = 0.15 ETH
    B receives (30 * 1/4) = 7.5 Bold, and (0.3*1/4) = 0.075 ETH
    C receives (30 * 1/4) = 7.5 Bold, and (0.3*1/4) = 0.075 ETH
    */
    await troveManager.liquidate(defaulter_1_TroveId);

    const alice_ICR_After = await troveManager.getCurrentICR(aliceTroveId, price);
    const bob_ICR_After = await troveManager.getCurrentICR(bobTroveId, price);
    const carol_ICR_After = await troveManager.getCurrentICR(carolTroveId, price);

    /* After liquidation:

    Alice ICR: (10.15 * 100 / 60) = 183.33%
    Bob ICR:(1.075 * 100 / 98) =  109.69%
    Carol ICR: (1.075 *100 /  107.5 ) = 100.0%

    Check Alice is above MCR, Bob below, Carol below. */

    assert.isTrue(alice_ICR_After.gte(mv._MCR));
    assert.isTrue(bob_ICR_After.lte(mv._MCR));
    assert.isTrue(carol_ICR_After.lte(mv._MCR));

    /* Though Bob's true ICR (including pending rewards) is below the MCR,
    check that Bob's raw coll and debt has not changed, and that his "raw" ICR is above the MCR */
    const bob_Coll = (await troveManager.Troves(bobTroveId))[1];
    const bob_Debt = (await troveManager.Troves(bobTroveId))[0];

    const bob_rawICR = bob_Coll.mul(toBN(dec(100, 18))).div(bob_Debt);
    assert.isTrue(bob_rawICR.gte(mv._MCR));

    // Whale enters system, pulling it into Normal Mode
    await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } });
    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    // Liquidate Alice, Bob, Carol
    await assertRevert(
      troveManager.liquidate(aliceTroveId),
      "TroveManager: nothing to liquidate",
    );
    await troveManager.liquidate(bobTroveId);
    await troveManager.liquidate(carolTroveId);

    /* Check Alice stays active, Carol gets liquidated, and Bob gets liquidated
   (because his pending rewards bring his ICR < MCR) */
    assert.isTrue(await sortedTroves.contains(aliceTroveId));
    assert.isFalse(await sortedTroves.contains(bobTroveId));
    assert.isFalse(await sortedTroves.contains(carolTroveId));

    // Check trove statuses - A active (1),  B and C liquidated (3)
    assert.equal((await troveManager.Troves(aliceTroveId))[3].toString(), "1");
    assert.equal((await troveManager.Troves(bobTroveId))[3].toString(), "3");
    assert.equal((await troveManager.Troves(carolTroveId))[3].toString(), "3");
  });

  // --- batchLiquidateTroves() ---

  it("batchLiquidateTroves(): liquidates based on entire/collateral debt (including pending rewards), not raw collateral/debt", async () => {
    const { troveId: aliceTroveId } = await openTrove({ ICR: toBN(dec(400, 16)), extraParams: { from: alice } });
    const { troveId: bobTroveId } = await openTrove({ ICR: toBN(dec(221, 16)), extraParams: { from: bob } });
    const { troveId: carolTroveId } = await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: carol } });
    const { troveId: defaulter_1_TroveId } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraParams: { from: defaulter_1 },
    });

    // Price drops
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice();

    const alice_ICR_Before = await troveManager.getCurrentICR(aliceTroveId, price);
    const bob_ICR_Before = await troveManager.getCurrentICR(bobTroveId, price);
    const carol_ICR_Before = await troveManager.getCurrentICR(carolTroveId, price);

    /* Before liquidation:
    Alice ICR: = (2 * 100 / 100) = 200%
    Bob ICR: (1 * 100 / 90.5) = 110.5%
    Carol ICR: (1 * 100 / 100 ) =  100%

    Therefore Alice and Bob above the MCR, Carol is below */
    assert.isTrue(alice_ICR_Before.gte(mv._MCR));
    assert.isTrue(bob_ICR_Before.gte(mv._MCR));
    assert.isTrue(carol_ICR_Before.lte(mv._MCR));

    // Liquidate defaulter. 30 Bold and 0.3 ETH is distributed uniformly between A, B and C. Each receive 10 Bold, 0.1 ETH
    await troveManager.liquidate(defaulter_1_TroveId);

    const alice_ICR_After = await troveManager.getCurrentICR(aliceTroveId, price);
    const bob_ICR_After = await troveManager.getCurrentICR(bobTroveId, price);
    const carol_ICR_After = await troveManager.getCurrentICR(carolTroveId, price);

    /* After liquidation:

    Alice ICR: (1.0995 * 100 / 60) = 183.25%
    Bob ICR:(1.0995 * 100 / 100.5) =  109.40%
    Carol ICR: (1.0995 * 100 / 110 ) 99.95%

    Check Alice is above MCR, Bob below, Carol below. */
    assert.isTrue(alice_ICR_After.gte(mv._MCR));
    assert.isTrue(bob_ICR_After.lte(mv._MCR));
    assert.isTrue(carol_ICR_After.lte(mv._MCR));

    /* Though Bob's true ICR (including pending rewards) is below the MCR, check that Bob's raw coll and debt has not changed */
    const bob_Coll = (await troveManager.Troves(bobTroveId))[1];
    const bob_Debt = (await troveManager.Troves(bobTroveId))[0];

    const bob_rawICR = bob_Coll.mul(toBN(dec(100, 18))).div(bob_Debt);
    assert.isTrue(bob_rawICR.gte(mv._MCR));

    // Alice adds coll, so TCR recovers above CT
    await th.addCollWrapper(contracts, {
      from: alice,
      value: toBN(dec(100, 18)),
    }),
      // Confirm system is not below CT
      assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    // liquidate A, B, C
    await troveManager.batchLiquidateTroves([aliceTroveId, bobTroveId, carolTroveId]);

    // Check A stays active, B and C get liquidated
    assert.isTrue(await sortedTroves.contains(aliceTroveId));
    assert.isFalse(await sortedTroves.contains(bobTroveId));
    assert.isFalse(await sortedTroves.contains(carolTroveId));

    // check trove statuses - A active (1),  B and C closed by liquidation (3)
    assert.equal((await troveManager.Troves(aliceTroveId))[3].toString(), "1");
    assert.equal((await troveManager.Troves(bobTroveId))[3].toString(), "3");
    assert.equal((await troveManager.Troves(carolTroveId))[3].toString(), "3");
  });

  it("batchLiquidateTroves():  liquidates troves with ICR < MCR", async () => {
    const { troveId: whaleTroveId } = await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } });

    // A, B, C open troves that will remain active when price drops to 100
    const { troveId: aliceTroveId } = await openTrove({ ICR: toBN(dec(220, 16)), extraParams: { from: alice } });
    const { troveId: bobTroveId } = await openTrove({ ICR: toBN(dec(230, 16)), extraParams: { from: bob } });
    const { troveId: carolTroveId } = await openTrove({ ICR: toBN(dec(240, 16)), extraParams: { from: carol } });

    // D, E, F open troves that will fall below MCR when price drops to 100
    const { troveId: dennisTroveId } = await openTrove({ ICR: toBN(dec(218, 16)), extraParams: { from: dennis } });
    const { troveId: erinTroveId } = await openTrove({ ICR: toBN(dec(216, 16)), extraParams: { from: erin } });
    const { troveId: flynTroveId } = await openTrove({ ICR: toBN(dec(210, 16)), extraParams: { from: flyn } });

    // Check list size is 7
    assert.equal((await sortedTroves.getSize()).toString(), "7");

    // Price drops
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice();

    const alice_ICR = await troveManager.getCurrentICR(aliceTroveId, price);
    const bob_ICR = await troveManager.getCurrentICR(bobTroveId, price);
    const carol_ICR = await troveManager.getCurrentICR(carolTroveId, price);
    const dennis_ICR = await troveManager.getCurrentICR(dennisTroveId, price);
    const erin_ICR = await troveManager.getCurrentICR(erinTroveId, price);
    const flyn_ICR = await troveManager.getCurrentICR(flynTroveId, price);

    // Check A, B, C have ICR above MCR
    assert.isTrue(alice_ICR.gte(mv._MCR));
    assert.isTrue(bob_ICR.gte(mv._MCR));
    assert.isTrue(carol_ICR.gte(mv._MCR));

    // Check D, E, F have ICR below MCR
    assert.isTrue(dennis_ICR.lte(mv._MCR));
    assert.isTrue(erin_ICR.lte(mv._MCR));
    assert.isTrue(flyn_ICR.lte(mv._MCR));

    // Confirm system is not below CT
    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    // Liquidate sequence
    await troveManager.batchLiquidateTroves([
      aliceTroveId,
      bobTroveId,
      carolTroveId,
      dennisTroveId,
      erinTroveId,
      flynTroveId,
      whaleTroveId,
    ]);

    // check list size reduced to 4
    assert.equal((await sortedTroves.getSize()).toString(), "4");

    // Check Whale and A, B, C remain in the system
    assert.isTrue(await sortedTroves.contains(whaleTroveId));
    assert.isTrue(await sortedTroves.contains(aliceTroveId));
    assert.isTrue(await sortedTroves.contains(bobTroveId));
    assert.isTrue(await sortedTroves.contains(carolTroveId));

    // Check D, E, F have been removed
    assert.isFalse(await sortedTroves.contains(dennisTroveId));
    assert.isFalse(await sortedTroves.contains(erinTroveId));
    assert.isFalse(await sortedTroves.contains(flynTroveId));
  });

  it("batchLiquidateTroves(): does not affect the liquidated user's token balances", async () => {
    const { troveId: whaleTroveId } = await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } });

    // D, E, F open troves that will fall below MCR when price drops to 100
    const { troveId: dennisTroveId } = await openTrove({ ICR: toBN(dec(218, 16)), extraParams: { from: dennis } });
    const { troveId: erinTroveId } = await openTrove({ ICR: toBN(dec(216, 16)), extraParams: { from: erin } });
    const { troveId: flynTroveId } = await openTrove({ ICR: toBN(dec(210, 16)), extraParams: { from: flyn } });

    const D_balanceBefore = await boldToken.balanceOf(dennis);
    const E_balanceBefore = await boldToken.balanceOf(erin);
    const F_balanceBefore = await boldToken.balanceOf(flyn);

    // Check list size is 4
    assert.equal((await sortedTroves.getSize()).toString(), "4");

    // Price drops
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice();

    // Confirm system is not below CT
    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    // Liquidate sequence
    await troveManager.batchLiquidateTroves([dennisTroveId, erinTroveId, flynTroveId, whaleTroveId]);

    // check list size reduced to 1
    assert.equal((await sortedTroves.getSize()).toString(), "1");

    // Check Whale remains in the system
    assert.isTrue(await sortedTroves.contains(whaleTroveId));

    // Check D, E, F have been removed
    assert.isFalse(await sortedTroves.contains(dennisTroveId));
    assert.isFalse(await sortedTroves.contains(erinTroveId));
    assert.isFalse(await sortedTroves.contains(flynTroveId));

    // Check token balances of users whose troves were liquidated, have not changed
    assert.equal(
      (await boldToken.balanceOf(dennis)).toString(),
      D_balanceBefore,
    );
    assert.equal((await boldToken.balanceOf(erin)).toString(), E_balanceBefore);
    assert.equal((await boldToken.balanceOf(flyn)).toString(), F_balanceBefore);
  });

  it("batchLiquidateTroves(): A liquidation sequence containing Pool offsets increases the TCR", async () => {
    // Whale provides 500 Bold to SP
    const { troveId: whaleTroveId } = await openTrove({
      ICR: toBN(dec(100, 18)),
      extraBoldAmount: toBN(dec(500, 18)),
      extraParams: { from: whale },
    });
    await th.provideToSPAndClaim(contracts, dec(500, 18), {
      from: whale,
    });

    const { troveId: aliceTroveId } = await openTrove({ ICR: toBN(dec(4, 18)), extraParams: { from: alice } });
    const { troveId: bobTroveId } = await openTrove({ ICR: toBN(dec(28, 18)), extraParams: { from: bob } });
    const { troveId: carolTroveId } = await openTrove({ ICR: toBN(dec(8, 18)), extraParams: { from: carol } });
    const { troveId: dennisTroveId } = await openTrove({ ICR: toBN(dec(80, 18)), extraParams: { from: dennis } });

    const { troveId: defaulter_1_TroveId } = await openTrove({
      ICR: toBN(dec(199, 16)),
      extraParams: { from: defaulter_1 },
    });
    const { troveId: defaulter_2_TroveId } = await openTrove({
      ICR: toBN(dec(156, 16)),
      extraParams: { from: defaulter_2 },
    });
    const { troveId: defaulter_3_TroveId } = await openTrove({
      ICR: toBN(dec(183, 16)),
      extraParams: { from: defaulter_3 },
    });
    const { troveId: defaulter_4_TroveId } = await openTrove({
      ICR: toBN(dec(166, 16)),
      extraParams: { from: defaulter_4 },
    });

    assert.isTrue(await sortedTroves.contains(defaulter_1_TroveId));
    assert.isTrue(await sortedTroves.contains(defaulter_2_TroveId));
    assert.isTrue(await sortedTroves.contains(defaulter_3_TroveId));
    assert.isTrue(await sortedTroves.contains(defaulter_4_TroveId));

    assert.equal((await sortedTroves.getSize()).toString(), "9");

    // Price drops
    await priceFeed.setPrice(dec(100, 18));

    const TCR_Before = await th.getTCR(contracts);

    // Check pool has 500 Bold
    assert.equal(
      (await stabilityPool.getTotalBoldDeposits()).toString(),
      dec(500, 18),
    );

    // Confirm system is not below CT
    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    // Liquidate troves
    await troveManager.batchLiquidateTroves([
      aliceTroveId,
      bobTroveId,
      carolTroveId,
      dennisTroveId,
      defaulter_1_TroveId,
      defaulter_2_TroveId,
      defaulter_3_TroveId,
      defaulter_4_TroveId,
      whaleTroveId,
    ]);

    // Check pool has been emptied by the liquidations
    assert.equal((await stabilityPool.getTotalBoldDeposits()).toString(), "0");

    // Check all defaulters have been liquidated
    assert.isFalse(await sortedTroves.contains(defaulter_1_TroveId));
    assert.isFalse(await sortedTroves.contains(defaulter_2_TroveId));
    assert.isFalse(await sortedTroves.contains(defaulter_3_TroveId));
    assert.isFalse(await sortedTroves.contains(defaulter_4_TroveId));

    // check system sized reduced to 5 troves
    assert.equal((await sortedTroves.getSize()).toString(), "5");

    // Check that the liquidation sequence has improved the TCR
    const TCR_After = await th.getTCR(contracts);
    assert.isTrue(TCR_After.gte(TCR_Before));
  });

  it("batchLiquidateTroves(): A liquidation sequence of pure redistributions decreases the TCR, due to gas compensation, but up to 0.5%", async () => {
    const { troveId: whaleTroveId, collateral: W_coll, totalDebt: W_debt } = await openTrove({
      ICR: toBN(dec(100, 18)),
      extraParams: { from: whale },
    });
    const { troveId: aliceTroveId, collateral: A_coll, totalDebt: A_debt } = await openTrove({
      ICR: toBN(dec(4, 18)),
      extraParams: { from: alice },
    });
    const { troveId: bobTroveId, collateral: B_coll, totalDebt: B_debt } = await openTrove({
      ICR: toBN(dec(28, 18)),
      extraParams: { from: bob },
    });
    const { troveId: carolTroveId, collateral: C_coll, totalDebt: C_debt } = await openTrove({
      ICR: toBN(dec(8, 18)),
      extraParams: { from: carol },
    });
    const { troveId: dennisTroveId, collateral: D_coll, totalDebt: D_debt } = await openTrove({
      ICR: toBN(dec(80, 18)),
      extraParams: { from: dennis },
    });

    const { troveId: defaulter_1_TroveId, collateral: d1_coll, totalDebt: d1_debt } = await openTrove({
      ICR: toBN(dec(199, 16)),
      extraParams: { from: defaulter_1 },
    });
    const { troveId: defaulter_2_TroveId, collateral: d2_coll, totalDebt: d2_debt } = await openTrove({
      ICR: toBN(dec(156, 16)),
      extraParams: { from: defaulter_2 },
    });
    const { troveId: defaulter_3_TroveId, collateral: d3_coll, totalDebt: d3_debt } = await openTrove({
      ICR: toBN(dec(183, 16)),
      extraParams: { from: defaulter_3 },
    });
    const { troveId: defaulter_4_TroveId, collateral: d4_coll, totalDebt: d4_debt } = await openTrove({
      ICR: toBN(dec(166, 16)),
      extraParams: { from: defaulter_4 },
    });

    const totalCollNonDefaulters = W_coll.add(A_coll)
      .add(B_coll)
      .add(C_coll)
      .add(D_coll);
    const totalCollDefaulters = d1_coll.add(d2_coll).add(d3_coll).add(d4_coll);
    const totalColl = totalCollNonDefaulters.add(totalCollDefaulters);
    const totalDebt = W_debt.add(A_debt)
      .add(B_debt)
      .add(C_debt)
      .add(D_debt)
      .add(d1_debt)
      .add(d2_debt)
      .add(d3_debt)
      .add(d4_debt);

    assert.isTrue(await sortedTroves.contains(defaulter_1_TroveId));
    assert.isTrue(await sortedTroves.contains(defaulter_2_TroveId));
    assert.isTrue(await sortedTroves.contains(defaulter_3_TroveId));
    assert.isTrue(await sortedTroves.contains(defaulter_4_TroveId));

    assert.equal((await sortedTroves.getSize()).toString(), "9");

    // Price drops
    const price = toBN(dec(100, 18));
    await priceFeed.setPrice(price);

    const TCR_Before = await th.getTCR(contracts);
    assert.isAtMost(
      th.getDifference(TCR_Before, totalColl.mul(price).div(totalDebt)),
      1000,
    );

    // Check pool is empty before liquidation
    assert.equal((await stabilityPool.getTotalBoldDeposits()).toString(), "0");

    // Confirm system is not below CT
    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    // Liquidate
    await troveManager.batchLiquidateTroves([
      aliceTroveId,
      bobTroveId,
      carolTroveId,
      dennisTroveId,
      defaulter_1_TroveId,
      defaulter_2_TroveId,
      defaulter_3_TroveId,
      defaulter_4_TroveId,
      whaleTroveId,
    ]);

    // Check all defaulters have been liquidated
    assert.isFalse(await sortedTroves.contains(defaulter_1_TroveId));
    assert.isFalse(await sortedTroves.contains(defaulter_2_TroveId));
    assert.isFalse(await sortedTroves.contains(defaulter_3_TroveId));
    assert.isFalse(await sortedTroves.contains(defaulter_4_TroveId));

    // check system sized reduced to 5 troves
    assert.equal((await sortedTroves.getSize()).toString(), "5");

    // Check that the liquidation sequence has reduced the TCR
    const TCR_After = await th.getTCR(contracts);
    // ((100+1+7+2+20)+(1+2+3+4)*0.995)*100/(2050+50+50+50+50+101+257+328+480)
    assert.isAtMost(
      th.getDifference(
        TCR_After,
        totalCollNonDefaulters
          .add(th.applyLiquidationFee(totalCollDefaulters))
          .mul(price)
          .div(totalDebt),
      ),
      1000,
    );
    assert.isTrue(TCR_Before.gte(TCR_After));
    assert.isTrue(TCR_After.gte(TCR_Before.mul(toBN(995)).div(toBN(1000))));
  });

  it("batchLiquidateTroves(): Liquidating troves with SP deposits correctly impacts their SP deposit and ETH gain", async () => {
    // Whale provides 40k Bold to the SP
    const whaleDeposit = toBN(dec(40000, 18));
    const { troveId: whaleTroveId } = await openTrove({
      ICR: toBN(dec(100, 18)),
      extraBoldAmount: whaleDeposit,
      extraParams: { from: whale },
    });
    await th.provideToSPAndClaim(contracts, whaleDeposit, {
      from: whale,
    });

    const A_deposit = toBN(dec(10000, 18));
    const B_deposit = toBN(dec(30000, 18));
    const { troveId: aliceTroveId, collateral: A_coll, totalDebt: A_debt } = await openTrove({
      ICR: toBN(dec(2, 18)),
      extraBoldAmount: A_deposit,
      extraParams: { from: alice },
    });
    const { troveId: bobTroveId, collateral: B_coll, totalDebt: B_debt } = await openTrove({
      ICR: toBN(dec(2, 18)),
      extraBoldAmount: B_deposit,
      extraParams: { from: bob },
    });
    const { troveId: carolTroveId, collateral: C_coll, totalDebt: C_debt } = await openTrove({
      ICR: toBN(dec(2, 18)),
      extraParams: { from: carol },
    });

    const liquidatedColl = A_coll.add(B_coll).add(C_coll);
    const liquidatedCollMinusFee = th.applyLiquidationFee(A_coll).add(th.applyLiquidationFee(B_coll)).add(th.applyLiquidationFee(C_coll));
    const liquidatedDebt = A_debt.add(B_debt).add(C_debt);

    // A, B provide 10k, 30k to the SP
    await th.provideToSPAndClaim(contracts, A_deposit, { from: alice });
    await th.provideToSPAndClaim(contracts, B_deposit, { from: bob });

    assert.equal((await sortedTroves.getSize()).toString(), "4");

    // Price drops
    await priceFeed.setPrice(dec(100, 18));

    // Check 80k Bold in Pool
    const totalDeposits = whaleDeposit.add(A_deposit).add(B_deposit);
    assert.equal(
      (await stabilityPool.getTotalBoldDeposits()).toString(),
      totalDeposits,
    );

    // Confirm system is not below CT
    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    // Liquidate
    await troveManager.batchLiquidateTroves([aliceTroveId, bobTroveId, carolTroveId, whaleTroveId]);

    // Check all defaulters have been liquidated
    assert.isFalse(await sortedTroves.contains(aliceTroveId));
    assert.isFalse(await sortedTroves.contains(bobTroveId));
    assert.isFalse(await sortedTroves.contains(carolTroveId));

    // check system sized reduced to 1 troves
    assert.equal((await sortedTroves.getSize()).toString(), "1");

    /* Prior to liquidation, SP deposits were:
    Whale: 400 Bold
    Alice: 100 Bold
    Bob:   300 Bold
    Carol: 0 Bold

    Total Bold in Pool: 800 Bold

    Then, liquidation hits A,B,C:

    Total liquidated debt = 150 + 350 + 150 = 650 Bold
    Total liquidated ETH = 1.1 + 3.1 + 1.1 = 5.3 ETH

    whale bold loss: 650 * (400/800) = 325 bold
    alice bold loss:  650 *(100/800) = 81.25 bold
    bob bold loss: 650 * (300/800) = 243.75 bold

    whale remaining deposit: (400 - 325) = 75 bold
    alice remaining deposit: (100 - 81.25) = 18.75 bold
    bob remaining deposit: (300 - 243.75) = 56.25 bold

    whale eth gain: 5*0.995 * (400/800) = 2.4875 eth
    alice eth gain: 5*0.995 *(100/800) = 0.621875 eth
    bob eth gain: 5*0.995 * (300/800) = 1.865625 eth

    Total remaining deposits: 150 Bold
    Total ETH gain: 4.975 ETH */

    // Check remaining Bold Deposits and ETH gain, for whale and depositors whose troves were liquidated
    const whale_Deposit_After = await stabilityPool.getCompoundedBoldDeposit(
      whale,
    );
    const alice_Deposit_After = await stabilityPool.getCompoundedBoldDeposit(
      alice,
    );
    const bob_Deposit_After = await stabilityPool.getCompoundedBoldDeposit(bob);

    const whale_ETHGain = await stabilityPool.getDepositorCollGain(whale);
    const alice_ETHGain = await stabilityPool.getDepositorCollGain(alice);
    const bob_ETHGain = await stabilityPool.getDepositorCollGain(bob);

    assert.isAtMost(
      th.getDifference(
        whale_Deposit_After,
        whaleDeposit.sub(liquidatedDebt.mul(whaleDeposit).div(totalDeposits)),
      ),
      100000,
    );
    assert.isAtMost(
      th.getDifference(
        alice_Deposit_After,
        A_deposit.sub(liquidatedDebt.mul(A_deposit).div(totalDeposits)),
      ),
      100000,
    );
    assert.isAtMost(
      th.getDifference(
        bob_Deposit_After,
        B_deposit.sub(liquidatedDebt.mul(B_deposit).div(totalDeposits)),
      ),
      100000,
    );

    assert.isAtMost(
      th.getDifference(
        whale_ETHGain,
        liquidatedCollMinusFee
          .mul(whaleDeposit)
          .div(totalDeposits),
      ),
      100000,
    );
    assert.isAtMost(
      th.getDifference(
        alice_ETHGain,
        liquidatedCollMinusFee.mul(A_deposit).div(totalDeposits),
      ),
      100000,
    );
    assert.isAtMost(
      th.getDifference(
        bob_ETHGain,
        liquidatedCollMinusFee.mul(B_deposit).div(totalDeposits),
      ),
      100000,
    );

    // Check total remaining deposits and ETH gain in Stability Pool
    const total_BoldinSP = (
      await stabilityPool.getTotalBoldDeposits()
    ).toString();
    const total_ETHinSP = (await stabilityPool.getCollBalance()).toString();

    assert.isAtMost(
      th.getDifference(total_BoldinSP, totalDeposits.sub(liquidatedDebt)),
      1000,
    );
    assert.isAtMost(
      th.getDifference(total_ETHinSP, liquidatedCollMinusFee),
      1000,
    );
  });

  it("batchLiquidateTroves(): liquidates a Trove that a) was skipped in a previous liquidation and b) has pending rewards", async () => {
    // A, B, C, D, E open troves
    const { troveId: CTroveId } = await openTrove({ ICR: toBN(dec(300, 16)), extraParams: { from: C } });
    const { troveId: DTroveId } = await openTrove({ ICR: toBN(dec(364, 16)), extraParams: { from: D } });
    const { troveId: ETroveId } = await openTrove({ ICR: toBN(dec(364, 16)), extraParams: { from: E } });
    const { troveId: ATroveId } = await openTrove({ ICR: toBN(dec(120, 16)), extraParams: { from: A } });
    const { troveId: BTroveId } = await openTrove({ ICR: toBN(dec(133, 16)), extraParams: { from: B } });

    // Price drops
    await priceFeed.setPrice(dec(175, 18));
    let price = await priceFeed.getPrice();

    // Confirm system is not below CT
    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    // A gets liquidated, creates pending rewards for all
    const liqTxA = await troveManager.liquidate(ATroveId);
    assert.isTrue(liqTxA.receipt.status);
    assert.isFalse(await sortedTroves.contains(ATroveId));

    // A adds 10 Bold to the SP, but less than C's debt
    await th.provideToSPAndClaim(contracts, dec(10, 18), { from: A });

    // Price drops
    await priceFeed.setPrice(dec(100, 18));
    price = await priceFeed.getPrice();
    // Confirm system is now below CT
    assert.isTrue(await th.checkBelowCriticalThreshold(contracts));

    // Confirm C has ICR > TCR
    const TCR = await troveManager.getTCR(price);
    const ICR_C = await troveManager.getCurrentICR(C, price);

    assert.isTrue(ICR_C.gt(TCR));

    // Attempt to liquidate B and C, which skips C in the liquidation since it is immune
    const liqTxBC = await troveManager.batchLiquidateTroves([BTroveId, CTroveId]);
    assert.isTrue(liqTxBC.receipt.status);
    assert.isFalse(await sortedTroves.contains(BTroveId));
    assert.isTrue(await sortedTroves.contains(CTroveId));
    assert.isTrue(await sortedTroves.contains(DTroveId));
    assert.isTrue(await sortedTroves.contains(ETroveId));

    // // All remaining troves D and E repay a little debt, applying their pending rewards
    assert.isTrue((await sortedTroves.getSize()).eq(toBN("3")));
    await borrowerOperations.repayBold(DTroveId, dec(1, 18), { from: D });
    await borrowerOperations.repayBold(ETroveId, dec(1, 18), { from: E });

    // Check C is the only trove that has pending rewards
    assert.isTrue(await troveManager.hasRedistributionGains(CTroveId));
    assert.isFalse(await troveManager.hasRedistributionGains(DTroveId));
    assert.isFalse(await troveManager.hasRedistributionGains(ETroveId));

    // Check C's pending coll and debt rewards are <= the coll and debt in the DefaultPool
    const pendingETH_C = await troveManager.getPendingCollReward(CTroveId);
    const pendingBoldDebt_C = await troveManager.getPendingBoldDebtReward(CTroveId);
    const defaultPoolETH = await defaultPool.getCollBalance();
    const defaultPoolBoldDebt = await defaultPool.getBoldDebt();
    assert.isTrue(pendingETH_C.lte(defaultPoolETH));
    assert.isTrue(pendingBoldDebt_C.lte(defaultPoolBoldDebt));
    // Check only difference is dust
    assert.isAtMost(th.getDifference(pendingETH_C, defaultPoolETH), 1000);
    assert.isAtMost(
      th.getDifference(pendingBoldDebt_C, defaultPoolBoldDebt),
      1000,
    );

    // Confirm system is still below CT
    assert.isTrue(await th.checkBelowCriticalThreshold(contracts));

    // D and E fill the Stability Pool, enough to completely absorb C's debt of 70
    await th.provideToSPAndClaim(contracts, dec(50, 18), { from: D });
    await th.provideToSPAndClaim(contracts, dec(50, 18), { from: E });

    await priceFeed.setPrice(dec(50, 18));

    // Try to liquidate C again. Check it succeeds and closes C's trove
    const liqTx2 = await troveManager.batchLiquidateTroves([CTroveId, DTroveId]);
    assert.isTrue(liqTx2.receipt.status);
    assert.isFalse(await sortedTroves.contains(CTroveId));
    assert.isFalse(await sortedTroves.contains(DTroveId));
    assert.isTrue(await sortedTroves.contains(ETroveId));
    assert.isTrue((await sortedTroves.getSize()).eq(toBN("1")));
  });

  it("batchLiquidateTroves(): closes every trove with ICR < MCR in the given array", async () => {
    // --- SETUP ---
    await openTrove({ ICR: toBN(dec(100, 18)), extraParams: { from: whale } });

    const { troveId: aliceTroveId } = await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: alice } });
    const { troveId: bobTroveId } = await openTrove({ ICR: toBN(dec(133, 16)), extraParams: { from: bob } });
    const { troveId: carolTroveId } = await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: carol } });
    const { troveId: dennisTroveId } = await openTrove({
      ICR: toBN(dec(2000, 16)),
      extraParams: { from: dennis },
    });
    const { troveId: erinTroveId } = await openTrove({ ICR: toBN(dec(1800, 16)), extraParams: { from: erin } });

    // Check full sorted list size is 6
    assert.equal((await sortedTroves.getSize()).toString(), "6");

    // Whale puts some tokens in Stability Pool
    await th.provideToSPAndClaim(contracts, dec(300, 18), {
      from: whale,
    });

    // --- TEST ---

    // Price drops to 1ETH:100Bold, reducing A, B, C ICR below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice();

    // Confirm system is not below CT
    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    // Confirm troves A-C are ICR < 110%
    assert.isTrue((await troveManager.getCurrentICR(aliceTroveId, price)).lt(mv._MCR));
    assert.isTrue((await troveManager.getCurrentICR(bobTroveId, price)).lt(mv._MCR));
    assert.isTrue((await troveManager.getCurrentICR(carolTroveId, price)).lt(mv._MCR));

    // Confirm D-E are ICR > 110%
    assert.isTrue(
      (await troveManager.getCurrentICR(dennisTroveId, price)).gte(mv._MCR),
    );
    assert.isTrue((await troveManager.getCurrentICR(erinTroveId, price)).gte(mv._MCR));

    // Confirm Whale is ICR >= 110%
    assert.isTrue(
      (await troveManager.getCurrentICR(whale, price)).gte(mv._MCR),
    );

    const liquidationArray = [aliceTroveId, bobTroveId, carolTroveId, dennisTroveId, erinTroveId];
    await troveManager.batchLiquidateTroves(liquidationArray);

    // Confirm troves A-C have been removed from the system
    assert.isFalse(await sortedTroves.contains(aliceTroveId));
    assert.isFalse(await sortedTroves.contains(bobTroveId));
    assert.isFalse(await sortedTroves.contains(carolTroveId));

    // Check all troves A-C are now closed by liquidation
    assert.equal((await troveManager.Troves(aliceTroveId))[3].toString(), "3");
    assert.equal((await troveManager.Troves(bobTroveId))[3].toString(), "3");
    assert.equal((await troveManager.Troves(carolTroveId))[3].toString(), "3");

    // Check sorted list has been reduced to length 3
    assert.equal((await sortedTroves.getSize()).toString(), "3");
  });

  it("batchLiquidateTroves(): does not liquidate troves that are not in the given array", async () => {
    // --- SETUP ---
    await openTrove({ ICR: toBN(dec(100, 18)), extraParams: { from: whale } });

    const { troveId: aliceTroveId } = await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: alice } });
    const { troveId: bobTroveId } = await openTrove({ ICR: toBN(dec(180, 16)), extraParams: { from: bob } });
    const { troveId: carolTroveId } = await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: carol } });
    const { troveId: dennisTroveId } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraBoldAmount: toBN(dec(500, 18)),
      extraParams: { from: dennis },
    });
    const { troveId: erinTroveId } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraBoldAmount: toBN(dec(500, 18)),
      extraParams: { from: erin },
    });

    // Check full sorted list size is 6
    assert.equal((await sortedTroves.getSize()).toString(), "6");

    // Whale puts some tokens in Stability Pool
    await th.provideToSPAndClaim(contracts, dec(300, 18), {
      from: whale,
    });

    // --- TEST ---

    // Price drops to 1ETH:100Bold, reducing A, B, C ICR below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice();

    // Confirm system is not below CT
    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    // Confirm troves A-E are ICR < 110%
    assert.isTrue((await troveManager.getCurrentICR(aliceTroveId, price)).lt(mv._MCR));
    assert.isTrue((await troveManager.getCurrentICR(bobTroveId, price)).lt(mv._MCR));
    assert.isTrue((await troveManager.getCurrentICR(carolTroveId, price)).lt(mv._MCR));
    assert.isTrue(
      (await troveManager.getCurrentICR(dennisTroveId, price)).lt(mv._MCR),
    );
    assert.isTrue((await troveManager.getCurrentICR(erinTroveId, price)).lt(mv._MCR));

    const liquidationArray = [aliceTroveId, bobTroveId]; // C-E not included
    await troveManager.batchLiquidateTroves(liquidationArray);

    // Confirm troves A-B have been removed from the system
    assert.isFalse(await sortedTroves.contains(aliceTroveId));
    assert.isFalse(await sortedTroves.contains(bobTroveId));

    // Check all troves A-B are now closed by liquidation
    assert.equal((await troveManager.Troves(aliceTroveId))[3].toString(), "3");
    assert.equal((await troveManager.Troves(bobTroveId))[3].toString(), "3");

    // Confirm troves C-E remain in the system
    assert.isTrue(await sortedTroves.contains(carolTroveId));
    assert.isTrue(await sortedTroves.contains(dennisTroveId));
    assert.isTrue(await sortedTroves.contains(erinTroveId));

    // Check all troves C-E are still active
    assert.equal((await troveManager.Troves(carolTroveId))[3].toString(), "1");
    assert.equal((await troveManager.Troves(dennisTroveId))[3].toString(), "1");
    assert.equal((await troveManager.Troves(erinTroveId))[3].toString(), "1");

    // Check sorted list has been reduced to length 4
    assert.equal((await sortedTroves.getSize()).toString(), "4");
  });

  it("batchLiquidateTroves(): does not close troves with ICR >= MCR in the given array", async () => {
    // --- SETUP ---
    const { troveId: whaleTroveId } = await openTrove({ ICR: toBN(dec(100, 18)), extraParams: { from: whale } });

    const { troveId: aliceTroveId } = await openTrove({ ICR: toBN(dec(190, 16)), extraParams: { from: alice } });
    const { troveId: bobTroveId } = await openTrove({ ICR: toBN(dec(120, 16)), extraParams: { from: bob } });
    const { troveId: carolTroveId } = await openTrove({ ICR: toBN(dec(195, 16)), extraParams: { from: carol } });
    const { troveId: dennisTroveId } = await openTrove({
      ICR: toBN(dec(2000, 16)),
      extraParams: { from: dennis },
    });
    const { troveId: erinTroveId } = await openTrove({ ICR: toBN(dec(1800, 16)), extraParams: { from: erin } });

    // Check full sorted list size is 6
    assert.equal((await sortedTroves.getSize()).toString(), "6");

    // Whale puts some tokens in Stability Pool
    await th.provideToSPAndClaim(contracts, dec(300, 18), {
      from: whale,
    });

    // --- TEST ---

    // Price drops to 1ETH:100Bold, reducing A, B, C ICR below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice();

    // Confirm system is not below CT
    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    // Confirm troves A-C are ICR < 110%
    assert.isTrue((await troveManager.getCurrentICR(aliceTroveId, price)).lt(mv._MCR));
    assert.isTrue((await troveManager.getCurrentICR(bobTroveId, price)).lt(mv._MCR));
    assert.isTrue((await troveManager.getCurrentICR(carolTroveId, price)).lt(mv._MCR));

    // Confirm D-E are ICR >= 110%
    assert.isTrue(
      (await troveManager.getCurrentICR(dennisTroveId, price)).gte(mv._MCR),
    );
    assert.isTrue((await troveManager.getCurrentICR(erinTroveId, price)).gte(mv._MCR));

    // Confirm Whale is ICR > 110%
    assert.isTrue(
      (await troveManager.getCurrentICR(whale, price)).gte(mv._MCR),
    );

    const liquidationArray = [aliceTroveId, bobTroveId, carolTroveId, dennisTroveId, erinTroveId];
    await troveManager.batchLiquidateTroves(liquidationArray);

    // Confirm troves D-E and whale remain in the system
    assert.isTrue(await sortedTroves.contains(dennisTroveId));
    assert.isTrue(await sortedTroves.contains(erinTroveId));
    assert.isTrue(await sortedTroves.contains(whaleTroveId));

    // Check all troves D-E and whale remain active
    assert.equal((await troveManager.Troves(dennisTroveId))[3].toString(), "1");
    assert.equal((await troveManager.Troves(erinTroveId))[3].toString(), "1");
    assert.isTrue(await sortedTroves.contains(whaleTroveId));

    // Check sorted list has been reduced to length 3
    assert.equal((await sortedTroves.getSize()).toString(), "3");
  });

  it("batchLiquidateTroves(): reverts if array is empty", async () => {
    // --- SETUP ---
    await openTrove({ ICR: toBN(dec(100, 18)), extraParams: { from: whale } });

    await openTrove({ ICR: toBN(dec(190, 16)), extraParams: { from: alice } });
    await openTrove({ ICR: toBN(dec(120, 16)), extraParams: { from: bob } });
    await openTrove({ ICR: toBN(dec(195, 16)), extraParams: { from: carol } });
    await openTrove({
      ICR: toBN(dec(2000, 16)),
      extraParams: { from: dennis },
    });
    await openTrove({ ICR: toBN(dec(1800, 16)), extraParams: { from: erin } });

    // Check full sorted list size is 6
    assert.equal((await sortedTroves.getSize()).toString(), "6");

    // Whale puts some tokens in Stability Pool
    await th.provideToSPAndClaim(contracts, dec(300, 18), {
      from: whale,
    });

    // --- TEST ---

    // Price drops to 1ETH:100Bold, reducing A, B, C ICR below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice();

    // Confirm system is not below CT
    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    const liquidationArray = [];
    try {
      const tx = await troveManager.batchLiquidateTroves(liquidationArray);
      assert.isFalse(tx.receipt.status);
    } catch (error) {
      assert.include(
        error.message,
        "TroveManager: Calldata address array must not be empty",
      );
    }
  });

  it("batchLiquidateTroves(): skips if trove is non-existent", async () => {
    // --- SETUP ---
    const spDeposit = toBN(dec(500000, 18));
    await openTrove({
      ICR: toBN(dec(100, 18)),
      extraBoldAmount: spDeposit,
      extraParams: { from: whale },
    });

    const { troveId: aliceTroveId, totalDebt: A_debt } = await openTrove({
      ICR: toBN(dec(190, 16)),
      extraParams: { from: alice },
    });
    const { troveId: bobTroveId, totalDebt: B_debt } = await openTrove({
      ICR: toBN(dec(120, 16)),
      extraParams: { from: bob },
    });
    const { troveId: dennisTroveId } = await openTrove({
      ICR: toBN(dec(2000, 16)),
      extraParams: { from: dennis },
    });
    const { troveId: erinTroveId } = await openTrove({ ICR: toBN(dec(1800, 16)), extraParams: { from: erin } });

    assert.equal(await troveManager.getTroveStatus(th.addressToTroveId(carol)), 0); // check trove non-existent

    // Check full sorted list size is 6
    assert.equal((await sortedTroves.getSize()).toString(), "5");

    // Whale puts some tokens in Stability Pool
    await th.provideToSPAndClaim(contracts, spDeposit, { from: whale });

    // --- TEST ---

    // Price drops to 1ETH:100Bold, reducing A, B, C ICR below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice();

    // Confirm system is not below CT
    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    // Confirm troves A-B are ICR < 110%
    assert.isTrue((await troveManager.getCurrentICR(aliceTroveId, price)).lt(mv._MCR));
    assert.isTrue((await troveManager.getCurrentICR(bobTroveId, price)).lt(mv._MCR));

    // Confirm D-E are ICR > 110%
    assert.isTrue(
      (await troveManager.getCurrentICR(dennisTroveId, price)).gte(mv._MCR),
    );
    assert.isTrue((await troveManager.getCurrentICR(erinTroveId, price)).gte(mv._MCR));

    // Confirm Whale is ICR >= 110%
    assert.isTrue(
      (await troveManager.getCurrentICR(whale, price)).gte(mv._MCR),
    );

    // Liquidate - trove C in between the ones to be liquidated!
    const liquidationArray = [aliceTroveId, th.addressToTroveId(carol), bobTroveId, dennisTroveId, erinTroveId];
    await troveManager.batchLiquidateTroves(liquidationArray);

    // Confirm troves A-B have been removed from the system
    assert.isFalse(await sortedTroves.contains(aliceTroveId));
    assert.isFalse(await sortedTroves.contains(bobTroveId));

    // Check all troves A-B are now closed by liquidation
    assert.equal((await troveManager.Troves(aliceTroveId))[3].toString(), "3");
    assert.equal((await troveManager.Troves(bobTroveId))[3].toString(), "3");

    // Check sorted list has been reduced to length 3
    assert.equal((await sortedTroves.getSize()).toString(), "3");

    // Confirm trove C non-existent
    assert.isFalse(await sortedTroves.contains(th.addressToTroveId(carol)));
    assert.equal((await troveManager.Troves(th.addressToTroveId(carol)))[3].toString(), "0");

    // Check Stability pool has only been reduced by A-B
    th.assertIsApproximatelyEqual(
      (await stabilityPool.getTotalBoldDeposits()).toString(),
      spDeposit.sub(A_debt).sub(B_debt),
    );

    // Confirm system is not below CT
    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));
  });

  it("batchLiquidateTroves(): skips if a trove has been closed", async () => {
    // --- SETUP ---
    const spDeposit = toBN(dec(500000, 18));
    await openTrove({
      ICR: toBN(dec(100, 18)),
      extraBoldAmount: spDeposit,
      extraParams: { from: whale },
    });

    const { troveId: aliceTroveId, totalDebt: A_debt } = await openTrove({
      ICR: toBN(dec(190, 16)),
      extraParams: { from: alice },
    });
    const { troveId: bobTroveId, totalDebt: B_debt } = await openTrove({
      ICR: toBN(dec(120, 16)),
      extraParams: { from: bob },
    });
    const { troveId: carolTroveId } = await openTrove({ ICR: toBN(dec(195, 16)), extraParams: { from: carol } });
    const { troveId: dennisTroveId } = await openTrove({
      ICR: toBN(dec(2000, 16)),
      extraParams: { from: dennis },
    });
    const { troveId: erinTroveId } = await openTrove({ ICR: toBN(dec(1800, 16)), extraParams: { from: erin } });

    assert.isTrue(await sortedTroves.contains(carolTroveId));

    // Check full sorted list size is 6
    assert.equal((await sortedTroves.getSize()).toString(), "6");

    // Whale puts some tokens in Stability Pool
    await th.provideToSPAndClaim(contracts, spDeposit, { from: whale });

    // Whale transfers to Carol so she can close her trove
    await boldToken.transfer(carol, dec(100, 18), { from: whale });

    // --- TEST ---

    // Price drops to 1ETH:100Bold, reducing A, B, C ICR below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice();

    // Carol liquidated, and her trove is closed
    const txCarolClose = await borrowerOperations.closeTrove(carolTroveId, { from: carol });
    assert.isTrue(txCarolClose.receipt.status);

    assert.isFalse(await sortedTroves.contains(carolTroveId));

    assert.equal(await troveManager.getTroveStatus(carolTroveId), 2); // check trove closed

    // Confirm system is not below CT
    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    // Confirm troves A-B are ICR < 110%
    assert.isTrue((await troveManager.getCurrentICR(aliceTroveId, price)).lt(mv._MCR));
    assert.isTrue((await troveManager.getCurrentICR(bobTroveId, price)).lt(mv._MCR));

    // Confirm D-E are ICR > 110%
    assert.isTrue(
      (await troveManager.getCurrentICR(dennisTroveId, price)).gte(mv._MCR),
    );
    assert.isTrue((await troveManager.getCurrentICR(erinTroveId, price)).gte(mv._MCR));

    // Confirm Whale is ICR >= 110%
    assert.isTrue(
      (await troveManager.getCurrentICR(whale, price)).gte(mv._MCR),
    );

    // Liquidate - trove C in between the ones to be liquidated!
    const liquidationArray = [aliceTroveId, carolTroveId, bobTroveId, dennisTroveId, erinTroveId];
    await troveManager.batchLiquidateTroves(liquidationArray);

    // Confirm troves A-B have been removed from the system
    assert.isFalse(await sortedTroves.contains(aliceTroveId));
    assert.isFalse(await sortedTroves.contains(bobTroveId));

    // Check all troves A-B are now closed by liquidation
    assert.equal((await troveManager.Troves(aliceTroveId))[3].toString(), "3");
    assert.equal((await troveManager.Troves(bobTroveId))[3].toString(), "3");
    // Trove C still closed by user
    assert.equal((await troveManager.Troves(carolTroveId))[3].toString(), "2");

    // Check sorted list has been reduced to length 3
    assert.equal((await sortedTroves.getSize()).toString(), "3");

    // Check Stability pool has only been reduced by A-B
    th.assertIsApproximatelyEqual(
      (await stabilityPool.getTotalBoldDeposits()).toString(),
      spDeposit.sub(A_debt).sub(B_debt),
    );

    // Confirm system is not below CT
    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));
  });

  // --- redemptions ---

  it("redeemCollateral(): cancels the provided Bold with debt from Troves with the lowest ICRs and sends an equivalent amount of Ether", async () => {
    // --- SETUP ---
    const { troveId: aliceTroveId, totalDebt: A_totalDebt } = await openTrove({
      ICR: toBN(dec(310, 16)),
      extraBoldAmount: dec(10, 18),
      extraParams: { from: alice, annualInterestRate: dec(5, 16) },
    });
    const { troveId: bobTroveId, netDebt: B_netDebt } = await openTrove({
      ICR: toBN(dec(290, 16)),
      extraBoldAmount: dec(8, 18),
      extraParams: { from: bob, annualInterestRate: dec(4, 16) },
    });
    const { troveId: carolTroveId, netDebt: C_netDebt } = await openTrove({
      ICR: toBN(dec(250, 16)),
      extraBoldAmount: dec(10, 18),
      extraParams: { from: carol, annualInterestRate: dec(3, 16) },
    });
    const partialRedemptionAmount = toBN(2);
    const redemptionAmount = C_netDebt.add(B_netDebt).add(partialRedemptionAmount).add(toBN("5398095758126238615"));
    // start Dennis with a high interest
    await openTrove({
      ICR: toBN(dec(100, 18)),
      extraBoldAmount: redemptionAmount,
      extraParams: { from: dennis, annualInterestRate: dec(50, 16) },
    });

    const dennis_ETHBalance_Before = toBN(await contracts.WETH.balanceOf(dennis));

    const dennis_BoldBalance_Before = await boldToken.balanceOf(dennis);

    const price = await priceFeed.getPrice();
    assert.equal(price, dec(200, 18));

    // --- TEST ---

    // skip bootstrapping phase
    await time.increase(timeValues.SECONDS_IN_ONE_WEEK * 2);

    const ETHFee = await contracts.troveManager.getEffectiveRedemptionFeeInColl(redemptionAmount, price);

    // Dennis redeems 20 Bold
    // Don't pay for gas, as it makes it easier to calculate the received Ether
    const redemptionTx = await th.redeemCollateralAndGetTxObject(
      dennis,
      contracts,
      redemptionAmount,
      10,
      th._100pct,
      GAS_PRICE,
    );

    const alice_Trove_After = await troveManager.Troves(aliceTroveId);
    const bob_Trove_After = await troveManager.Troves(bobTroveId);
    const carol_Trove_After = await troveManager.Troves(carolTroveId);

    const alice_debt_After = alice_Trove_After[0].toString();
    const bob_debt_After = bob_Trove_After[0].toString();
    const carol_debt_After = carol_Trove_After[0].toString();

    /* check that Dennis' redeemed 20 Bold has been cancelled with debt from Bobs's Trove (8) and Carol's Trove (10).
    The remaining lot (2) is sent to Alice's Trove, who had the best ICR.
    It leaves her with (3) Bold debt + 50 for gas compensation. */
    th.assertIsApproximatelyEqual(
      alice_debt_After,
      A_totalDebt.sub(partialRedemptionAmount),
    );
    assert.equal(bob_debt_After.toString(), "0");
    assert.equal(carol_debt_After.toString(), "0");

    const dennis_ETHBalance_After = toBN(await contracts.WETH.balanceOf(dennis));
    const receivedETH = dennis_ETHBalance_After.sub(dennis_ETHBalance_Before);

    const expectedTotalETHDrawn = redemptionAmount.div(toBN(200)); // convert redemptionAmount Bold to ETH, at ETH:USD price 200
    const expectedReceivedETH = expectedTotalETHDrawn.sub(ETHFee);

    // console.log("*********************************************************************************")
    // console.log("ETHFee: " + ETHFee)
    // console.log("dennis_ETHBalance_Before: " + dennis_ETHBalance_Before)
    // console.log("GAS_USED: " + th.gasUsed(redemptionTx))
    // console.log("dennis_ETHBalance_After: " + dennis_ETHBalance_After)
    // console.log("expectedTotalETHDrawn: " + expectedTotalETHDrawn)
    // console.log("received  : " + receivedETH)
    // console.log("expected : " + expectedReceivedETH)
    // console.log("*********************************************************************************")
    th.assertIsApproximatelyEqual(expectedReceivedETH, receivedETH);

    const dennis_BoldBalance_After = (
      await boldToken.balanceOf(dennis)
    ).toString();
    assert.equal(
      dennis_BoldBalance_After,
      dennis_BoldBalance_Before.sub(redemptionAmount),
    );
  });

  it("redeemCollateral(): ends the redemption sequence when the token redemption request has been filled", async () => {
    // --- SETUP ---
    await openTrove({ ICR: toBN(dec(100, 18)), extraParams: { from: whale, annualInterestRate: dec(90, 16) } });

    // Alice, Bob, Carol, Dennis, Erin open troves
    const { troveId: aliceTroveId, netDebt: A_debt } = await openTrove({
      ICR: toBN(dec(290, 16)),
      extraBoldAmount: dec(20, 18),
      extraParams: { from: alice, annualInterestRate: dec(5, 16) },
    });
    const { troveId: bobTroveId, netDebt: B_debt } = await openTrove({
      ICR: toBN(dec(290, 16)),
      extraBoldAmount: dec(20, 18),
      extraParams: { from: bob, annualInterestRate: dec(5, 16) },
    });
    const { troveId: carolTroveId, netDebt: C_debt } = await openTrove({
      ICR: toBN(dec(290, 16)),
      extraBoldAmount: dec(20, 18),
      extraParams: { from: carol, annualInterestRate: dec(5, 16) },
    });
    const redemptionAmount = A_debt.add(B_debt).add(C_debt).add(toBN(11701736130990849939)); // A+B+C+interest
    const { troveId: dennisTroveId, totalDebt: D_totalDebt, collateral: D_coll } = await openTrove({
      ICR: toBN(dec(300, 16)),
      extraBoldAmount: dec(10, 18),
      extraParams: { from: dennis, annualInterestRate: dec(6, 16) },
    });
    const { troveId: erinTroveId, totalDebt: E_totalDebt, netDebt: E_netDebt, collateral: E_coll } = await openTrove({
      ICR: toBN(dec(300, 16)),
      extraBoldAmount: dec(10, 18),
      extraParams: { from: erin, annualInterestRate: dec(6, 16) },
    });

    // --- TEST ---

    // open trove from redeemer.  Redeemer has highest ICR (100ETH, 100 Bold), 20000%
    const { boldAmount: F_boldAmount } = await openTrove({
      ICR: toBN(dec(200, 18)),
      extraBoldAmount: redemptionAmount.mul(toBN(2)),
      extraParams: { from: flyn, annualInterestRate: dec(50, 16) },
    });

    // skip bootstrapping phase
    await time.increase(timeValues.SECONDS_IN_ONE_WEEK * 2);
    const E_interest = await troveManager.calcTroveAccruedInterest(erinTroveId);

    // Flyn redeems collateral
    await th.redeemCollateral(
      flyn,
      contracts,
      redemptionAmount,
      th._100pct,
    );

    // Check Flyn's redemption has reduced his balance from 100 to (100-60) = 40 Bold
    const flynBalance = await boldToken.balanceOf(flyn);
    th.assertIsApproximatelyEqual(
      flynBalance,
      F_boldAmount.sub(redemptionAmount),
    );

    // Check debt of Alice, Bob, Carol
    const alice_Debt = await troveManager.getTroveDebt(aliceTroveId);
    const bob_Debt = await troveManager.getTroveDebt(bobTroveId);
    const carol_Debt = await troveManager.getTroveDebt(carolTroveId);

    assert.equal(alice_Debt.toString(), "0");
    assert.equal(bob_Debt.toString(), "0");
    assert.equal(carol_Debt.toString(), "0");

    // check Alice, Bob and Carol troves are in status unredeemable
    const alice_Status = await troveManager.getTroveStatus(aliceTroveId);
    const bob_Status = await troveManager.getTroveStatus(bobTroveId);
    const carol_Status = await troveManager.getTroveStatus(carolTroveId);
    assert.equal(alice_Status, 4);
    assert.equal(bob_Status, 4);
    assert.equal(carol_Status, 4);

    // check debt and coll of Dennis, Erin has not been impacted by redemption
    // (Erin has a small impact, ~600e-18 Bold, which makes it update the interest)
    const dennis_Debt = await troveManager.getTroveDebt(dennisTroveId);
    const erin_Debt = await troveManager.getTroveDebt(erinTroveId);

    th.assertIsApproximatelyEqual(dennis_Debt, D_totalDebt);
    th.assertIsApproximatelyEqual(erin_Debt, E_totalDebt.add(E_interest), 1e13);

    const dennis_Coll = await troveManager.getTroveColl(dennisTroveId);
    const erin_Coll = await troveManager.getTroveColl(erinTroveId);

    assert.equal(dennis_Coll.toString(), D_coll.toString());
    th.assertIsApproximatelyEqual(erin_Coll, E_coll);
  });

  it("redeemCollateral(): ends the redemption sequence when the token redemption request has been filled", async () => {
    // --- SETUP ---
    await openTrove({ ICR: toBN(dec(100, 18)), extraParams: { from: whale, annualInterestRate: dec(90, 16) } });

    // Alice, Bob, Carol, Dennis, Erin open troves
    const { troveId: aliceTroveId, netDebt: A_debt } = await openTrove({
      ICR: toBN(dec(290, 16)),
      extraBoldAmount: dec(20, 18),
      extraParams: { from: alice, annualInterestRate: dec(5, 16) },
    });
    const { troveId: bobTroveId, netDebt: B_debt } = await openTrove({
      ICR: toBN(dec(290, 16)),
      extraBoldAmount: dec(20, 18),
      extraParams: { from: bob, annualInterestRate: dec(5, 16) },
    });
    const { troveId: carolTroveId, netDebt: C_debt } = await openTrove({
      ICR: toBN(dec(290, 16)),
      extraBoldAmount: dec(20, 18),
      extraParams: { from: carol, annualInterestRate: dec(5, 16) },
    });
    const redemptionAmount = A_debt.add(B_debt).add(C_debt).add(toBN(11701736130990849339)); // A+B+C+interest+upfront fee
    const { troveId: dennisTroveId, totalDebt: D_totalDebt, collateral: D_coll } = await openTrove({
      ICR: toBN(dec(300, 16)),
      extraBoldAmount: dec(10, 18),
      extraParams: { from: dennis, annualInterestRate: dec(6, 16) },
    });
    const { troveId: erinTroveId, totalDebt: E_totalDebt, collateral: E_coll } = await openTrove({
      ICR: toBN(dec(300, 16)),
      extraBoldAmount: dec(10, 18),
      extraParams: { from: erin, annualInterestRate: dec(6, 16) },
    });

    // --- TEST ---

    // open trove from redeemer.  Redeemer has highest ICR (100ETH, 100 Bold), 20000%
    const { troveId: flynTroveId, boldAmount: F_boldAmount } = await openTrove({
      ICR: toBN(dec(200, 18)),
      extraBoldAmount: redemptionAmount.mul(toBN(2)),
      extraParams: { from: flyn, annualInterestRate: dec(50, 16) },
    });

    // skip bootstrapping phase
    await time.increase(timeValues.SECONDS_IN_ONE_WEEK * 2);

    // Flyn redeems collateral
    await th.redeemCollateralAndGetTxObject(
      flyn,
      contracts,
      redemptionAmount,
      10,
      th._100pct,
    );

    // Check Flyn's redemption has reduced his balance from 100 to (100-60) = 40 Bold
    const flynBalance = await boldToken.balanceOf(flyn);
    th.assertIsApproximatelyEqual(
      flynBalance,
      F_boldAmount.sub(redemptionAmount),
    );

    // Check debt of Alice, Bob, Carol
    const alice_Debt = await troveManager.getTroveDebt(aliceTroveId);
    const bob_Debt = await troveManager.getTroveDebt(bobTroveId);
    const carol_Debt = await troveManager.getTroveDebt(carolTroveId);

    assert.equal(alice_Debt.toString(), "0");
    assert.equal(bob_Debt.toString(), "0");
    assert.equal(carol_Debt.toString(), "0");

    // check Alice, Bob and Carol troves are in status undreedemable
    const alice_Status = await troveManager.getTroveStatus(aliceTroveId);
    const bob_Status = await troveManager.getTroveStatus(bobTroveId);
    const carol_Status = await troveManager.getTroveStatus(carolTroveId);
    assert.equal(alice_Status, 4);
    assert.equal(bob_Status, 4);
    assert.equal(carol_Status, 4);

    // check debt and coll of Dennis, Erin has not been impacted by redemption
    const dennis_Debt = await troveManager.getTroveDebt(dennisTroveId);
    const erin_Debt = await troveManager.getTroveDebt(erinTroveId);

    th.assertIsApproximatelyEqual(dennis_Debt, D_totalDebt);
    assert(erin_Debt.gte(E_totalDebt));

    const dennis_Coll = await troveManager.getTroveColl(dennisTroveId);
    const erin_Coll = await troveManager.getTroveColl(erinTroveId);

    assert.equal(dennis_Coll.toString(), D_coll.toString());
    th.assertIsApproximatelyEqual(erin_Coll, E_coll);
  });

  const calcInterest = (amount, interestRate, seconds) => {
    return amount
      .mul(toBN(interestRate))
      .div(toBN(dec(1, 18)))
      .mul(toBN(seconds))
      .div(toBN(timeValues.SECONDS_IN_ONE_YEAR));
  };

  it("redeemCollateral(): ends the redemption sequence when max iterations have been reached", async () => {
    // --- SETUP ---
    await openTrove({ ICR: toBN(dec(100, 18)), extraParams: { from: whale, annualInterestRate: dec(90, 16) } });

    // Alice, Bob, Carol open troves with equal collateral ratio
    const { troveId: aliceTroveId, netDebt: A_debt, totalDebt: A_totalDebt } = await openTrove({
      ICR: toBN(dec(286, 16)),
      extraBoldAmount: dec(20, 18),
      extraParams: { from: alice, annualInterestRate: dec(5, 16) },
    });
    const { troveId: bobTroveId, netDebt: B_debt, totalDebt: B_totalDebt } = await openTrove({
      ICR: toBN(dec(286, 16)),
      extraBoldAmount: dec(20, 18),
      extraParams: { from: bob, annualInterestRate: dec(5, 16) },
    });
    const { troveId: carolTroveId, netDebt: C_debt, totalDebt: C_totalDebt } = await openTrove({
      ICR: toBN(dec(286, 16)),
      extraBoldAmount: dec(20, 18),
      extraParams: { from: carol, annualInterestRate: dec(5, 16) },
    });
    const redemptionAmount = C_debt.add(B_debt).add(
      calcInterest(C_totalDebt.add(B_totalDebt), dec(5, 16), timeValues.SECONDS_IN_ONE_WEEK * 2 + 85),
    );
    const attemptedRedemptionAmount = redemptionAmount.add(A_debt);

    // --- TEST ---

    // open trove from redeemer.  Redeemer has highest ICR (100ETH, 100 Bold), 20000%
    const { troveId: flynTroveId, boldAmount: F_boldAmount } = await openTrove({
      ICR: toBN(dec(200, 18)),
      extraBoldAmount: redemptionAmount.mul(toBN(2)),
      extraParams: { from: flyn, annualInterestRate: dec(95, 16) },
    });

    // skip bootstrapping phase
    await time.increase(timeValues.SECONDS_IN_ONE_WEEK * 2);

    // Flyn redeems collateral with only two iterations
    await th.redeemCollateralAndGetTxObject(
      flyn,
      contracts,
      attemptedRedemptionAmount,
      2,
      th._100pct,
    );

    // Check Flyn's redemption has reduced his balance
    const flynBalance = await boldToken.balanceOf(flyn);

    th.assertIsApproximatelyEqual(
      flynBalance,
      F_boldAmount.sub(redemptionAmount),
      1e15,
    );

    // Check debt of Alice, Bob, Carol
    const alice_Debt = await troveManager.getTroveDebt(aliceTroveId);
    const bob_Debt = await troveManager.getTroveDebt(bobTroveId);
    const carol_Debt = await troveManager.getTroveDebt(carolTroveId);

    th.assertIsApproximatelyEqual(alice_Debt, A_totalDebt);
    assert.equal(bob_Debt.toString(), "0");
    assert.equal(carol_Debt.toString(), "0");

    // check Alice and Bob troves are unreedemable, but Carol is not
    const alice_Status = await troveManager.getTroveStatus(aliceTroveId);
    const bob_Status = await troveManager.getTroveStatus(bobTroveId);
    const carol_Status = await troveManager.getTroveStatus(carolTroveId);
    assert.equal(alice_Status, 1);
    assert.equal(bob_Status, 4);
    assert.equal(carol_Status, 4);
  });

  it("redeemCollateral(): doesn’t perform partial redemption if resultant debt is > minimum net debt", async () => {
    const ATroveId = await th.openTroveWrapper(
      contracts,
      await getOpenTroveBoldAmount(dec(10000, 18)),
      A,
      A,
      dec(5, 16),
      { from: A, value: dec(1000, "ether") },
    );
    const BTroveId = await th.openTroveWrapper(
      contracts,
      await getOpenTroveBoldAmount(dec(20000, 18)),
      B,
      B,
      dec(4, 16),
      { from: B, value: dec(1000, "ether") },
    );
    const CTroveId = await th.openTroveWrapper(
      contracts,
      await getOpenTroveBoldAmount(dec(30000, 18)),
      C,
      C,
      dec(3, 16),
      { from: C, value: dec(1000, "ether") },
    );

    const AInitialDebt = await troveManager.getTroveEntireDebt(ATroveId);
    const BInitialDebt = await troveManager.getTroveEntireDebt(BTroveId);
    const CInitialDebt = await troveManager.getTroveEntireDebt(CTroveId);

    // A and C send all their tokens to B
    await boldToken.transfer(B, await boldToken.balanceOf(A), { from: A });
    await boldToken.transfer(B, await boldToken.balanceOf(C), { from: C });

    await contracts.collateralRegistry.setBaseRate(0);

    // skip bootstrapping phase
    await time.increase(timeValues.SECONDS_IN_ONE_WEEK * 2);
    const interestA = await troveManager.calcTroveAccruedInterest(ATroveId);
    const interestB = await troveManager.calcTroveAccruedInterest(BTroveId);
    const interestC = await troveManager.calcTroveAccruedInterest(CTroveId);

    // Bold redemption is 55000 US
    const BoldRedemption = dec(55000, 18);
    const tx1 = await th.redeemCollateralAndGetTxObject(
      B,
      contracts,
      BoldRedemption,
      10,
      th._100pct,
    );

    // Check B, C closed and A remains active
    assert.isTrue(await sortedTroves.contains(ATroveId));
    assert.isFalse(await sortedTroves.contains(BTroveId));
    assert.isFalse(await sortedTroves.contains(CTroveId));

    // A's remaining debt = 29800 + 19800 + 9800 + 200 - 55000 = 4600, + interest
    const A_debt = await troveManager.getTroveDebt(ATroveId);
    await th.assertIsApproximatelyEqual(
      A_debt,
      AInitialDebt.add(BInitialDebt).add(CInitialDebt).sub(toBN(dec(55000, 18))).add(interestA).add(interestB).add(
        interestC,
      ),
      6e15,
    );
  });

  it("redeemCollateral(): hits trove even if resultant debt would be < minimum net debt", async () => {
    const ATroveId = await th.openTroveWrapper(
      contracts,
      await getOpenTroveBoldAmount(dec(6000, 18)),
      A,
      A,
      dec(5, 16),
      { from: A, value: dec(1000, "ether") },
    );
    const BTroveId = await th.openTroveWrapper(
      contracts,
      await getOpenTroveBoldAmount(dec(20000, 18)),
      B,
      B,
      dec(4, 16),
      { from: B, value: dec(1000, "ether") },
    );
    const CTroveId = await th.openTroveWrapper(
      contracts,
      await getOpenTroveBoldAmount(dec(30000, 18)),
      C,
      C,
      dec(3, 16),
      { from: C, value: dec(1000, "ether") },
    );

    const AInitialDebt = await troveManager.getTroveEntireDebt(ATroveId);
    const BInitialDebt = await troveManager.getTroveEntireDebt(BTroveId);
    const CInitialDebt = await troveManager.getTroveEntireDebt(CTroveId);

    // A and C send all their tokens to B
    await boldToken.transfer(B, await boldToken.balanceOf(A), { from: A });
    await boldToken.transfer(B, await boldToken.balanceOf(C), { from: C });

    await contracts.collateralRegistry.setBaseRate(0);

    // Skip bootstrapping phase
    await time.increase(timeValues.SECONDS_IN_ONE_WEEK * 2);

    const interestA = await troveManager.calcTroveAccruedInterest(ATroveId);
    const interestB = await troveManager.calcTroveAccruedInterest(BTroveId);
    const interestC = await troveManager.calcTroveAccruedInterest(CTroveId);

    // Bold redemption is 55000 Bold
    const BoldRedemption = dec(55000, 18);
    const tx1 = await th.redeemCollateralAndGetTxObject(
      B,
      contracts,
      BoldRedemption,
      10,
      th._100pct,
    );

    // Check B, C out of sorted list (unredeemable) and A too, despite being partially redeemed and ended up below min debt
    assert.isFalse(await sortedTroves.contains(ATroveId));
    assert.isFalse(await sortedTroves.contains(BTroveId));
    assert.isFalse(await sortedTroves.contains(CTroveId));

    // A's remaining debt would be 29800 + 19800 + 6000 - 55000 + interest = 600 + interest.
    // This is below the min net debt of 2000, but still it’s redeemed and debt gets reduced
    const A_debt = await troveManager.getTroveDebt(ATroveId);
    await th.assertIsApproximatelyEqual(
      A_debt,
      AInitialDebt.add(BInitialDebt).add(CInitialDebt).sub(toBN(dec(55000, 18))).add(interestA).add(interestB).add(
        interestC,
      ),
      6e15,
    );
  });

  // active debt cannot be zero, as there’s a positive min debt enforced, and at least a trove must exist
  it("redeemCollateral(): can redeem if there is zero active debt but non-zero debt in DefaultPool", async () => {
    // --- SETUP ---

    const amount = await getOpenTroveBoldAmount(dec(2110, 18));
    await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: alice } });
    const { troveId: bobTroveId } = await openTrove({
      ICR: toBN(dec(133, 16)),
      extraBoldAmount: amount,
      extraParams: { from: bob },
    });

    await boldToken.transfer(carol, amount, { from: bob });

    const price = dec(100, 18);
    await priceFeed.setPrice(price);

    // Liquidate Bob's Trove
    await troveManager.liquidate(bobTroveId);

    // --- TEST ---

    const carol_ETHBalance_Before = toBN(await contracts.WETH.balanceOf(carol));

    // skip bootstrapping phase
    await time.increase(timeValues.SECONDS_IN_ONE_WEEK * 2);

    const ETHFee = await contracts.troveManager.getEffectiveRedemptionFeeInColl(amount, price);

    const redemptionTx = await th.redeemCollateralAndGetTxObject(
      carol,
      contracts,
      amount,
      10,
      th._100pct,
      GAS_PRICE,
    );

    const carol_ETHBalance_After = toBN(await contracts.WETH.balanceOf(carol));

    const expectedTotalETHDrawn = toBN(amount).div(toBN(100)); // convert 100 Bold to ETH at ETH:USD price of 100
    const expectedReceivedETH = expectedTotalETHDrawn.sub(ETHFee);

    const receivedETH = carol_ETHBalance_After.sub(carol_ETHBalance_Before);
    assert.isTrue(expectedReceivedETH.eq(receivedETH));

    const carol_BoldBalance_After = (
      await boldToken.balanceOf(carol)
    ).toString();
    assert.equal(carol_BoldBalance_After, "0");
  });

  it("redeemCollateral(): doesn’t redeem Troves with ICR < 100%", async () => {
    // --- SETUP ---

    const { troveId: aliceTroveId, netDebt: A_debt } = await openTrove({
      ICR: toBN(dec(13, 18)),
      extraParams: { from: alice, annualInterestRate: dec(5, 16) },
    });
    const { troveId: bobTroveId, boldAmount: B_boldAmount, totalDebt: B_totalDebt } = await openTrove({
      ICR: toBN(dec(133, 16)),
      extraBoldAmount: A_debt,
      extraParams: { from: bob, annualInterestRate: dec(4, 16) },
    });

    await boldToken.transfer(carol, B_boldAmount, { from: bob });

    // Put Bob's Trove below 100% ICR
    const price = dec(100, 18);
    await priceFeed.setPrice(price);

    assert((await troveManager.getCurrentICR(bobTroveId, price)).lt(toBN(dec(100, 16))));

    // --- TEST ---

    // skip bootstrapping phase
    await time.increase(timeValues.SECONDS_IN_ONE_WEEK * 2);

    await th.redeemCollateralAndGetTxObject(
      carol,
      contracts,
      A_debt.add(toBN("3839310296821028196")),
      10,
      th._100pct,
    );

    // Alice's Trove was cleared of debt
    const { debt: alice_Debt_After } = await troveManager.Troves(aliceTroveId);
    assert.equal(alice_Debt_After.toString(), "0");

    // Bob's Trove was left untouched
    const { debt: bob_Debt_After } = await troveManager.Troves(bobTroveId);
    th.logBN("bob_Debt_After", bob_Debt_After);
    th.logBN("B_totalDebt", B_totalDebt);
    th.assertIsApproximatelyEqual(bob_Debt_After, B_totalDebt);
  });

  it("redeemCollateral(): reverts when argument _amount is 0", async () => {
    await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } });

    // Alice opens trove and transfers 500Bold to Erin, the would-be redeemer
    await openTrove({
      ICR: toBN(dec(200, 16)),
      extraBoldAmount: dec(500, 18),
      extraParams: { from: alice },
    });
    await boldToken.transfer(erin, dec(500, 18), { from: alice });

    // B, C and D open troves
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: bob } });
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: carol } });
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: dennis } });

    // skip bootstrapping phase
    await time.increase(timeValues.SECONDS_IN_ONE_WEEK * 2);

    // Erin attempts to redeem with _amount = 0
    const redemptionTxPromise = th.redeemCollateralAndGetTxObject(
      erin,
      contracts,
      0,
      10,
      th._100pct,
    );
    await assertRevert(
      redemptionTxPromise,
      "TroveManager: Amount must be greater than zero",
    );
  });

  it("redeemCollateral(): reverts if max fee > 100%", async () => {
    await openTrove({
      ICR: toBN(dec(400, 16)),
      extraBoldAmount: dec(10, 18),
      extraParams: { from: A },
    });
    await openTrove({
      ICR: toBN(dec(400, 16)),
      extraBoldAmount: dec(20, 18),
      extraParams: { from: B },
    });
    await openTrove({
      ICR: toBN(dec(400, 16)),
      extraBoldAmount: dec(30, 18),
      extraParams: { from: C },
    });
    await openTrove({
      ICR: toBN(dec(400, 16)),
      extraBoldAmount: dec(40, 18),
      extraParams: { from: D },
    });

    // skip bootstrapping phase
    await time.increase(timeValues.SECONDS_IN_ONE_WEEK * 2);

    await assertRevert(
      th.redeemCollateralAndGetTxObject(
        A,
        contracts,
        dec(10, 18),
        10,
        GAS_PRICE,
        dec(2, 18),
      ),
      "Max fee percentage must be between 0.5% and 100%",
    );
    await assertRevert(
      th.redeemCollateralAndGetTxObject(
        A,
        contracts,
        dec(10, 18),
        10,
        GAS_PRICE,
        "1000000000000000001",
      ),
      "Max fee percentage must be between 0.5% and 100%",
    );
  });

  it("redeemCollateral(): reverts if max fee < 0.5%", async () => {
    await openTrove({
      ICR: toBN(dec(400, 16)),
      extraBoldAmount: dec(10, 18),
      extraParams: { from: A },
    });
    await openTrove({
      ICR: toBN(dec(400, 16)),
      extraBoldAmount: dec(20, 18),
      extraParams: { from: B },
    });
    await openTrove({
      ICR: toBN(dec(400, 16)),
      extraBoldAmount: dec(30, 18),
      extraParams: { from: C },
    });
    await openTrove({
      ICR: toBN(dec(400, 16)),
      extraBoldAmount: dec(40, 18),
      extraParams: { from: D },
    });

    // skip bootstrapping phase
    await time.increase(timeValues.SECONDS_IN_ONE_WEEK * 2);

    await assertRevert(
      th.redeemCollateralAndGetTxObject(
        A,
        contracts,
        10,
        dec(10, 18),
        0,
        GAS_PRICE,
      ),
      "Max fee percentage must be between 0.5% and 100%",
    );
    await assertRevert(
      th.redeemCollateralAndGetTxObject(
        A,
        contracts,
        dec(10, 18),
        10,
        1,
        GAS_PRICE,
      ),
      "Max fee percentage must be between 0.5% and 100%",
    );
    await assertRevert(
      th.redeemCollateralAndGetTxObject(
        A,
        contracts,
        10,
        dec(10, 18),
        "4999999999999999",
        GAS_PRICE,
      ),
      "Max fee percentage must be between 0.5% and 100%",
    );
  });

  it("redeemCollateral(): reverts if fee exceeds max fee percentage", async () => {
    const { totalDebt: A_totalDebt } = await openTrove({
      ICR: toBN(dec(400, 16)),
      extraBoldAmount: dec(80, 18),
      extraParams: { from: A },
    });
    const { totalDebt: B_totalDebt } = await openTrove({
      ICR: toBN(dec(400, 16)),
      extraBoldAmount: dec(90, 18),
      extraParams: { from: B },
    });
    const { totalDebt: C_totalDebt } = await openTrove({
      ICR: toBN(dec(400, 16)),
      extraBoldAmount: dec(100, 18),
      extraParams: { from: C },
    });
    const expectedTotalSupply = A_totalDebt.add(B_totalDebt).add(C_totalDebt);

    // Check total Bold supply
    const totalSupply = await boldToken.totalSupply();
    th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply);

    await contracts.collateralRegistry.setBaseRate(0);

    // skip bootstrapping phase
    await time.increase(timeValues.SECONDS_IN_ONE_WEEK * 2);

    // Bold redemption is 27 USD: a redemption that incurs a fee of 27/(270 * 2) = 5%
    const attemptedBoldRedemption = expectedTotalSupply.div(toBN(10));

    // Max fee is <5%
    const lessThan5pct = "49999999999999999";
    await assertRevert(
      th.redeemCollateralAndGetTxObject(
        A,
        contracts,
        attemptedBoldRedemption,
        10,
        lessThan5pct,
      ),
      "Fee exceeded provided maximum",
    );

    await contracts.collateralRegistry.setBaseRate(0); // artificially zero the baseRate

    // Max fee is 1%
    await assertRevert(
      th.redeemCollateralAndGetTxObject(
        A,
        contracts,
        attemptedBoldRedemption,
        10,
        dec(1, 16),
      ),
      "Fee exceeded provided maximum",
    );

    await contracts.collateralRegistry.setBaseRate(0);

    // Max fee is 3.754%
    await assertRevert(
      th.redeemCollateralAndGetTxObject(
        A,
        contracts,
        attemptedBoldRedemption,
        10,
        dec(3754, 13),
      ),
      "Fee exceeded provided maximum",
    );

    await contracts.collateralRegistry.setBaseRate(0);

    // Max fee is 0.5%
    await assertRevert(
      th.redeemCollateralAndGetTxObject(
        A,
        contracts,
        attemptedBoldRedemption,
        10,
        dec(5, 15),
      ),
      "Fee exceeded provided maximum",
    );
  });

  it("redeemCollateral(): doesn't affect the Stability Pool deposits or ETH gain of redeemed-from troves", async () => {
    await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale, annualInterestRate: dec(90, 16) } });

    // B, C, D, F open trove
    const { troveId: bobTroveId, totalDebt: B_totalDebt } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraBoldAmount: dec(100, 18),
      extraParams: { from: bob, annualInterestRate: dec(5, 16) },
    });
    const { troveId: carolTroveId, totalDebt: C_totalDebt } = await openTrove({
      ICR: toBN(dec(195, 16)),
      extraBoldAmount: dec(200, 18),
      extraParams: { from: carol, annualInterestRate: dec(4, 16) },
    });
    const { troveId: dennisTroveId, totalDebt: D_totalDebt } = await openTrove({
      ICR: toBN(dec(190, 16)),
      extraBoldAmount: dec(400, 18),
      extraParams: { from: dennis, annualInterestRate: dec(3, 16) },
    });
    const { troveId: flynTroveId, totalDebt: F_totalDebt } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraBoldAmount: dec(100, 18),
      extraParams: { from: flyn, annualInterestRate: dec(5, 16) },
    });

    const redemptionAmount = B_totalDebt.add(C_totalDebt)
      .add(D_totalDebt)
      .add(F_totalDebt);
    // Alice opens trove and transfers Bold to Erin, the would-be redeemer
    await openTrove({
      ICR: toBN(dec(300, 16)),
      extraBoldAmount: redemptionAmount,
      extraParams: { from: alice, annualInterestRate: dec(10, 16) },
    });
    await boldToken.transfer(erin, redemptionAmount, { from: alice });

    // B, C, D deposit some of their tokens to the Stability Pool
    await th.provideToSPAndClaim(contracts, dec(50, 18), { from: bob });
    await th.provideToSPAndClaim(contracts, dec(150, 18), {
      from: carol,
    });
    await th.provideToSPAndClaim(contracts, dec(200, 18), {
      from: dennis,
    });

    let price = await priceFeed.getPrice();
    const bob_ICR_before = await troveManager.getCurrentICR(bobTroveId, price);
    const carol_ICR_before = await troveManager.getCurrentICR(carolTroveId, price);
    const dennis_ICR_before = await troveManager.getCurrentICR(dennisTroveId, price);

    // Price drops
    await priceFeed.setPrice(dec(100, 18));

    assert.isTrue(await sortedTroves.contains(flynTroveId));

    // Liquidate Flyn
    await troveManager.liquidate(flynTroveId);
    assert.isFalse(await sortedTroves.contains(flynTroveId));

    // Price bounces back, bringing B, C, D back above MCR
    await priceFeed.setPrice(dec(200, 18));

    const bob_SPDeposit_before = (
      await stabilityPool.getCompoundedBoldDeposit(bob)
    ).toString();
    const carol_SPDeposit_before = (
      await stabilityPool.getCompoundedBoldDeposit(carol)
    ).toString();
    const dennis_SPDeposit_before = (
      await stabilityPool.getCompoundedBoldDeposit(dennis)
    ).toString();

    const bob_ETHGain_before = (
      await stabilityPool.getDepositorCollGain(bob)
    ).toString();
    const carol_ETHGain_before = (
      await stabilityPool.getDepositorCollGain(carol)
    ).toString();
    const dennis_ETHGain_before = (
      await stabilityPool.getDepositorCollGain(dennis)
    ).toString();

    // Check the remaining Bold and ETH in Stability Pool after liquidation is non-zero
    const BoldinSP = await stabilityPool.getTotalBoldDeposits();
    const ETHinSP = await stabilityPool.getCollBalance();
    assert.isTrue(BoldinSP.gte(mv._zeroBN));
    assert.isTrue(ETHinSP.gte(mv._zeroBN));

    // skip bootstrapping phase
    await time.increase(timeValues.SECONDS_IN_ONE_WEEK * 2);

    // Erin redeems Bold
    await th.redeemCollateral(erin, contracts, redemptionAmount, th._100pct);

    price = await priceFeed.getPrice();
    const bob_ICR_after = await troveManager.getCurrentICR(bobTroveId, price);
    const carol_ICR_after = await troveManager.getCurrentICR(carolTroveId, price);
    const dennis_ICR_after = await troveManager.getCurrentICR(dennisTroveId, price);

    // Check ICR of B, C and D troves has increased,i.e. they have been hit by redemptions
    assert.isTrue(bob_ICR_after.gte(bob_ICR_before));
    assert.isTrue(carol_ICR_after.gte(carol_ICR_before));
    assert.isTrue(dennis_ICR_after.gte(dennis_ICR_before));

    const bob_SPDeposit_after = (
      await stabilityPool.getCompoundedBoldDeposit(bob)
    ).toString();
    const carol_SPDeposit_after = (
      await stabilityPool.getCompoundedBoldDeposit(carol)
    ).toString();
    const dennis_SPDeposit_after = (
      await stabilityPool.getCompoundedBoldDeposit(dennis)
    ).toString();

    const bob_ETHGain_after = (
      await stabilityPool.getDepositorCollGain(bob)
    ).toString();
    const carol_ETHGain_after = (
      await stabilityPool.getDepositorCollGain(carol)
    ).toString();
    const dennis_ETHGain_after = (
      await stabilityPool.getDepositorCollGain(dennis)
    ).toString();

    // Check B, C, D Stability Pool deposits and ETH gain have not been affected by redemptions from their troves
    assert.equal(bob_SPDeposit_before, bob_SPDeposit_after);
    assert.equal(carol_SPDeposit_before, carol_SPDeposit_after);
    assert.equal(dennis_SPDeposit_before, dennis_SPDeposit_after);

    assert.equal(bob_ETHGain_before, bob_ETHGain_after);
    assert.equal(carol_ETHGain_before, carol_ETHGain_after);
    assert.equal(dennis_ETHGain_before, dennis_ETHGain_after);
  });

  it("redeemCollateral(): caller can redeem their entire BoldToken balance", async () => {
    const { collateral: W_coll, totalDebt: W_totalDebt } = await openTrove({
      ICR: toBN(dec(20, 18)),
      extraParams: { from: whale },
    });

    // Alice opens trove and transfers 400 Bold to Erin, the would-be redeemer
    const { collateral: A_coll, totalDebt: A_totalDebt } = await openTrove({
      ICR: toBN(dec(300, 16)),
      extraBoldAmount: dec(400, 18),
      extraParams: { from: alice },
    });
    await boldToken.transfer(erin, dec(400, 18), { from: alice });

    // Check Erin's balance before
    const erin_balance_before = await boldToken.balanceOf(erin);
    assert.equal(erin_balance_before, dec(400, 18));

    // B, C, D open trove
    const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({
      ICR: toBN(dec(300, 16)),
      extraBoldAmount: dec(590, 18),
      extraParams: { from: bob },
    });
    const { collateral: C_coll, totalDebt: C_totalDebt } = await openTrove({
      ICR: toBN(dec(300, 16)),
      extraBoldAmount: dec(1990, 18),
      extraParams: { from: carol },
    });
    const { collateral: D_coll, totalDebt: D_totalDebt } = await openTrove({
      ICR: toBN(dec(500, 16)),
      extraBoldAmount: dec(1990, 18),
      extraParams: { from: dennis },
    });

    const totalDebt = W_totalDebt.add(A_totalDebt)
      .add(B_totalDebt)
      .add(C_totalDebt)
      .add(D_totalDebt);
    const totalColl = W_coll.add(A_coll).add(B_coll).add(C_coll).add(D_coll);

    // Get active debt and coll before redemption
    const activePool_debt_before = await activePool.getBoldDebt();
    const activePool_coll_before = await activePool.getCollBalance();

    th.assertIsApproximatelyEqual(activePool_debt_before, totalDebt);
    assert.equal(activePool_coll_before.toString(), totalColl);

    const price = await priceFeed.getPrice();

    // skip bootstrapping phase
    await time.increase(timeValues.SECONDS_IN_ONE_WEEK * 2);

    const ETHFee = await contracts.troveManager.getEffectiveRedemptionFeeInColl(dec(400, 18), price);

    // Erin attempts to redeem 400 Bold

    await th.redeemCollateralAndGetTxObject(
      erin,
      contracts,
      dec(400, 18),
      10,
      th._100pct,
    );

    // Check activePool debt reduced by  400 Bold
    const activePool_debt_after = await activePool.getBoldDebt();
    assert.equal(
      activePool_debt_before.sub(activePool_debt_after),
      dec(400, 18),
    );

    /* Check ActivePool coll reduced by $400 worth of Ether: at ETH:USD price of $200, this should be 2 ETH.

    therefore remaining ActivePool ETH should be 198 */
    const activePool_coll_after = await activePool.getCollBalance();
    // console.log(`activePool_coll_after: ${activePool_coll_after}`)
    assert.equal(
      activePool_coll_after.sub(ETHFee).toString(),
      activePool_coll_before.sub(toBN(dec(2, 18))).toString(),
    );

    // Check Erin's balance after
    const erin_balance_after = (await boldToken.balanceOf(erin)).toString();
    assert.equal(erin_balance_after, "0");
  });

  it("redeemCollateral(): reverts when requested redemption amount exceeds caller's Bold token balance", async () => {
    const { collateral: W_coll, totalDebt: W_totalDebt } = await openTrove({
      ICR: toBN(dec(20, 18)),
      extraParams: { from: whale },
    });

    // Alice opens trove and transfers 400 Bold to Erin, the would-be redeemer
    const { troveId: aliceTroveId, collateral: A_coll, totalDebt: A_totalDebt } = await openTrove({
      ICR: toBN(dec(300, 16)),
      extraBoldAmount: dec(400, 18),
      extraParams: { from: alice },
    });
    await boldToken.transfer(erin, dec(400, 18), { from: alice });

    // Check Erin's balance before
    const erin_balance_before = await boldToken.balanceOf(erin);
    assert.equal(erin_balance_before, dec(400, 18));

    // B, C, D open trove
    const { troveId: bobTroveId, collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({
      ICR: toBN(dec(300, 16)),
      extraBoldAmount: dec(590, 18),
      extraParams: { from: bob },
    });
    const { troveId: carolTroveId, collateral: C_coll, totalDebt: C_totalDebt } = await openTrove({
      ICR: toBN(dec(300, 16)),
      extraBoldAmount: dec(1990, 18),
      extraParams: { from: carol },
    });
    const { troveId: dennisTroveId, collateral: D_coll, totalDebt: D_totalDebt } = await openTrove({
      ICR: toBN(dec(500, 16)),
      extraBoldAmount: dec(1990, 18),
      extraParams: { from: dennis },
    });

    const totalDebt = W_totalDebt.add(A_totalDebt)
      .add(B_totalDebt)
      .add(C_totalDebt)
      .add(D_totalDebt);
    const totalColl = W_coll.add(A_coll).add(B_coll).add(C_coll).add(D_coll);

    // Get active debt and coll before redemption
    const activePool_debt_before = await activePool.getBoldDebt();
    const activePool_coll_before = (await activePool.getCollBalance()).toString();

    th.assertIsApproximatelyEqual(activePool_debt_before, totalDebt);
    assert.equal(activePool_coll_before, totalColl);

    const price = await priceFeed.getPrice();

    // skip bootstrapping phase
    await time.increase(timeValues.SECONDS_IN_ONE_WEEK * 2);

    // Erin tries to redeem 1000 Bold
    try {
      const redemptionTx = await th.redeemCollateralAndGetTxObject(
        erin,
        contracts,
        dec(1000, 18),
        10,
        th._100pct,
      );

      assert.isFalse(redemptionTx.receipt.status);
    } catch (error) {
      assert.include(error.message, "revert");
      assert.include(
        error.message,
        "Requested redemption amount must be <= user's Bold token balance",
      );
    }

    // Erin tries to redeem 401 Bold
    try {
      const redemptionTx = await th.redeemCollateralAndGetTxObject(
        erin,
        contracts,
        "401000000000000000000",
        10,
        th._100pct,
      );
      assert.isFalse(redemptionTx.receipt.status);
    } catch (error) {
      assert.include(error.message, "revert");
      assert.include(
        error.message,
        "Requested redemption amount must be <= user's Bold token balance",
      );
    }

    // Erin tries to redeem 239482309 Bold
    try {
      const redemptionTx = await th.redeemCollateralAndGetTxObject(
        erin,
        contracts,
        "239482309000000000000000000",
        10,
        th._100pct,
      );
      assert.isFalse(redemptionTx.receipt.status);
    } catch (error) {
      assert.include(error.message, "revert");
      assert.include(
        error.message,
        "Requested redemption amount must be <= user's Bold token balance",
      );
    }

    // Erin tries to redeem 2^256 - 1 Bold
    const maxBytes32 = toBN(
      "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    );

    try {
      const redemptionTx = await th.redeemCollateralAndGetTxObject(
        erin,
        contracts,
        maxBytes32,
        10,
        th._100pct,
      );
      assert.isFalse(redemptionTx.receipt.status);
    } catch (error) {
      assert.include(error.message, "revert");
      assert.include(
        error.message,
        "Requested redemption amount must be <= user's Bold token balance",
      );
    }
  });

  it("redeemCollateral(): value of issued ETH == face value of redeemed Bold (assuming 1 Bold has value of $1)", async () => {
    const { collateral: W_coll } = await openTrove({
      ICR: toBN(dec(20, 18)),
      extraParams: { from: whale },
    });

    // Alice opens trove and transfers 1000 Bold each to Erin, Flyn, Graham
    const { troveId: aliceTroveId, collateral: A_coll, totalDebt: A_totalDebt } = await openTrove({
      ICR: toBN(dec(400, 16)),
      extraBoldAmount: dec(4990, 18),
      extraParams: { from: alice },
    });
    await boldToken.transfer(erin, dec(1000, 18), { from: alice });
    await boldToken.transfer(flyn, dec(1000, 18), { from: alice });
    await boldToken.transfer(graham, dec(1000, 18), { from: alice });

    // B, C, D open trove
    const { troveId: bobTroveId, collateral: B_coll } = await openTrove({
      ICR: toBN(dec(300, 16)),
      extraBoldAmount: dec(1590, 18),
      extraParams: { from: bob },
    });
    const { troveId: carolTroveId, collateral: C_coll } = await openTrove({
      ICR: toBN(dec(600, 16)),
      extraBoldAmount: dec(1090, 18),
      extraParams: { from: carol },
    });
    const { troveId: dennisTroveId, collateral: D_coll } = await openTrove({
      ICR: toBN(dec(800, 16)),
      extraBoldAmount: dec(1090, 18),
      extraParams: { from: dennis },
    });

    const totalColl = W_coll.add(A_coll).add(B_coll).add(C_coll).add(D_coll);

    const price = await priceFeed.getPrice();

    const _120_Bold = "120000000000000000000";
    const _373_Bold = "373000000000000000000";
    const _950_Bold = "950000000000000000000";

    // Check Ether in activePool
    const activeETH_0 = await activePool.getCollBalance();
    assert.equal(activeETH_0, totalColl.toString());

    // skip bootstrapping phase
    await time.increase(timeValues.SECONDS_IN_ONE_WEEK * 2);

    const ETHFee_1 = await contracts.troveManager.getEffectiveRedemptionFeeInColl(_120_Bold, price);

    const redemption_1 = await th.redeemCollateralAndGetTxObject(
      erin,
      contracts,
      _120_Bold,
      10,
      th._100pct,
    );

    assert.isTrue(redemption_1.receipt.status);

    /* 120 Bold redeemed.  Expect $120 worth of ETH removed. At ETH:USD price of $200,
    ETH removed = (120/200) = 0.6 ETH
    Total active ETH = 280 - 0.6 = 279.4 ETH */

    const activeETH_1 = await activePool.getCollBalance();
    assert.equal(
      activeETH_1.sub(ETHFee_1).toString(),
      activeETH_0.sub(toBN(_120_Bold).mul(mv._1e18BN).div(price)).toString(),
    );

    const ETHFee_2 = await contracts.troveManager.getEffectiveRedemptionFeeInColl(_373_Bold, price);
    // Flyn redeems 373 Bold
    const redemption_2 = await th.redeemCollateralAndGetTxObject(
      flyn,
      contracts,
      _373_Bold,
      10,
      th._100pct,
    );

    assert.isTrue(redemption_2.receipt.status);

    /* 373 Bold redeemed.  Expect $373 worth of ETH removed. At ETH:USD price of $200,
    ETH removed = (373/200) = 1.865 ETH
    Total active ETH = 279.4 - 1.865 = 277.535 ETH */
    const activeETH_2 = await activePool.getCollBalance();
    assert.equal(
      activeETH_2.sub(ETHFee_2).toString(),
      activeETH_1.sub(toBN(_373_Bold).mul(mv._1e18BN).div(price)).toString(),
    );

    const ETHFee_3 = await contracts.troveManager.getEffectiveRedemptionFeeInColl(_950_Bold, price);
    // Graham redeems 950 Bold
    const redemption_3 = await th.redeemCollateralAndGetTxObject(
      graham,
      contracts,
      _950_Bold,
      10,
      th._100pct,
    );

    assert.isTrue(redemption_3.receipt.status);

    /* 950 Bold redeemed.  Expect $950 worth of ETH removed. At ETH:USD price of $200,
    ETH removed = (950/200) = 4.75 ETH
    Total active ETH = 277.535 - 4.75 = 272.785 ETH */
    const activeETH_3 = await activePool.getCollBalance();
    assert.equal(
      activeETH_3.sub(ETHFee_3).toString(),
      activeETH_2.sub(toBN(_950_Bold).mul(mv._1e18BN).div(price)).toString(),
    );
  });

  // it doesn’t make much sense as there’s now min debt enforced and at least one trove must remain active
  // the only way to test it is before any trove is opened
  it("redeemCollateral(): reverts if there is zero outstanding system debt", async () => {
    // --- SETUP --- illegally mint Bold to Bob
    await boldToken.unprotectedMint(bob, dec(100, 18));

    assert.equal(await boldToken.balanceOf(bob), dec(100, 18));

    const price = await priceFeed.getPrice();

    // Bob tries to redeem his illegally obtained Bold
    try {
      const redemptionTx = await th.redeemCollateralAndGetTxObject(
        bob,
        contracts,
        dec(100, 18),
        10,
        th._100pct,
      );
    } catch (error) {
      assert.include(
        error.message,
        "VM Exception while processing transaction",
      );
    }

    // assert.isFalse(redemptionTx.receipt.status);
  });

  it("redeemCollateral(): reverts if caller's tries to redeem more than the outstanding system debt", async () => {
    // --- SETUP --- illegally mint Bold to Bob
    await boldToken.unprotectedMint(bob, "101000000000000000000");

    assert.equal(await boldToken.balanceOf(bob), "101000000000000000000");

    const { troveId: carolTroveId, collateral: C_coll, totalDebt: C_totalDebt } = await openTrove({
      ICR: toBN(dec(1000, 16)),
      extraBoldAmount: dec(40, 18),
      extraParams: { from: carol },
    });
    const { troveId: dennisTroveId, collateral: D_coll, totalDebt: D_totalDebt } = await openTrove({
      ICR: toBN(dec(1000, 16)),
      extraBoldAmount: dec(40, 18),
      extraParams: { from: dennis },
    });

    const totalDebt = C_totalDebt.add(D_totalDebt);
    th.assertIsApproximatelyEqual(
      (await activePool.getBoldDebt()).toString(),
      totalDebt,
    );

    const price = await priceFeed.getPrice();

    // skip bootstrapping phase
    await time.increase(timeValues.SECONDS_IN_ONE_WEEK * 2);

    // Bob attempts to redeem his ill-gotten 101 Bold, from a system that has 100 Bold outstanding debt
    try {
      const redemptionTx = await th.redeemCollateralAndGetTxObject(
        bob,
        contracts,
        totalDebt.add(toBN(dec(100, 18))),
        10,
        th._100pct,
      );
    } catch (error) {
      assert.include(
        error.message,
        "VM Exception while processing transaction",
      );
    }
  });

  it("redeemCollateral(): a redemption sends the ETH remainder (ETHDrawn - gas) to the redeemer", async () => {
    // time fast-forwards 1 year, and multisig stakes 1 LQTY
    await time.increase(timeValues.SECONDS_IN_ONE_YEAR);

    const { totalDebt: W_totalDebt } = await openTrove({
      ICR: toBN(dec(20, 18)),
      extraParams: { from: whale },
    });

    const { troveId: ATroveId, totalDebt: A_totalDebt } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraBoldAmount: dec(100, 18),
      extraParams: { from: A },
    });
    const { troveId: BTroveId, totalDebt: B_totalDebt } = await openTrove({
      ICR: toBN(dec(190, 16)),
      extraBoldAmount: dec(100, 18),
      extraParams: { from: B },
    });
    const { troveId: CTroveId, totalDebt: C_totalDebt } = await openTrove({
      ICR: toBN(dec(180, 16)),
      extraBoldAmount: dec(100, 18),
      extraParams: { from: C },
    });
    const totalDebt = W_totalDebt.add(A_totalDebt)
      .add(B_totalDebt)
      .add(C_totalDebt);

    const A_balanceBefore = toBN(await contracts.WETH.balanceOf(A));

    // Check total Bold supply
    const activeBold = await activePool.getBoldDebt();
    const defaultBold = await defaultPool.getBoldDebt();

    const totalBoldSupply = activeBold.add(defaultBold);
    th.assertIsApproximatelyEqual(totalBoldSupply, totalDebt);

    // A redeems 9 Bold
    const redemptionAmount = toBN(dec(9, 18));
    const price = await priceFeed.getPrice();
    const ETHFee = await contracts.troveManager.getEffectiveRedemptionFeeInColl(redemptionAmount, price);
    await th.redeemCollateral(
      A,
      contracts,
      redemptionAmount,
      th._100pct,
      GAS_PRICE,
    );

    /*
    At ETH:USD price of 200:
    ETHDrawn = (9 / 200) = 0.045 ETH
    */

    const A_balanceAfter = toBN(await contracts.WETH.balanceOf(A));

    // check A's ETH balance has increased by 0.045 ETH minus gas
    const ETHDrawn = redemptionAmount.mul(mv._1e18BN).div(price);
    th.assertIsApproximatelyEqual(
      A_balanceAfter.sub(A_balanceBefore),
      ETHDrawn.sub(ETHFee),
      100000,
    );
  });

  it("redeemCollateral(): a full redemption (leaving trove with 0 debt), closes the trove", async () => {
    // time fast-forwards 1 year, and multisig stakes 1 LQTY
    await time.increase(timeValues.SECONDS_IN_ONE_YEAR);

    const { netDebt: W_netDebt } = await openTrove({
      ICR: toBN(dec(20, 18)),
      extraBoldAmount: dec(10000, 18),
      extraParams: { from: whale, annualInterestRate: dec(50, 16) },
    });

    const { troveId: ATroveId, netDebt: A_netDebt } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraBoldAmount: dec(100, 18),
      extraParams: { from: A, annualInterestRate: dec(5, 16) },
    });
    const { troveId: BTroveId, netDebt: B_netDebt } = await openTrove({
      ICR: toBN(dec(190, 16)),
      extraBoldAmount: dec(100, 18),
      extraParams: { from: B, annualInterestRate: dec(4, 16) },
    });
    const { troveId: CTroveId, netDebt: C_netDebt } = await openTrove({
      ICR: toBN(dec(180, 16)),
      extraBoldAmount: dec(100, 18),
      extraParams: { from: C, annualInterestRate: dec(3, 16) },
    });
    const { troveId: DTroveId, netDebt: D_netDebt } = await openTrove({
      ICR: toBN(dec(280, 16)),
      extraBoldAmount: dec(100, 18),
      extraParams: { from: D, annualInterestRate: dec(10, 16) },
    });
    const redemptionAmount = A_netDebt.add(B_netDebt)
      .add(C_netDebt)
      .add(toBN(dec(10, 18)));

    const A_balanceBefore = toBN(await contracts.WETH.balanceOf(A));
    const B_balanceBefore = toBN(await contracts.WETH.balanceOf(B));
    const C_balanceBefore = toBN(await contracts.WETH.balanceOf(C));

    // whale redeems 360 Bold.  Expect this to fully redeem A, B, C, and partially redeem D.
    await th.redeemCollateral(whale, contracts, redemptionAmount, th._100pct, GAS_PRICE);

    // Check A, B, C have been closed
    assert.isFalse(await sortedTroves.contains(ATroveId));
    assert.isFalse(await sortedTroves.contains(BTroveId));
    assert.isFalse(await sortedTroves.contains(CTroveId));

    // Check D remains active
    assert.isTrue(await sortedTroves.contains(DTroveId));
  });

  const redeemCollateral3Full1Partial = async (close = false) => {
    // time fast-forwards 1 year, and multisig stakes 1 LQTY
    await time.increase(timeValues.SECONDS_IN_ONE_YEAR);

    const { netDebt: W_netDebt } = await openTrove({
      ICR: toBN(dec(20, 18)),
      extraBoldAmount: dec(10000, 18),
      extraParams: { from: whale, annualInterestRate: dec(90, 16) },
    });

    const { troveId: ATroveId, netDebt: A_netDebt, collateral: A_coll } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraBoldAmount: dec(100, 18),
      extraParams: { from: A, annualInterestRate: dec(5, 16) },
    });
    const { troveId: BTroveId, netDebt: B_netDebt, collateral: B_coll } = await openTrove({
      ICR: toBN(dec(190, 16)),
      extraBoldAmount: dec(100, 18),
      extraParams: { from: B, annualInterestRate: dec(4, 16) },
    });
    const { troveId: CTroveId, netDebt: C_netDebt, collateral: C_coll } = await openTrove({
      ICR: toBN(dec(180, 16)),
      extraBoldAmount: dec(100, 18),
      extraParams: { from: C, annualInterestRate: dec(3, 16) },
    });
    const { troveId: DTroveId, netDebt: D_netDebt } = await openTrove({
      ICR: toBN(dec(280, 16)),
      extraBoldAmount: dec(100, 18),
      extraParams: { from: D, annualInterestRate: dec(10, 16) },
    });
    const redemptionAmount = A_netDebt.add(B_netDebt)
      .add(C_netDebt)
      .add(toBN(dec(10, 18)));

    const A_balanceBefore = toBN(await contracts.WETH.balanceOf(A));
    const B_balanceBefore = toBN(await contracts.WETH.balanceOf(B));
    const C_balanceBefore = toBN(await contracts.WETH.balanceOf(C));
    const D_balanceBefore = toBN(await contracts.WETH.balanceOf(D));

    const A_collBefore = await troveManager.getTroveColl(ATroveId);
    const B_collBefore = await troveManager.getTroveColl(BTroveId);
    const C_collBefore = await troveManager.getTroveColl(CTroveId);
    const D_collBefore = await troveManager.getTroveColl(DTroveId);

    await contracts.collateralRegistry.setBaseRate(0);
    // Confirm baseRate before redemption is 0
    const baseRate = await contracts.collateralRegistry.baseRate();
    assert.equal(baseRate, "0");

    const interestA = await troveManager.calcTroveAccruedInterest(ATroveId);
    const interestB = await troveManager.calcTroveAccruedInterest(BTroveId);
    const interestC = await troveManager.calcTroveAccruedInterest(CTroveId);
    const price = toBN(await priceFeed.getPrice());
    const priceWithoutDecimals = price.div(toBN(dec(1, 18)));
    const ETHFee = await contracts.troveManager.getEffectiveRedemptionFeeInColl(redemptionAmount, price);

    // whale redeems Bold.  Expect this to fully redeem A, B, C, and partially redeem D.
    await th.redeemCollateral(whale, contracts, redemptionAmount, th._100pct, GAS_PRICE);

    // Check A, B, C have not been closed
    assert.isFalse(await sortedTroves.contains(ATroveId));
    assert.isFalse(await sortedTroves.contains(BTroveId));
    assert.isFalse(await sortedTroves.contains(CTroveId));

    // Check D stays active
    assert.isTrue(await sortedTroves.contains(DTroveId));

    const A_balanceAfter = toBN(await contracts.WETH.balanceOf(A));
    const B_balanceAfter = toBN(await contracts.WETH.balanceOf(B));
    const C_balanceAfter = toBN(await contracts.WETH.balanceOf(C));
    const D_balanceAfter = toBN(await contracts.WETH.balanceOf(D));

    // Check A, B, C’s trove collateral balance
    const A_collAfter = await troveManager.getTroveColl(ATroveId);
    const B_collAfter = await troveManager.getTroveColl(BTroveId);
    const C_collAfter = await troveManager.getTroveColl(CTroveId);

    const A_debtToEth = A_netDebt.add(interestA).div(priceWithoutDecimals);
    const B_debtToEth = B_netDebt.add(interestB).div(priceWithoutDecimals);
    const C_debtToEth = C_netDebt.add(interestC).div(priceWithoutDecimals);
    const A_surplus = A_collBefore.sub(A_debtToEth).add(
      ETHFee.mul(A_debtToEth).div(redemptionAmount.div(priceWithoutDecimals)),
    );
    const B_surplus = B_collBefore.sub(B_debtToEth).add(
      ETHFee.mul(B_debtToEth).div(redemptionAmount.div(priceWithoutDecimals)),
    );
    const C_surplus = C_collBefore.sub(C_debtToEth).add(
      ETHFee.mul(C_debtToEth).div(redemptionAmount.div(priceWithoutDecimals)),
    );

    th.assertIsApproximatelyEqual(
      A_collAfter,
      A_surplus,
      1e13,
    );
    th.assertIsApproximatelyEqual(
      B_collAfter,
      B_surplus,
      1e13,
    );
    th.assertIsApproximatelyEqual(
      C_collAfter,
      C_surplus,
      1e13,
    );

    // check D's trove collateral balances have decreased (the partially redeemed-from trove)
    const D_collAfter = await troveManager.getTroveColl(DTroveId);
    assert.isTrue(D_collAfter.lt(D_collBefore));

    // Check A, B, C (fully redeemed-from troves), and D's (the partially redeemed-from trove) balance has not changed
    assert.isTrue(A_balanceAfter.eq(A_balanceBefore));
    assert.isTrue(B_balanceAfter.eq(B_balanceBefore));
    assert.isTrue(C_balanceAfter.eq(C_balanceBefore));
    assert.isTrue(D_balanceAfter.eq(D_balanceBefore));

    // D is not closed, so cannot open trove
    await assertRevert(
      th.openTroveWrapper(contracts, 0, ZERO_ADDRESS, ZERO_ADDRESS, th._100pct, {
        from: D,
        value: dec(10, 18),
      }),
      "BorrowerOps: Trove is active",
    );

    if (close) {
      // redemptions don’t close troves, so we need to close them manually
      await borrowerOperations.closeTrove(ATroveId, { from: A });
      await borrowerOperations.closeTrove(BTroveId, { from: B });
      await borrowerOperations.closeTrove(CTroveId, { from: C });

      const A_balanceAfterClose = toBN(await contracts.WETH.balanceOf(A));
      const B_balanceAfterClose = toBN(await contracts.WETH.balanceOf(B));
      const C_balanceAfterClose = toBN(await contracts.WETH.balanceOf(C));

      th.assertIsApproximatelyEqual(
        A_balanceAfterClose,
        A_balanceAfter.add(A_surplus).add(ETH_GAS_COMPENSATION),
        1e13,
      );
      th.assertIsApproximatelyEqual(
        B_balanceAfterClose,
        B_balanceAfter.add(B_surplus).add(ETH_GAS_COMPENSATION),
        1e13,
      );
      th.assertIsApproximatelyEqual(
        C_balanceAfterClose,
        C_balanceAfter.add(C_surplus).add(ETH_GAS_COMPENSATION),
        1e13,
      );
    }

    return {
      A_netDebt,
      A_coll,
      interestA,
      B_netDebt,
      B_coll,
      interestB,
      C_netDebt,
      C_coll,
      interestC,
    };
  };

  it("redeemCollateral(): a redemption that closes a trove leaves the trove's ETH surplus (collateral - ETH drawn) available for the trove owner to claim", async () => {
    const { A_netDebt, A_coll, B_netDebt, B_coll, C_netDebt, C_coll } = await redeemCollateral3Full1Partial(false);

    const A_balanceBefore = toBN(await contracts.WETH.balanceOf(A));
    const B_balanceBefore = toBN(await contracts.WETH.balanceOf(B));
    const C_balanceBefore = toBN(await contracts.WETH.balanceOf(C));

    const A_balanceAfter = toBN(await contracts.WETH.balanceOf(A));
    const B_balanceAfter = toBN(await contracts.WETH.balanceOf(B));
    const C_balanceAfter = toBN(await contracts.WETH.balanceOf(C));

    assert.equal(A_balanceAfter.toString(), A_balanceBefore.toString());
    assert.equal(B_balanceAfter.toString(), B_balanceBefore.toString());
    assert.equal(C_balanceAfter.toString(), C_balanceBefore.toString());
  });

  it("redeemCollateral(): a redemption that closes a trove leaves the trove's ETH surplus (collateral - ETH drawn) available for the trove owner after re-opening trove", async () => {
    const {
      A_netDebt,
      A_coll: A_collBefore,
      interestA,
      B_netDebt,
      B_coll: B_collBefore,
      interestB,
      C_netDebt,
      C_coll: C_collBefore,
      interestC,
    } = await redeemCollateral3Full1Partial(true);

    // Can re-open again the same trove
    const { troveId: ATroveId, collateral: A_coll } = await openTrove({
      ICR: toBN(dec(200, 16)),
      extraBoldAmount: dec(100, 18),
      extraParams: { from: A },
    });
    const { troveId: BTroveId, collateral: B_coll } = await openTrove({
      ICR: toBN(dec(190, 16)),
      extraBoldAmount: dec(100, 18),
      extraParams: { from: B },
    });
    const { troveId: CTroveId, collateral: C_coll } = await openTrove({
      ICR: toBN(dec(180, 16)),
      extraBoldAmount: dec(100, 18),
      extraParams: { from: C },
    });

    const A_collAfter = await troveManager.getTroveColl(ATroveId);
    const B_collAfter = await troveManager.getTroveColl(BTroveId);
    const C_collAfter = await troveManager.getTroveColl(CTroveId);

    assert.isTrue(A_collAfter.eq(A_coll));
    assert.isTrue(B_collAfter.eq(B_coll));
    assert.isTrue(C_collAfter.eq(C_coll));
  });

  it("getPendingBoldDebtReward(): Returns 0 if there is no pending BoldDebt reward", async () => {
    // Make some troves
    const { troveId: defaulter_1_TroveId, totalDebt } = await openTrove({
      ICR: toBN(dec(2, 18)),
      extraBoldAmount: dec(100, 18),
      extraParams: { from: defaulter_1 },
    });

    const { troveId: carolTroveId } = await openTrove({
      ICR: toBN(dec(3, 18)),
      extraBoldAmount: dec(20, 18),
      extraParams: { from: carol },
    });

    await openTrove({
      ICR: toBN(dec(20, 18)),
      extraBoldAmount: totalDebt,
      extraParams: { from: whale },
    });
    await th.provideToSPAndClaim(contracts, totalDebt, { from: whale });

    // Price drops
    await priceFeed.setPrice(dec(100, 18));

    await troveManager.liquidate(defaulter_1_TroveId);

    // Confirm defaulter_1 liquidated
    assert.isFalse(await sortedTroves.contains(defaulter_1_TroveId));

    // Confirm there are no pending rewards from liquidation
    const current_L_boldDebt = await troveManager.L_boldDebt();
    assert.equal(current_L_boldDebt, 0);

    const carolSnapshot_L_boldDebt = (
      await troveManager.rewardSnapshots(carolTroveId)
    )[1];
    assert.equal(carolSnapshot_L_boldDebt, 0);

    const carol_PendingBoldDebtReward = await troveManager.getPendingBoldDebtReward(carolTroveId);
    assert.equal(carol_PendingBoldDebtReward, 0);
  });

  it("getPendingCollReward(): Returns 0 if there is no pending ETH reward", async () => {
    // make some troves
    const { troveId: defaulter_1_TroveId, totalDebt } = await openTrove({
      ICR: toBN(dec(2, 18)),
      extraBoldAmount: dec(100, 18),
      extraParams: { from: defaulter_1 },
    });

    const { troveId: carolTroveId } = await openTrove({
      ICR: toBN(dec(3, 18)),
      extraBoldAmount: dec(20, 18),
      extraParams: { from: carol },
    });

    await openTrove({
      ICR: toBN(dec(20, 18)),
      extraBoldAmount: totalDebt,
      extraParams: { from: whale },
    });
    await th.provideToSPAndClaim(contracts, totalDebt, { from: whale });

    // Price drops
    await priceFeed.setPrice(dec(100, 18));

    await troveManager.liquidate(defaulter_1_TroveId);

    // Confirm defaulter_1 liquidated
    assert.isFalse(await sortedTroves.contains(defaulter_1_TroveId));

    // Confirm there are no pending rewards from liquidation
    const current_L_coll = await troveManager.L_coll();
    assert.equal(current_L_coll, 0);

    const carolSnapshot_L_coll = (await troveManager.rewardSnapshots(carolTroveId))[0];
    assert.equal(carolSnapshot_L_coll, 0);

    const carol_PendingETHReward = await troveManager.getPendingCollReward(
      carol,
    );
    assert.equal(carol_PendingETHReward, 0);
  });

  // --- computeICR ---

  it("computeICR(): Returns 0 if trove's coll is worth 0", async () => {
    const price = 0;
    const coll = dec(1, "ether");
    const debt = dec(100, 18);

    const ICR = (await troveManager.computeICR(coll, debt, price)).toString();

    assert.equal(ICR, 0);
  });

  it("computeICR(): Returns 2^256-1 for ETH:USD = 100, coll = 1 ETH, debt = 100 Bold", async () => {
    const price = dec(100, 18);
    const coll = dec(1, "ether");
    const debt = dec(100, 18);

    const ICR = (await troveManager.computeICR(coll, debt, price)).toString();

    assert.equal(ICR, dec(1, 18));
  });

  it("computeICR(): returns correct ICR for ETH:USD = 100, coll = 200 ETH, debt = 30 Bold", async () => {
    const price = dec(100, 18);
    const coll = dec(200, "ether");
    const debt = dec(30, 18);

    const ICR = (await troveManager.computeICR(coll, debt, price)).toString();

    assert.isAtMost(th.getDifference(ICR, "666666666666666666666"), 1000);
  });

  it("computeICR(): returns correct ICR for ETH:USD = 250, coll = 1350 ETH, debt = 127 Bold", async () => {
    const price = "250000000000000000000";
    const coll = "1350000000000000000000";
    const debt = "127000000000000000000";

    const ICR = await troveManager.computeICR(coll, debt, price);

    assert.isAtMost(th.getDifference(ICR, "2657480314960630000000"), 1000000);
  });

  it("computeICR(): returns correct ICR for ETH:USD = 100, coll = 1 ETH, debt = 54321 Bold", async () => {
    const price = dec(100, 18);
    const coll = dec(1, "ether");
    const debt = "54321000000000000000000";

    const ICR = (await troveManager.computeICR(coll, debt, price)).toString();

    assert.isAtMost(th.getDifference(ICR, "1840908672520756"), 1000);
  });

  it("computeICR(): Returns 2^256-1 if trove has non-zero coll and zero debt", async () => {
    const price = dec(100, 18);
    const coll = dec(1, "ether");
    const debt = 0;

    const ICR = await troveManager.computeICR(coll, debt, price);

    assert.equal(ICR.toString(), th.MAX_UINT256.toString());
  });

  // --- checkBelowCriticalThreshold ---

  // TCR < 150%
  it("checkBelowCriticalThreshold(): Returns true when TCR < 150%", async () => {
    await priceFeed.setPrice(dec(100, 18));

    await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } });
    await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: bob } });

    await priceFeed.setPrice("99999999999999999999");

    const TCR = await th.getTCR(contracts);

    assert.isTrue(TCR.lte(toBN("1500000000000000000")));

    assert.isTrue(await th.checkBelowCriticalThreshold(contracts));
  });

  // TCR == 150%
  it("checkBelowCriticalThreshold(): Returns false when TCR == 150%", async () => {
    await priceFeed.setPrice(dec(100, 18));

    await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } });
    await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: bob } });

    const TCR = await th.getTCR(contracts);

    assert.equal(TCR, "1500000000000000000");

    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));
  });

  // > 150%
  it("checkBelowCriticalThreshold(): Returns false when TCR > 150%", async () => {
    await priceFeed.setPrice(dec(100, 18));

    await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } });
    await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: bob } });

    await priceFeed.setPrice("100000000000000000001");

    const TCR = await th.getTCR(contracts);

    assert.isTrue(TCR.gte(toBN("1500000000000000000")));

    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));
  });

  // check 0
  it("checkBelowCriticalThreshold(): Returns false when TCR == 0", async () => {
    await priceFeed.setPrice(dec(100, 18));

    await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } });
    await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: bob } });

    await priceFeed.setPrice(0);

    const TCR = (await th.getTCR(contracts)).toString();

    assert.equal(TCR, 0);

    assert.isTrue(await th.checkBelowCriticalThreshold(contracts));
  });

  // --- Getters ---

  it("getTroveStake(): Returns stake", async () => {
    const { troveId: ATroveId, collateral: A_coll } = await openTrove({
      ICR: toBN(dec(150, 16)),
      extraParams: { from: A },
    });
    const { troveId: BTroveId, collateral: B_coll } = await openTrove({
      ICR: toBN(dec(150, 16)),
      extraParams: { from: B },
    });

    const A_Stake = await troveManager.getTroveStake(ATroveId);
    const B_Stake = await troveManager.getTroveStake(BTroveId);

    assert.equal(A_Stake, A_coll.toString());
    assert.equal(B_Stake, B_coll.toString());
  });

  it("getTroveColl(): Returns coll", async () => {
    const { troveId: ATroveId, collateral: A_coll } = await openTrove({
      ICR: toBN(dec(150, 16)),
      extraParams: { from: A },
    });
    const { troveId: BTroveId, collateral: B_coll } = await openTrove({
      ICR: toBN(dec(150, 16)),
      extraParams: { from: B },
    });

    assert.equal(await troveManager.getTroveColl(ATroveId), A_coll.toString());
    assert.equal(await troveManager.getTroveColl(BTroveId), B_coll.toString());
  });

  it("getTroveDebt(): Returns debt", async () => {
    const { troveId: ATroveId, totalDebt: totalDebtA } = await openTrove({
      ICR: toBN(dec(150, 16)),
      extraParams: { from: A },
    });
    const { troveId: BTroveId, totalDebt: totalDebtB } = await openTrove({
      ICR: toBN(dec(150, 16)),
      extraParams: { from: B },
    });

    const A_Debt = await troveManager.getTroveDebt(ATroveId);
    const B_Debt = await troveManager.getTroveDebt(BTroveId);

    // Expect debt = requested + 0.5% fee + 50 (due to gas comp)

    assert.equal(A_Debt, totalDebtA.toString());
    assert.equal(B_Debt, totalDebtB.toString());
  });

  it("getTroveStatus(): Returns status", async () => {
    const { troveId: BTroveId, totalDebt: B_totalDebt } = await openTrove({
      ICR: toBN(dec(150, 16)),
      extraParams: { from: B },
    });
    const { troveId: ATroveId } = await openTrove({
      ICR: toBN(dec(150, 16)),
      extraBoldAmount: B_totalDebt,
      extraParams: { from: A },
    });

    // to be able to repay:
    await boldToken.transfer(B, B_totalDebt, { from: A });
    await borrowerOperations.closeTrove(BTroveId, { from: B });

    const A_Status = await troveManager.getTroveStatus(ATroveId);
    const B_Status = await troveManager.getTroveStatus(BTroveId);
    const C_Status = await troveManager.getTroveStatus(th.addressToTroveId(C));

    assert.equal(A_Status, "1"); // active
    assert.equal(B_Status, "2"); // closed by user
    assert.equal(C_Status, "0"); // non-existent
  });

  it("hasRedistributionGains(): Returns false it trove is not active", async () => {
    assert.isFalse(await troveManager.hasRedistributionGains(th.addressToTroveId(alice)));
  });
});

contract("Reset chain state", async (accounts) => {});
