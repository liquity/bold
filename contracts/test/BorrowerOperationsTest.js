const { TestHelper: th } = require("../utils/testHelpers.js");
const { createDeployAndFundFixture } = require("../utils/testFixtures.js");

const BorrowerOperationsTester = artifacts.require(
  "./BorrowerOperationsTester.sol",
);
const TroveManagerTester = artifacts.require("TroveManagerTester");
const CollateralRegistryTester = artifacts.require("CollateralRegistryTester");

const { dec, toBN, assertRevert } = th;

contract("BorrowerOperations", async (accounts) => {
  const accountsToFund = accounts.slice(0, 17);

  const [
    owner,
    alice,
    bob,
    carol,
    dennis,
    whale,
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H,
    frontEnd_1,
    frontEnd_2,
    frontEnd_3,
  ] = accountsToFund;

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000);

  let contracts;

  let priceFeed;
  let boldToken;
  let sortedTroves;
  let troveManager;
  let activePool;
  let defaultPool;
  let borrowerOperations;
  let collateralRegistry;

  let BOLD_GAS_COMPENSATION;
  let MIN_NET_DEBT;
  let BORROWING_FEE_FLOOR;

  const getOpenTroveBoldAmount = async (totalDebt) => th.getOpenTroveBoldAmount(contracts, totalDebt);
  const getNetBorrowingAmount = async (debtWithFee) => th.getNetBorrowingAmount(contracts, debtWithFee);
  const getActualDebtFromComposite = async (compositeDebt) => th.getActualDebtFromComposite(compositeDebt, contracts);
  const openTrove = async (params) => th.openTrove(contracts, params);
  const getTroveEntireColl = async (trove) => th.getTroveEntireColl(contracts, trove);
  const getTroveEntireDebt = async (trove) => th.getTroveEntireDebt(contracts, trove);
  const getTroveStake = async (trove) => th.getTroveStake(contracts, trove);

  const deployFixture = createDeployAndFundFixture({
    accounts: accountsToFund,
    mocks: {
      BorrowerOperations: BorrowerOperationsTester,
      TroveManager: TroveManagerTester,
      CollateralRegistry: CollateralRegistryTester,
    },
    callback: async (contracts) => {
      const { borrowerOperations } = contracts;
      const [
        BOLD_GAS_COMPENSATION,
        MIN_NET_DEBT,
        BORROWING_FEE_FLOOR,
      ] = await Promise.all([
        borrowerOperations.BOLD_GAS_COMPENSATION(),
        borrowerOperations.MIN_NET_DEBT(),
        borrowerOperations.BORROWING_FEE_FLOOR(),
      ]);
      return {
        BOLD_GAS_COMPENSATION,
        MIN_NET_DEBT,
        BORROWING_FEE_FLOOR,
      };
    },
  });

  const testCorpus = () => {
    beforeEach(async () => {
      const result = await deployFixture();

      contracts = result.contracts;
      priceFeed = contracts.priceFeedTestnet;
      boldToken = contracts.boldToken;
      sortedTroves = contracts.sortedTroves;
      troveManager = contracts.troveManager;
      activePool = contracts.activePool;
      defaultPool = contracts.defaultPool;
      borrowerOperations = contracts.borrowerOperations;
      collateralRegistry = contracts.collateralRegistry;

      BOLD_GAS_COMPENSATION = result.BOLD_GAS_COMPENSATION;
      MIN_NET_DEBT = result.MIN_NET_DEBT;
      BORROWING_FEE_FLOOR = result.BORROWING_FEE_FLOOR;
    });

    it("addColl(): reverts when top-up would leave trove with ICR < MCR", async () => {
      // alice creates a Trove and adds first collateral
      const { troveId: aliceTroveId } = await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } });
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: bob } });

      // Price drops
      await priceFeed.setPrice(dec(100, 18));
      const price = await priceFeed.getPrice();

      assert.isFalse(await troveManager.checkRecoveryMode(price));
      assert.isTrue(
        (await troveManager.getCurrentICR(aliceTroveId, price)).lt(toBN(dec(110, 16))),
      );

      const collTopUp = 1; // 1 wei top up

      await assertRevert(
        th.addCollWrapper(contracts, {
          from: alice,
          value: collTopUp,
        }),
        "BorrowerOps: An operation that would result in ICR < MCR is not permitted",
      );
    });

    it("addColl(): Increases the activePool ETH and raw ether balance by correct amount", async () => {
      const { collateral: aliceColl } = await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });

      const activePool_ETH_Before = await activePool.getETHBalance();
      const activePool_RawEther_Before = toBN(
        await contracts.WETH.balanceOf(activePool.address),
      );

      assert.isTrue(activePool_ETH_Before.eq(aliceColl));
      assert.isTrue(activePool_RawEther_Before.eq(aliceColl));

      await th.addCollWrapper(contracts, {
        from: alice,
        value: dec(1, "ether"),
      });

      const activePool_ETH_After = await activePool.getETHBalance();
      const activePool_RawEther_After = toBN(
        await contracts.WETH.balanceOf(activePool.address),
      );
      assert.isTrue(
        activePool_ETH_After.eq(aliceColl.add(toBN(dec(1, "ether")))),
      );
      assert.isTrue(
        activePool_RawEther_After.eq(aliceColl.add(toBN(dec(1, "ether")))),
      );
    });

    it("addColl(), active Trove: adds the correct collateral amount to the Trove", async () => {
      // alice creates a Trove and adds first collateral
      const { troveId: aliceTroveId } = await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } });

      const alice_Trove_Before = await troveManager.Troves(aliceTroveId);
      const coll_before = alice_Trove_Before[1];
      const status_Before = alice_Trove_Before[3];

      // check status before
      assert.equal(status_Before, 1);

      // Alice adds second collateral
      await th.addCollWrapper(contracts, {
        from: alice,
        value: dec(1, "ether"),
      });

      const alice_Trove_After = await troveManager.Troves(aliceTroveId);
      const coll_After = alice_Trove_After[1];
      const status_After = alice_Trove_After[3];

      // check coll increases by correct amount,and status remains active
      assert.isTrue(coll_After.eq(coll_before.add(toBN(dec(1, "ether")))));
      assert.equal(status_After, 1);
    });

    it("addColl(), active Trove: Trove is in sortedList before and after", async () => {
      // alice creates a Trove and adds first collateral
      const { troveId: aliceTroveId } = await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } });

      // check Alice is in list before
      const aliceTroveInList_Before = await sortedTroves.contains(aliceTroveId);
      const listIsEmpty_Before = await sortedTroves.isEmpty();
      assert.equal(aliceTroveInList_Before, true);
      assert.equal(listIsEmpty_Before, false);

      await th.addCollWrapper(contracts, {
        from: alice,
        value: dec(1, "ether"),
      });

      // check Alice is still in list after
      const aliceTroveInList_After = await sortedTroves.contains(aliceTroveId);
      const listIsEmpty_After = await sortedTroves.isEmpty();
      assert.equal(aliceTroveInList_After, true);
      assert.equal(listIsEmpty_After, false);
    });

    it("addColl(), active Trove: updates the stake and updates the total stakes", async () => {
      //  Alice creates initial Trove with 1 ether
      const { troveId: aliceTroveId } = await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } });

      const alice_Trove_Before = await troveManager.Troves(aliceTroveId);
      const alice_Stake_Before = alice_Trove_Before[2];
      const totalStakes_Before = await troveManager.totalStakes();

      assert.isTrue(totalStakes_Before.eq(alice_Stake_Before));

      // Alice tops up Trove collateral with 2 ether
      await th.addCollWrapper(contracts, {
        from: alice,
        value: dec(2, "ether"),
      });

      // Check stake and total stakes get updated
      const alice_Trove_After = await troveManager.Troves(aliceTroveId);
      const alice_Stake_After = alice_Trove_After[2];
      const totalStakes_After = await troveManager.totalStakes();

      assert.isTrue(
        alice_Stake_After.eq(alice_Stake_Before.add(toBN(dec(2, "ether")))),
      );
      assert.isTrue(
        totalStakes_After.eq(totalStakes_Before.add(toBN(dec(2, "ether")))),
      );
    });

    it("addColl(), active Trove: applies pending rewards and updates user's L_ETH, L_boldDebt snapshots", async () => {
      // --- SETUP ---

      const { troveId: aliceTroveId, collateral: aliceCollBefore, totalDebt: aliceDebtBefore } = await openTrove({
        extraBoldAmount: toBN(dec(15000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });
      const { troveId: bobTroveId, collateral: bobCollBefore, totalDebt: bobDebtBefore } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob },
      });
      const { troveId: carolTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: carol },
      });

      // --- TEST ---

      // price drops to 1ETH:100Bold, reducing Carol's ICR below MCR
      await priceFeed.setPrice("100000000000000000000");

      // Liquidate Carol's Trove,
      const tx = await troveManager.liquidate(carolTroveId, { from: owner });

      assert.isFalse(await sortedTroves.contains(carolTroveId));

      const L_ETH = await troveManager.L_ETH();
      const L_boldDebt = await troveManager.L_boldDebt();

      // check Alice and Bob's reward snapshots are zero before they alter their Troves
      const alice_rewardSnapshot_Before = await troveManager.rewardSnapshots(
        alice,
      );
      const alice_ETHrewardSnapshot_Before = alice_rewardSnapshot_Before[0];
      const alice_BoldDebtRewardSnapshot_Before = alice_rewardSnapshot_Before[1];

      const bob_rewardSnapshot_Before = await troveManager.rewardSnapshots(bobTroveId);
      const bob_ETHrewardSnapshot_Before = bob_rewardSnapshot_Before[0];
      const bob_BoldDebtRewardSnapshot_Before = bob_rewardSnapshot_Before[1];

      assert.equal(alice_ETHrewardSnapshot_Before, 0);
      assert.equal(alice_BoldDebtRewardSnapshot_Before, 0);
      assert.equal(bob_ETHrewardSnapshot_Before, 0);
      assert.equal(bob_BoldDebtRewardSnapshot_Before, 0);

      const alicePendingETHReward = await troveManager.getPendingETHReward(aliceTroveId);
      const bobPendingETHReward = await troveManager.getPendingETHReward(bobTroveId);
      const alicePendingBoldDebtReward = await troveManager.getPendingBoldDebtReward(aliceTroveId);
      const bobPendingBoldDebtReward = await troveManager.getPendingBoldDebtReward(bobTroveId);
      for (
        const reward of [
          alicePendingETHReward,
          bobPendingETHReward,
          alicePendingBoldDebtReward,
          bobPendingBoldDebtReward,
        ]
      ) {
        assert.isTrue(reward.gt(toBN("0")));
      }

      // Alice and Bob top up their Troves
      const aliceTopUp = toBN(dec(5, "ether"));
      const bobTopUp = toBN(dec(1, "ether"));

      await th.addCollWrapper(contracts, {
        from: alice,
        value: aliceTopUp,
      });
      await th.addCollWrapper(contracts, {
        from: bob,
        value: bobTopUp,
      });

      // Check that both alice and Bob have had pending rewards applied in addition to their top-ups.
      const aliceNewColl = await getTroveEntireColl(aliceTroveId);
      const aliceNewDebt = await getTroveEntireDebt(aliceTroveId);
      const bobNewColl = await getTroveEntireColl(bobTroveId);
      const bobNewDebt = await getTroveEntireDebt(bobTroveId);

      assert.isTrue(
        aliceNewColl.eq(
          aliceCollBefore.add(alicePendingETHReward).add(aliceTopUp),
        ),
      );
      assert.isTrue(
        aliceNewDebt.eq(aliceDebtBefore.add(alicePendingBoldDebtReward)),
      );
      assert.isTrue(
        bobNewColl.eq(bobCollBefore.add(bobPendingETHReward).add(bobTopUp)),
      );
      assert.isTrue(bobNewDebt.eq(bobDebtBefore.add(bobPendingBoldDebtReward)));

      /* Check that both Alice and Bob's snapshots of the rewards-per-unit-staked metrics should be updated
       to the latest values of L_ETH and L_boldDebt */
      const alice_rewardSnapshot_After = await troveManager.rewardSnapshots(aliceTroveId);
      const alice_ETHrewardSnapshot_After = alice_rewardSnapshot_After[0];
      const alice_BoldDebtRewardSnapshot_After = alice_rewardSnapshot_After[1];

      const bob_rewardSnapshot_After = await troveManager.rewardSnapshots(bobTroveId);
      const bob_ETHrewardSnapshot_After = bob_rewardSnapshot_After[0];
      const bob_BoldDebtRewardSnapshot_After = bob_rewardSnapshot_After[1];

      assert.isAtMost(
        th.getDifference(alice_ETHrewardSnapshot_After, L_ETH),
        100,
      );
      assert.isAtMost(
        th.getDifference(alice_BoldDebtRewardSnapshot_After, L_boldDebt),
        100,
      );
      assert.isAtMost(
        th.getDifference(bob_ETHrewardSnapshot_After, L_ETH),
        100,
      );
      assert.isAtMost(
        th.getDifference(bob_BoldDebtRewardSnapshot_After, L_boldDebt),
        100,
      );
    });

    // it("addColl(), active Trove: adds the right corrected stake after liquidations have occured", async () => {
    //  // TODO - check stake updates for addColl/withdrawColl/adustTrove ---

    //   // --- SETUP ---
    //   // A,B,C add 15/5/5 ETH, withdraw 100/100/900 Bold
    //   await th.openTroveWrapper(contracts,th._100pct, dec(100, 18), alice, alice, { from: alice, value: dec(15, 'ether') })
    //   await th.openTroveWrapper(contracts,th._100pct, dec(100, 18), bob, bob, { from: bob, value: dec(4, 'ether') })
    //   await th.openTroveWrapper(contracts,th._100pct, dec(900, 18), carol, carol, { from: carol, value: dec(5, 'ether') })

    //   await th.openTroveWrapper(contracts,th._100pct, 0, dennis, dennis, { from: dennis, value: dec(1, 'ether') })
    //   // --- TEST ---

    //   // price drops to 1ETH:100Bold, reducing Carol's ICR below MCR
    //   await priceFeed.setPrice('100000000000000000000');

    //   // close Carol's Trove, liquidating her 5 ether and 900Bold.
    //   await troveManager.liquidate(carolTroveId, { from: owner });

    //   // dennis tops up his trove by 1 ETH
    //   await th.addCollWrapper(contracts,dennis, dennis, { from: dennis, value: dec(1, 'ether') })

    //   /* Check that Dennis's recorded stake is the right corrected stake, less than his collateral. A corrected
    //   stake is given by the formula:

    //   s = totalStakesSnapshot / totalCollateralSnapshot

    //   where snapshots are the values immediately after the last liquidation.  After Carol's liquidation,
    //   the ETH from her Trove has now become the totalPendingETHReward. So:

    //   totalStakes = (alice_Stake + bob_Stake + dennis_orig_stake ) = (15 + 4 + 1) =  20 ETH.
    //   totalCollateral = (alice_Collateral + bob_Collateral + dennis_orig_coll + totalPendingETHReward) = (15 + 4 + 1 + 5)  = 25 ETH.

    //   Therefore, as Dennis adds 1 ether collateral, his corrected stake should be:  s = 2 * (20 / 25 ) = 1.6 ETH */
    //   const dennis_Trove = await troveManager.Troves(dennisTroveId)

    //   const dennis_Stake = dennis_Trove[2]
    //   console.log(dennis_Stake.toString())

    //   assert.isAtMost(th.getDifference(dennis_Stake), 100)
    // })

    it("addColl(), reverts if trove is non-existent or closed", async () => {
      // A, B open troves
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } });
      const { troveId: bobTroveId } = await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: bob } });

      // Carol attempts to add collateral to her non-existent trove
      try {
        const txCarol = await th.addCollWrapper(contracts, {
          from: carol,
          value: dec(1, "ether"),
        });
        assert.isFalse(txCarol.receipt.status);
      } catch (error) {
        assert.include(error.message, "revert");
        assert.include(error.message, "Trove does not exist or is closed");
      }

      // Price drops
      await priceFeed.setPrice(dec(100, 18));

      // Bob gets liquidated
      await troveManager.liquidate(bobTroveId);

      assert.isFalse(await sortedTroves.contains(bobTroveId));

      // Bob attempts to add collateral to his closed trove
      try {
        const txBob = await th.addCollWrapper(contracts, {
          from: bob,
          value: dec(1, "ether"),
        });
        assert.isFalse(txBob.receipt.status);
      } catch (error) {
        assert.include(error.message, "revert");
        assert.include(error.message, "Trove does not exist or is closed");
      }
    });

    it("addColl(): can add collateral in Recovery Mode", async () => {
      const { troveId: aliceTroveId } = await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } });
      const aliceCollBefore = await getTroveEntireColl(aliceTroveId);
      assert.isFalse(await th.checkRecoveryMode(contracts));

      await priceFeed.setPrice("105000000000000000000");

      assert.isTrue(await th.checkRecoveryMode(contracts));

      const collTopUp = toBN(dec(1, "ether"));
      await th.addCollWrapper(contracts, {
        from: alice,
        value: collTopUp,
      });

      // Check Alice's collateral
      const aliceCollAfter = (await troveManager.Troves(aliceTroveId))[1];
      assert.isTrue(aliceCollAfter.eq(aliceCollBefore.add(collTopUp)));
    });

    // --- withdrawColl() ---

    it("withdrawColl(): reverts when withdrawal would leave trove with ICR < MCR", async () => {
      // alice creates a Trove and adds first collateral
      const { troveId: aliceTroveId } = await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } });
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: bob } });

      // Price drops
      await priceFeed.setPrice(dec(100, 18));
      const price = await priceFeed.getPrice();

      assert.isFalse(await troveManager.checkRecoveryMode(price));
      assert.isTrue(
        (await troveManager.getCurrentICR(aliceTroveId, price)).lt(toBN(dec(110, 16))),
      );

      const collWithdrawal = 1; // 1 wei withdrawal

      await assertRevert(
        borrowerOperations.withdrawColl(aliceTroveId, 1, { from: alice }),
        "BorrowerOps: An operation that would result in ICR < MCR is not permitted",
      );
    });

    // reverts when calling address does not have active trove
    it("withdrawColl(): reverts when calling address does not have active trove", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });
      const { troveId: bobTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob },
      });

      // Bob successfully withdraws some coll
      const txBob = await borrowerOperations.withdrawColl(
        bobTroveId,
        dec(100, "finney"),
        { from: bob },
      );
      assert.isTrue(txBob.receipt.status);

      // Carol with no active trove attempts to withdraw
      try {
        const txCarol = await borrowerOperations.withdrawColl(
          th.addressToTroveId(carol),
          dec(1, "ether"),
          { from: carol },
        );
        assert.isFalse(txCarol.receipt.status);
      } catch (err) {
        assert.include(err.message, "revert");
      }
    });

    it("withdrawColl(): reverts when system is in Recovery Mode", async () => {
      const { troveId: aliceTroveId } = await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } });
      const { troveId: bobTroveId } = await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: bob } });

      assert.isFalse(await th.checkRecoveryMode(contracts));

      // Withdrawal possible when recoveryMode == false
      const txAlice = await borrowerOperations.withdrawColl(
        aliceTroveId,
        1000,
        { from: alice },
      );
      assert.isTrue(txAlice.receipt.status);

      await priceFeed.setPrice("105000000000000000000");

      assert.isTrue(await th.checkRecoveryMode(contracts));

      // Check withdrawal impossible when recoveryMode == true
      try {
        const txBob = await borrowerOperations.withdrawColl(bobTroveId, 1000, {
          from: bob,
        });
        assert.isFalse(txBob.receipt.status);
      } catch (err) {
        assert.include(err.message, "revert");
      }
    });

    it("withdrawColl(): reverts when requested ETH withdrawal is > the trove's collateral", async () => {
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } });
      const { troveId: bobTroveId } = await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: bob } });
      const { troveId: carol_Id } = await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: carol } });

      const carolColl = await getTroveEntireColl(carol_Id);
      const bobColl = await getTroveEntireColl(bobTroveId);
      // Carol withdraws exactly all her collateral
      await assertRevert(
        borrowerOperations.withdrawColl(carol_Id, carolColl, {
          from: carol,
        }),
        "BorrowerOps: An operation that would result in ICR < MCR is not permitted",
      );

      // Bob attempts to withdraw 1 wei more than his collateral
      try {
        const txBob = await borrowerOperations.withdrawColl(
          bobTroveId,
          bobColl.add(toBN(1)),
          { from: bob },
        );
        assert.isFalse(txBob.receipt.status);
      } catch (err) {
        assert.include(err.message, "revert");
      }
    });

    it("withdrawColl(): reverts when withdrawal would bring the user's ICR < MCR", async () => {
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } });

      const { troveId: bobTroveId } = await openTrove({ ICR: toBN(dec(11, 17)), extraParams: { from: bob } }); // 110% ICR

      // Bob attempts to withdraws 1 wei, Which would leave him with < 110% ICR.

      try {
        const txBob = await borrowerOperations.withdrawColl(bobTroveId, 1, {
          from: bob,
        });
        assert.isFalse(txBob.receipt.status);
      } catch (err) {
        assert.include(err.message, "revert");
      }
    });

    it("withdrawColl(): reverts if system is in Recovery Mode", async () => {
      // --- SETUP ---

      // A and B open troves at 150% ICR
      await openTrove({ ICR: toBN(dec(15, 17)), extraParams: { from: bob } });
      const { troveId: aliceTroveId } = await openTrove({ ICR: toBN(dec(15, 17)), extraParams: { from: alice } });

      const TCR = (await th.getTCR(contracts)).toString();
      assert.equal(TCR, "1500000000000000000");

      // --- TEST ---

      // price drops to 1ETH:150Bold, reducing TCR below 150%
      await priceFeed.setPrice("150000000000000000000");

      // Alice tries to withdraw collateral during Recovery Mode
      try {
        const txData = await borrowerOperations.withdrawColl(
          aliceTroveId,
          "1",
          { from: alice },
        );
        assert.isFalse(txData.receipt.status);
      } catch (err) {
        assert.include(err.message, "revert");
      }
    });

    it("withdrawColl(): doesn’t allow a user to completely withdraw all collateral from their Trove (due to gas compensation)", async () => {
      const { troveId: aliceTroveId } = await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: bob } });
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } });

      const aliceColl = (await troveManager.getEntireDebtAndColl(aliceTroveId))[1];

      // Check Trove is active
      const alice_Trove_Before = await troveManager.Troves(aliceTroveId);
      const status_Before = alice_Trove_Before[3];
      assert.equal(status_Before, 1);
      assert.isTrue(await sortedTroves.contains(aliceTroveId));

      // Alice attempts to withdraw all collateral
      await assertRevert(
        borrowerOperations.withdrawColl(aliceTroveId, aliceColl, {
          from: alice,
        }),
        "BorrowerOps: An operation that would result in ICR < MCR is not permitted",
      );
    });

    it("withdrawColl(): leaves the Trove active when the user withdraws less than all the collateral", async () => {
      // Open Trove
      const { troveId: aliceTroveId } = await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } });

      // Check Trove is active
      const alice_Trove_Before = await troveManager.Troves(aliceTroveId);
      const status_Before = alice_Trove_Before[3];
      assert.equal(status_Before, 1);
      assert.isTrue(await sortedTroves.contains(aliceTroveId));

      // Withdraw some collateral
      await borrowerOperations.withdrawColl(aliceTroveId, dec(100, "finney"), {
        from: alice,
      });

      // Check Trove is still active
      const alice_Trove_After = await troveManager.Troves(aliceTroveId);
      const status_After = alice_Trove_After[3];
      assert.equal(status_After, 1);
      assert.isTrue(await sortedTroves.contains(aliceTroveId));
    });

    it("withdrawColl(): reduces the Trove's collateral by the correct amount", async () => {
      const { troveId: aliceTroveId } = await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } });
      const aliceCollBefore = await getTroveEntireColl(aliceTroveId);

      // Alice withdraws 1 ether
      await borrowerOperations.withdrawColl(aliceTroveId, dec(1, "ether"), {
        from: alice,
      });

      // Check 1 ether remaining
      const alice_Trove_After = await troveManager.Troves(aliceTroveId);
      const aliceCollAfter = await getTroveEntireColl(aliceTroveId);

      assert.isTrue(
        aliceCollAfter.eq(aliceCollBefore.sub(toBN(dec(1, "ether")))),
      );
    });

    it("withdrawColl(): reduces ActivePool ETH and raw ether by correct amount", async () => {
      const { troveId: aliceTroveId } = await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } });
      const aliceCollBefore = await getTroveEntireColl(aliceTroveId);

      // check before
      const activePool_ETH_before = await activePool.getETHBalance();
      const activePool_RawEther_before = toBN(
        await contracts.WETH.balanceOf(activePool.address),
      );

      await borrowerOperations.withdrawColl(aliceTroveId, dec(1, "ether"), {
        from: alice,
      });

      // check after
      const activePool_ETH_After = await activePool.getETHBalance();
      const activePool_RawEther_After = toBN(
        await contracts.WETH.balanceOf(activePool.address),
      );
      assert.isTrue(
        activePool_ETH_After.eq(
          activePool_ETH_before.sub(toBN(dec(1, "ether"))),
        ),
      );
      assert.isTrue(
        activePool_RawEther_After.eq(
          activePool_RawEther_before.sub(toBN(dec(1, "ether"))),
        ),
      );
    });

    it("withdrawColl(): updates the stake and updates the total stakes", async () => {
      //  Alice creates initial Trove with 2 ether
      const { troveId: aliceTroveId } = await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice, value: toBN(dec(5, "ether")) },
      });
      const aliceColl = await getTroveEntireColl(aliceTroveId);
      assert.isTrue(aliceColl.gt(toBN("0")));

      const alice_Trove_Before = await troveManager.Troves(aliceTroveId);
      const alice_Stake_Before = alice_Trove_Before[2];
      const totalStakes_Before = await troveManager.totalStakes();

      assert.isTrue(alice_Stake_Before.eq(aliceColl));
      assert.isTrue(totalStakes_Before.eq(aliceColl));

      // Alice withdraws 1 ether
      await borrowerOperations.withdrawColl(aliceTroveId, dec(1, "ether"), {
        from: alice,
      });

      // Check stake and total stakes get updated
      const alice_Trove_After = await troveManager.Troves(aliceTroveId);
      const alice_Stake_After = alice_Trove_After[2];
      const totalStakes_After = await troveManager.totalStakes();

      assert.isTrue(
        alice_Stake_After.eq(alice_Stake_Before.sub(toBN(dec(1, "ether")))),
      );
      assert.isTrue(
        totalStakes_After.eq(totalStakes_Before.sub(toBN(dec(1, "ether")))),
      );
    });

    it("withdrawColl(): sends the correct amount of ETH to the user", async () => {
      const { troveId: aliceTroveId } = await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice, value: dec(2, "ether") },
      });

      const alice_ETHBalance_Before = toBN(
        web3.utils.toBN(await contracts.WETH.balanceOf(alice)),
      );
      await borrowerOperations.withdrawColl(aliceTroveId, dec(1, "ether"), {
        from: alice,
        gasPrice: 0,
      });

      const alice_ETHBalance_After = toBN(
        web3.utils.toBN(await contracts.WETH.balanceOf(alice)),
      );
      const balanceDiff = alice_ETHBalance_After.sub(alice_ETHBalance_Before);

      assert.isTrue(balanceDiff.eq(toBN(dec(1, "ether"))));
    });

    it("withdrawColl(): applies pending rewards and updates user's L_ETH, L_boldDebt snapshots", async () => {
      // --- SETUP ---
      // Alice adds 15 ether, Bob adds 5 ether, Carol adds 1 ether
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } });
      const { troveId: aliceTroveId } = await openTrove({
        ICR: toBN(dec(3, 18)),
        extraParams: { from: alice, value: toBN(dec(100, "ether")) },
      });
      const { troveId: bobTroveId } = await openTrove({
        ICR: toBN(dec(3, 18)),
        extraParams: { from: bob, value: toBN(dec(100, "ether")) },
      });
      const { troveId: carol_Id } = await openTrove({
        ICR: toBN(dec(2, 18)),
        extraParams: { from: carol, value: toBN(dec(10, "ether")) },
      });

      const aliceCollBefore = await getTroveEntireColl(aliceTroveId);
      const aliceDebtBefore = await getTroveEntireDebt(aliceTroveId);
      const bobCollBefore = await getTroveEntireColl(bobTroveId);
      const bobDebtBefore = await getTroveEntireDebt(bobTroveId);

      // --- TEST ---

      // price drops to 1ETH:100Bold, reducing Carol's ICR below MCR
      await priceFeed.setPrice("100000000000000000000");

      // close Carol's Trove, liquidating her 1 ether and 180Bold.
      await troveManager.liquidate(carol_Id, { from: owner });

      const L_ETH = await troveManager.L_ETH();
      const L_boldDebt = await troveManager.L_boldDebt();

      // check Alice and Bob's reward snapshots are zero before they alter their Troves
      const alice_rewardSnapshot_Before = await troveManager.rewardSnapshots(
        aliceTroveId,
      );
      const alice_ETHrewardSnapshot_Before = alice_rewardSnapshot_Before[0];
      const alice_BoldDebtRewardSnapshot_Before = alice_rewardSnapshot_Before[1];

      const bob_rewardSnapshot_Before = await troveManager.rewardSnapshots(bobTroveId);
      const bob_ETHrewardSnapshot_Before = bob_rewardSnapshot_Before[0];
      const bob_BoldDebtRewardSnapshot_Before = bob_rewardSnapshot_Before[1];

      assert.equal(alice_ETHrewardSnapshot_Before, 0);
      assert.equal(alice_BoldDebtRewardSnapshot_Before, 0);
      assert.equal(bob_ETHrewardSnapshot_Before, 0);
      assert.equal(bob_BoldDebtRewardSnapshot_Before, 0);

      // Check A and B have pending rewards
      const pendingCollReward_A = await troveManager.getPendingETHReward(aliceTroveId);
      const pendingDebtReward_A = await troveManager.getPendingBoldDebtReward(aliceTroveId);
      const pendingCollReward_B = await troveManager.getPendingETHReward(bobTroveId);
      const pendingDebtReward_B = await troveManager.getPendingBoldDebtReward(bobTroveId);
      for (
        const reward of [
          pendingCollReward_A,
          pendingDebtReward_A,
          pendingCollReward_B,
          pendingDebtReward_B,
        ]
      ) {
        assert.isTrue(reward.gt(toBN("0")));
      }

      // Alice and Bob withdraw from their Troves
      const aliceCollWithdrawal = toBN(dec(5, "ether"));
      const bobCollWithdrawal = toBN(dec(1, "ether"));

      await borrowerOperations.withdrawColl(aliceTroveId, aliceCollWithdrawal, {
        from: alice,
      });
      await borrowerOperations.withdrawColl(bobTroveId, bobCollWithdrawal, {
        from: bob,
      });

      // Check that both alice and Bob have had pending rewards applied in addition to their top-ups.
      const aliceCollAfter = await getTroveEntireColl(aliceTroveId);
      const aliceDebtAfter = await getTroveEntireDebt(aliceTroveId);
      const bobCollAfter = await getTroveEntireColl(bobTroveId);
      const bobDebtAfter = await getTroveEntireDebt(bobTroveId);

      // Check rewards have been applied to troves
      th.assertIsApproximatelyEqual(
        aliceCollAfter,
        aliceCollBefore.add(pendingCollReward_A).sub(aliceCollWithdrawal),
        10000,
      );
      th.assertIsApproximatelyEqual(
        aliceDebtAfter,
        aliceDebtBefore.add(pendingDebtReward_A),
        10000,
      );
      th.assertIsApproximatelyEqual(
        bobCollAfter,
        bobCollBefore.add(pendingCollReward_B).sub(bobCollWithdrawal),
        10000,
      );
      th.assertIsApproximatelyEqual(
        bobDebtAfter,
        bobDebtBefore.add(pendingDebtReward_B),
        10000,
      );

      /* After top up, both Alice and Bob's snapshots of the rewards-per-unit-staked metrics should be updated
       to the latest values of L_ETH and L_boldDebt */
      const alice_rewardSnapshot_After = await troveManager.rewardSnapshots(
        aliceTroveId,
      );
      const alice_ETHrewardSnapshot_After = alice_rewardSnapshot_After[0];
      const alice_BoldDebtRewardSnapshot_After = alice_rewardSnapshot_After[1];

      const bob_rewardSnapshot_After = await troveManager.rewardSnapshots(bobTroveId);
      const bob_ETHrewardSnapshot_After = bob_rewardSnapshot_After[0];
      const bob_BoldDebtRewardSnapshot_After = bob_rewardSnapshot_After[1];

      assert.isAtMost(
        th.getDifference(alice_ETHrewardSnapshot_After, L_ETH),
        100,
      );
      assert.isAtMost(
        th.getDifference(alice_BoldDebtRewardSnapshot_After, L_boldDebt),
        100,
      );
      assert.isAtMost(
        th.getDifference(bob_ETHrewardSnapshot_After, L_ETH),
        100,
      );
      assert.isAtMost(
        th.getDifference(bob_BoldDebtRewardSnapshot_After, L_boldDebt),
        100,
      );
    });

    // --- withdrawBold() ---

    it("withdrawBold(): reverts when withdrawal would leave trove with ICR < MCR", async () => {
      // alice creates a Trove and adds first collateral
      const { troveId: aliceTroveId } = await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } });
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: bob } });

      // Price drops
      await priceFeed.setPrice(dec(100, 18));
      const price = await priceFeed.getPrice();

      assert.isFalse(await troveManager.checkRecoveryMode(price));
      assert.isTrue(
        (await troveManager.getCurrentICR(aliceTroveId, price)).lt(toBN(dec(110, 16))),
      );

      const Boldwithdrawal = 1; // withdraw 1 wei Bold

      await assertRevert(
        borrowerOperations.withdrawBold(
          aliceTroveId,
          th._100pct,
          Boldwithdrawal,
          { from: alice },
        ),
        "BorrowerOps: An operation that would result in ICR < MCR is not permitted",
      );
    });

    it("withdrawBold(): reverts when calling address does not have active trove", async () => {
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: alice } });
      const { troveId: bobTroveId } = await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: bob } });

      // Bob successfully withdraws Bold
      const txBob = await borrowerOperations.withdrawBold(
        bobTroveId,
        th._100pct,
        dec(100, 18),
        { from: bob },
      );
      assert.isTrue(txBob.receipt.status);

      // Carol with no active trove attempts to withdraw Bold
      try {
        const txCarol = await borrowerOperations.withdrawBold(
          th.addressToTroveId(carol),
          th._100pct,
          dec(100, 18),
          { from: carol },
        );
        assert.isFalse(txCarol.receipt.status);
      } catch (err) {
        assert.include(err.message, "revert");
      }
    });

    it("withdrawBold(): reverts when requested withdrawal amount is zero Bold", async () => {
      const { troveId: aliceTroveId } = await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } });
      const { troveId: bobTroveId } = await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: bob } });

      // Bob successfully withdraws 1e-18 Bold
      const txBob = await borrowerOperations.withdrawBold(
        bobTroveId,
        th._100pct,
        1,
        { from: bob },
      );
      assert.isTrue(txBob.receipt.status);

      // Alice attempts to withdraw 0 Bold
      try {
        const txAlice = await borrowerOperations.withdrawBold(
          aliceTroveId,
          th._100pct,
          0,
          { from: alice },
        );
        assert.isFalse(txAlice.receipt.status);
      } catch (err) {
        assert.include(err.message, "revert");
      }
    });

    it("withdrawBold(): reverts when system is in Recovery Mode", async () => {
      const { troveId: aliceTroveId } = await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } });
      const { troveId: bobTroveId } = await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: bob } });
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: carol } });

      assert.isFalse(await th.checkRecoveryMode(contracts));

      // Withdrawal possible when recoveryMode == false
      const txAlice = await borrowerOperations.withdrawBold(
        aliceTroveId,
        th._100pct,
        dec(100, 18),
        { from: alice },
      );
      assert.isTrue(txAlice.receipt.status);

      await priceFeed.setPrice("50000000000000000000");

      assert.isTrue(await th.checkRecoveryMode(contracts));

      // Check Bold withdrawal impossible when recoveryMode == true
      try {
        const txBob = await borrowerOperations.withdrawBold(
          bobTroveId,
          th._100pct,
          1,
          { from: bob },
        );
        assert.isFalse(txBob.receipt.status);
      } catch (err) {
        assert.include(err.message, "revert");
      }
    });

    it("withdrawBold(): reverts when withdrawal would bring the trove's ICR < MCR", async () => {
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: alice } });
      const { troveId: bobTroveId } = await openTrove({ ICR: toBN(dec(11, 17)), extraParams: { from: bob } });

      // Bob tries to withdraw Bold that would bring his ICR < MCR
      try {
        const txBob = await borrowerOperations.withdrawBold(
          bobTroveId,
          th._100pct,
          1,
          { from: bob },
        );
        assert.isFalse(txBob.receipt.status);
      } catch (err) {
        assert.include(err.message, "revert");
      }
    });

    it("withdrawBold(): reverts when a withdrawal would cause the TCR of the system to fall below the CCR", async () => {
      await priceFeed.setPrice(dec(100, 18));
      const price = await priceFeed.getPrice();

      // Alice and Bob creates troves with 150% ICR.  System TCR = 150%.
      await openTrove({ ICR: toBN(dec(15, 17)), extraParams: { from: alice } });
      const { troveId: bobTroveId } = await openTrove({ ICR: toBN(dec(15, 17)), extraParams: { from: bob } });

      var TCR = (await th.getTCR(contracts)).toString();
      assert.equal(TCR, "1500000000000000000");

      // Bob attempts to withdraw 1 Bold.
      // System TCR would be: ((3+3) * 100 ) / (200+201) = 600/401 = 149.62%, i.e. below CCR of 150%.
      try {
        const txBob = await borrowerOperations.withdrawBold(
          bobTroveId,
          th._100pct,
          dec(1, 18),
          { from: bob },
        );
        assert.isFalse(txBob.receipt.status);
      } catch (err) {
        assert.include(err.message, "revert");
      }
    });

    it("withdrawBold(): reverts if system is in Recovery Mode", async () => {
      // --- SETUP ---
      const { troveId: aliceTroveId } = await openTrove({ ICR: toBN(dec(15, 17)), extraParams: { from: alice } });
      await openTrove({ ICR: toBN(dec(15, 17)), extraParams: { from: bob } });

      // --- TEST ---

      // price drops to 1ETH:150Bold, reducing TCR below 150%
      await priceFeed.setPrice("150000000000000000000");
      assert.isTrue((await th.getTCR(contracts)).lt(toBN(dec(15, 17))));

      try {
        const txData = await borrowerOperations.withdrawBold(
          aliceTroveId,
          th._100pct,
          "200",
          { from: alice },
        );
        assert.isFalse(txData.receipt.status);
      } catch (err) {
        assert.include(err.message, "revert");
      }
    });

    it("withdrawBold(): increases the Trove's Bold debt by the correct amount", async () => {
      const { troveId: aliceTroveId } = await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } });

      // check before
      const aliceDebtBefore = await getTroveEntireDebt(aliceTroveId);
      assert.isTrue(aliceDebtBefore.gt(toBN(0)));

      await borrowerOperations.withdrawBold(
        aliceTroveId,
        th._100pct,
        await getNetBorrowingAmount(100),
        { from: alice },
      );

      // check after
      const aliceDebtAfter = await getTroveEntireDebt(aliceTroveId);
      th.assertIsApproximatelyEqual(
        aliceDebtAfter,
        aliceDebtBefore.add(toBN(100)),
      );
    });

    it("withdrawBold(): increases Bold debt in ActivePool by correct amount", async () => {
      const { troveId: aliceTroveId } = await openTrove({
        ICR: toBN(dec(10, 18)),
        extraParams: { from: alice, value: toBN(dec(100, "ether")) },
      });

      const aliceDebtBefore = await getTroveEntireDebt(aliceTroveId);
      assert.isTrue(aliceDebtBefore.gt(toBN(0)));

      // check before
      const activePool_Bold_Before = await activePool.getTotalActiveDebt();
      assert.isTrue(activePool_Bold_Before.eq(aliceDebtBefore));

      await borrowerOperations.withdrawBold(
        aliceTroveId,
        th._100pct,
        await getNetBorrowingAmount(dec(10000, 18)),
        { from: alice },
      );

      // check after
      const activePool_Bold_After = await activePool.getTotalActiveDebt();
      th.assertIsApproximatelyEqual(
        activePool_Bold_After,
        activePool_Bold_Before.add(toBN(dec(10000, 18))),
      );
    });

    it("withdrawBold(): increases user BoldToken balance by correct amount", async () => {
      const { troveId: aliceTroveId } = await openTrove({
        extraParams: { value: toBN(dec(100, "ether")), from: alice },
      });

      // check before
      const alice_BoldTokenBalance_Before = await boldToken.balanceOf(alice);
      assert.isTrue(alice_BoldTokenBalance_Before.gt(toBN("0")));

      await borrowerOperations.withdrawBold(
        aliceTroveId,
        th._100pct,
        dec(10000, 18),
        { from: alice },
      );

      // check after
      const alice_BoldTokenBalance_After = await boldToken.balanceOf(alice);
      assert.isTrue(
        alice_BoldTokenBalance_After.eq(
          alice_BoldTokenBalance_Before.add(toBN(dec(10000, 18))),
        ),
      );
    });

    // --- repayBold() ---
    it("repayBold(): reverts when repayment would leave trove with ICR < MCR", async () => {
      // alice creates a Trove and adds first collateral
      const { troveId: aliceTroveId } = await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } });
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: bob } });

      // Price drops
      await priceFeed.setPrice(dec(100, 18));
      const price = await priceFeed.getPrice();

      assert.isFalse(await troveManager.checkRecoveryMode(price));
      assert.isTrue(
        (await troveManager.getCurrentICR(aliceTroveId, price)).lt(toBN(dec(110, 16))),
      );

      const BoldRepayment = 1; // 1 wei repayment

      await assertRevert(
        borrowerOperations.repayBold(aliceTroveId, BoldRepayment, {
          from: alice,
        }),
        "BorrowerOps: An operation that would result in ICR < MCR is not permitted",
      );
    });

    it("repayBold(): Succeeds when it would leave trove with net debt >= minimum net debt", async () => {
      // Make the Bold request 2 wei above min net debt to correct for floor division, and make net debt = min net debt + 1 wei
      const ATroveId = await th.openTroveWrapper(
        contracts,
        th._100pct,
        await getNetBorrowingAmount(MIN_NET_DEBT.add(toBN("2"))),
        A,
        A,
        0,
        { from: A, value: dec(100, 30) },
      );

      const repayTxA = await borrowerOperations.repayBold(ATroveId, 1, { from: A });
      assert.isTrue(repayTxA.receipt.status);

      const BTroveId = await th.openTroveWrapper(contracts, th._100pct, dec(20, 25), B, B, 0, {
        from: B,
        value: dec(100, 30),
      });

      const repayTxB = await borrowerOperations.repayBold(BTroveId, dec(19, 25), {
        from: B,
      });
      assert.isTrue(repayTxB.receipt.status);
    });

    it("repayBold(): reverts when it would leave trove with net debt < minimum net debt", async () => {
      // Open the trove with min debt + 1 wei
      const ATroveId = await th.openTroveWrapper(
        contracts,
        th._100pct,
        await getNetBorrowingAmount(MIN_NET_DEBT.add(toBN("1"))),
        A,
        A,
        0,
        { from: A, value: dec(100, 30) },
      );

      // Check Trove debt is 1 wei above min
      const debt = await troveManager.getTroveDebt(ATroveId);
      assert.isTrue(debt.eq(th.toBN(dec(2000, 18)).add(th.toBN("1"))));

      // Try to repay 2 wei to bring Trove debt to 1 wei below minimum, and expect revert
      const repayTxAPromise = borrowerOperations.repayBold(ATroveId, 2, {
        from: A,
      });
      await assertRevert(
        repayTxAPromise,
        "BorrowerOps: Trove's net debt must be greater than minimum",
      );
    });

    it("adjustTrove(): Reverts if repaid amount is greater than current debt", async () => {
      const { troveId: aliceTroveId, totalDebt } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: alice },
      });
      BOLD_GAS_COMPENSATION = await borrowerOperations.BOLD_GAS_COMPENSATION();
      const repayAmount = totalDebt.sub(BOLD_GAS_COMPENSATION).add(toBN(1));
      await openTrove({
        extraBoldAmount: repayAmount,
        ICR: toBN(dec(150, 16)),
        extraParams: { from: bob },
      });

      await boldToken.transfer(alice, repayAmount, { from: bob });

      await assertRevert(
        borrowerOperations.adjustTrove(
          aliceTroveId,
          th._100pct,
          0,
          false,
          repayAmount,
          false,
          { from: alice },
        ),
        "SafeMath: subtraction overflow",
      );
    });

    it("repayBold(): reverts when calling address does not have active trove", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });
      const { troveId: bobTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob },
      });
      // Bob successfully repays some Bold
      const txBob = await borrowerOperations.repayBold(bobTroveId, dec(10, 18), {
        from: bob,
      });
      assert.isTrue(txBob.receipt.status);

      // Carol with no active trove attempts to repayBold
      try {
        const txCarol = await borrowerOperations.repayBold(
          th.addressToTroveId(carol),
          dec(10, 18),
          { from: carol },
        );
        assert.isFalse(txCarol.receipt.status);
      } catch (err) {
        assert.include(err.message, "revert");
      }
    });

    it("repayBold(): reverts when attempted repayment is > the debt of the trove", async () => {
      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });
      const { troveId: bobTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob },
      });
      const aliceDebt = await getTroveEntireDebt(aliceTroveId);

      // Bob successfully repays some Bold
      const txBob = await borrowerOperations.repayBold(bobTroveId, dec(10, 18), {
        from: bob,
      });
      assert.isTrue(txBob.receipt.status);

      // Alice attempts to repay more than her debt
      try {
        const txAlice = await borrowerOperations.repayBold(
          aliceTroveId,
          aliceDebt.add(toBN(dec(1, 18))),
          { from: alice },
        );
        assert.isFalse(txAlice.receipt.status);
      } catch (err) {
        assert.include(err.message, "revert");
      }
    });

    // repayBold: reduces Bold debt in Trove
    it("repayBold(): reduces the Trove's Bold debt by the correct amount", async () => {
      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob },
      });
      const aliceDebtBefore = await getTroveEntireDebt(aliceTroveId);
      assert.isTrue(aliceDebtBefore.gt(toBN("0")));

      await borrowerOperations.repayBold(
        aliceTroveId,
        aliceDebtBefore.div(toBN(10)),
        { from: alice },
      ); // Repays 1/10 her debt

      const aliceDebtAfter = await getTroveEntireDebt(aliceTroveId);
      assert.isTrue(aliceDebtAfter.gt(toBN("0")));

      th.assertIsApproximatelyEqual(
        aliceDebtAfter,
        aliceDebtBefore.mul(toBN(9)).div(toBN(10)),
      ); // check 9/10 debt remaining
    });

    it("repayBold(): decreases Bold debt in ActivePool by correct amount", async () => {
      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob },
      });
      const aliceDebtBefore = await getTroveEntireDebt(aliceTroveId);
      assert.isTrue(aliceDebtBefore.gt(toBN("0")));

      // Check before
      const activePool_Bold_Before = await activePool.getTotalActiveDebt();
      assert.isTrue(activePool_Bold_Before.gt(toBN("0")));

      await borrowerOperations.repayBold(
        aliceTroveId,
        aliceDebtBefore.div(toBN(10)),
        { from: alice },
      ); // Repays 1/10 her debt

      // check after
      const activePool_Bold_After = await activePool.getTotalActiveDebt();
      th.assertIsApproximatelyEqual(
        activePool_Bold_After,
        activePool_Bold_Before.sub(aliceDebtBefore.div(toBN(10))),
      );
    });

    it("repayBold(): decreases user BoldToken balance by correct amount", async () => {
      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob },
      });
      const aliceDebtBefore = await getTroveEntireDebt(aliceTroveId);
      assert.isTrue(aliceDebtBefore.gt(toBN("0")));

      // check before
      const alice_BoldTokenBalance_Before = await boldToken.balanceOf(alice);
      assert.isTrue(alice_BoldTokenBalance_Before.gt(toBN("0")));

      await borrowerOperations.repayBold(
        aliceTroveId,
        aliceDebtBefore.div(toBN(10)),
        { from: alice },
      ); // Repays 1/10 her debt

      // check after
      const alice_BoldTokenBalance_After = await boldToken.balanceOf(alice);
      th.assertIsApproximatelyEqual(
        alice_BoldTokenBalance_After,
        alice_BoldTokenBalance_Before.sub(aliceDebtBefore.div(toBN(10))),
      );
    });

    it("repayBold(): can repay debt in Recovery Mode", async () => {
      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob },
      });
      const aliceDebtBefore = await getTroveEntireDebt(aliceTroveId);
      assert.isTrue(aliceDebtBefore.gt(toBN("0")));

      assert.isFalse(await th.checkRecoveryMode(contracts));

      await priceFeed.setPrice("105000000000000000000");

      assert.isTrue(await th.checkRecoveryMode(contracts));

      const tx = await borrowerOperations.repayBold(
        aliceTroveId,
        aliceDebtBefore.div(toBN(10)),
        { from: alice },
      );
      assert.isTrue(tx.receipt.status);

      // Check Alice's debt: 110 (initial) - 50 (repaid)
      const aliceDebtAfter = await getTroveEntireDebt(aliceTroveId);
      th.assertIsApproximatelyEqual(
        aliceDebtAfter,
        aliceDebtBefore.mul(toBN(9)).div(toBN(10)),
      );
    });

    it("repayBold(): Reverts if borrower has insufficient Bold balance to cover his debt repayment", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });
      const { troveId: BTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: B },
      });
      const bobBalBefore = await boldToken.balanceOf(B);
      assert.isTrue(bobBalBefore.gt(toBN("0")));

      // Bob transfers all but 5 of his Bold to Carol
      await boldToken.transfer(C, bobBalBefore.sub(toBN(dec(5, 18))), {
        from: B,
      });

      // Confirm B's Bold balance has decreased to 5 Bold
      const bobBalAfter = await boldToken.balanceOf(B);

      assert.isTrue(bobBalAfter.eq(toBN(dec(5, 18))));

      // Bob tries to repay 6 Bold
      const repayBoldPromise_B = borrowerOperations.repayBold(BTroveId, toBN(dec(6, 18)), { from: B });

      await assertRevert(
        repayBoldPromise_B,
        "Caller doesnt have enough Bold to make repayment",
      );
    });

    // --- adjustTrove() ---

    it("adjustTrove(): reverts when adjustment would leave trove with ICR < MCR", async () => {
      // alice creates a Trove and adds first collateral
      const { troveId: aliceTroveId } = await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } });
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: bob } });

      // Price drops
      await priceFeed.setPrice(dec(100, 18));
      const price = await priceFeed.getPrice();

      assert.isFalse(await troveManager.checkRecoveryMode(price));
      assert.isTrue(
        (await troveManager.getCurrentICR(aliceTroveId, price)).lt(toBN(dec(110, 16))),
      );

      const BoldRepayment = 1; // 1 wei repayment
      const collTopUp = 1;

      // approve ERC20 ETH
      await contracts.WETH.approve(borrowerOperations.address, collTopUp, { from: alice });
      await assertRevert(
        borrowerOperations.adjustTrove(
          aliceTroveId,
          th._100pct,
          collTopUp,
          true,
          BoldRepayment,
          false,
          { from: alice },
        ),
        "BorrowerOps: An operation that would result in ICR < MCR is not permitted",
      );
    });

    it("adjustTrove(): reverts when calling address has no active trove", async () => {
      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob },
      });

      // approve ERC20 ETH
      await contracts.WETH.approve(borrowerOperations.address, dec(1, 24), { from: alice });
      // Alice coll and debt increase(+1 ETH, +50Bold)
      await borrowerOperations.adjustTrove(
        aliceTroveId,
        th._100pct,
        dec(1, "ether"),
        true,
        dec(50, 18),
        true,
        { from: alice },
      );

      try {
        // approve ERC20 ETH
        await contracts.WETH.approve(borrowerOperations.address, dec(1, 24), { from: carol });
        const txCarol = await borrowerOperations.adjustTrove(
          th.addressToTroveId(carol),
          th._100pct,
          dec(1, "ether"),
          true,
          dec(50, 18),
          true,
          { from: carol },
        );
        assert.isFalse(txCarol.receipt.status);
      } catch (err) {
        assert.include(err.message, "revert");
      }
    });

    it("adjustTrove(): reverts in Recovery Mode when the adjustment would reduce the TCR", async () => {
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

      assert.isFalse(await th.checkRecoveryMode(contracts));

      // approve ERC20 ETH
      await contracts.WETH.approve(borrowerOperations.address, dec(1, 24), { from: alice });
      const txAlice = await borrowerOperations.adjustTrove(
        aliceTroveId,
        th._100pct,
        dec(1, "ether"),
        true,
        dec(50, 18),
        true,
        { from: alice },
      );
      assert.isTrue(txAlice.receipt.status);

      await priceFeed.setPrice(dec(120, 18)); // trigger drop in ETH price

      assert.isTrue(await th.checkRecoveryMode(contracts));

      try {
        // collateral withdrawal should also fail
        const txAlice = await borrowerOperations.adjustTrove(
          aliceTroveId,
          th._100pct,
          dec(1, "ether"),
          false,
          0,
          false,
          { from: alice },
        );
        assert.isFalse(txAlice.receipt.status);
      } catch (err) {
        assert.include(err.message, "revert");
      }

      try {
        // debt increase should fail
        const txBob = await borrowerOperations.adjustTrove(
          bobTroveId,
          th._100pct,
          0,
          false,
          dec(50, 18),
          true,
          { from: bob },
        );
        assert.isFalse(txBob.receipt.status);
      } catch (err) {
        assert.include(err.message, "revert");
      }

      try {
        // debt increase that's also a collateral increase should also fail, if ICR will be worse off
        // approve ERC20 ETH
        await contracts.WETH.approve(borrowerOperations.address, dec(1, 24), { from: bob });
        const txBob = await borrowerOperations.adjustTrove(
          bobTroveId,
          th._100pct,
          dec(1, "ether"),
          true,
          dec(111, 18),
          true,
          { from: bob },
        );
        assert.isFalse(txBob.receipt.status);
      } catch (err) {
        assert.include(err.message, "revert");
      }
    });

    it("adjustTrove(): collateral withdrawal reverts in Recovery Mode", async () => {
      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob },
      });

      assert.isFalse(await th.checkRecoveryMode(contracts));

      await priceFeed.setPrice(dec(120, 18)); // trigger drop in ETH price

      assert.isTrue(await th.checkRecoveryMode(contracts));

      // Alice attempts an adjustment that repays half her debt BUT withdraws 1 wei collateral, and fails
      await assertRevert(
        borrowerOperations.adjustTrove(
          aliceTroveId,
          th._100pct,
          1,
          false,
          dec(5000, 18),
          false,
          { from: alice },
        ),
        "BorrowerOps: Collateral withdrawal not permitted Recovery Mode",
      );
    });

    it("adjustTrove(): debt increase that would leave ICR < 150% reverts in Recovery Mode", async () => {
      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob },
      });
      const CCR = await troveManager.CCR();

      assert.isFalse(await th.checkRecoveryMode(contracts));

      await priceFeed.setPrice(dec(120, 18)); // trigger drop in ETH price
      const price = await priceFeed.getPrice();

      assert.isTrue(await th.checkRecoveryMode(contracts));

      const ICR_A = await troveManager.getCurrentICR(aliceTroveId, price);

      const aliceDebt = await getTroveEntireDebt(aliceTroveId);
      const aliceColl = await getTroveEntireColl(aliceTroveId);
      const debtIncrease = toBN(dec(50, 18));
      const collIncrease = toBN(dec(1, "ether"));

      // Check the new ICR would be an improvement, but less than the CCR (150%)
      const newICR = await troveManager.computeICR(
        aliceColl.add(collIncrease),
        aliceDebt.add(debtIncrease),
        price,
      );

      assert.isTrue(newICR.gt(ICR_A) && newICR.lt(CCR));

      // approve ERC20 ETH
      await contracts.WETH.approve(borrowerOperations.address, dec(1, 24), { from: alice });
      await assertRevert(
        borrowerOperations.adjustTrove(
          aliceTroveId,
          th._100pct,
          collIncrease,
          true,
          debtIncrease,
          true,
          { from: alice },
        ),
        "BorrowerOps: Operation must leave trove with ICR >= CCR",
      );
    });

    it("adjustTrove(): debt increase that would reduce the ICR reverts in Recovery Mode", async () => {
      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(3, 18)),
        extraParams: { from: alice },
      });
      const { troveId: bobTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob },
      });
      const CCR = await troveManager.CCR();

      assert.isFalse(await th.checkRecoveryMode(contracts));

      await priceFeed.setPrice(dec(105, 18)); // trigger drop in ETH price
      const price = await priceFeed.getPrice();

      assert.isTrue(await th.checkRecoveryMode(contracts));

      // --- Alice with ICR > 150% tries to reduce her ICR ---

      const ICR_A = await troveManager.getCurrentICR(aliceTroveId, price);

      // Check Alice's initial ICR is above 150%
      assert.isTrue(ICR_A.gt(CCR));

      const aliceDebt = await getTroveEntireDebt(aliceTroveId);
      const aliceColl = await getTroveEntireColl(aliceTroveId);
      const aliceDebtIncrease = toBN(dec(150, 18));
      const aliceCollIncrease = toBN(dec(1, "ether"));

      const newICR_A = await troveManager.computeICR(
        aliceColl.add(aliceCollIncrease),
        aliceDebt.add(aliceDebtIncrease),
        price,
      );

      // Check Alice's new ICR would reduce but still be greater than 150%
      assert.isTrue(newICR_A.lt(ICR_A) && newICR_A.gt(CCR));

      // approve ERC20 ETH
      await contracts.WETH.approve(borrowerOperations.address, dec(1, 24), { from: alice });
      await assertRevert(
        borrowerOperations.adjustTrove(
          aliceTroveId,
          th._100pct,
          aliceCollIncrease,
          true,
          aliceDebtIncrease,
          true,
          { from: alice },
        ),
        "BorrowerOps: Cannot decrease your Trove's ICR in Recovery Mode",
      );

      // --- Bob with ICR < 150% tries to reduce his ICR ---

      const ICR_B = await troveManager.getCurrentICR(bobTroveId, price);

      // Check Bob's initial ICR is below 150%
      assert.isTrue(ICR_B.lt(CCR));

      const bobDebt = await getTroveEntireDebt(bobTroveId);
      const bobColl = await getTroveEntireColl(bobTroveId);
      const bobDebtIncrease = toBN(dec(450, 18));
      const bobCollIncrease = toBN(dec(1, "ether"));

      const newICR_B = await troveManager.computeICR(
        bobColl.add(bobCollIncrease),
        bobDebt.add(bobDebtIncrease),
        price,
      );

      // Check Bob's new ICR would reduce
      assert.isTrue(newICR_B.lt(ICR_B));

      // approve ERC20 ETH
      await contracts.WETH.approve(borrowerOperations.address, dec(1, 24), { from: bob });
      await assertRevert(
        borrowerOperations.adjustTrove(
          bobTroveId,
          th._100pct,
          bobCollIncrease,
          true,
          bobDebtIncrease,
          true,
          { from: bob },
        ),
        " BorrowerOps: Operation must leave trove with ICR >= CCR",
      );
    });

    it("adjustTrove(): A trove with ICR < CCR in Recovery Mode can adjust their trove to ICR > CCR", async () => {
      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob },
      });
      const CCR = await troveManager.CCR();

      assert.isFalse(await th.checkRecoveryMode(contracts));

      await priceFeed.setPrice(dec(100, 18)); // trigger drop in ETH price
      const price = await priceFeed.getPrice();

      assert.isTrue(await th.checkRecoveryMode(contracts));

      const ICR_A = await troveManager.getCurrentICR(aliceTroveId, price);
      // Check initial ICR is below 150%
      assert.isTrue(ICR_A.lt(CCR));

      const aliceDebt = await getTroveEntireDebt(aliceTroveId);
      const aliceColl = await getTroveEntireColl(aliceTroveId);
      const debtIncrease = toBN(dec(5000, 18));
      const collIncrease = toBN(dec(150, "ether"));

      const newICR = await troveManager.computeICR(
        aliceColl.add(collIncrease),
        aliceDebt.add(debtIncrease),
        price,
      );

      // Check new ICR would be > 150%
      assert.isTrue(newICR.gt(CCR));

      // approve ERC20 ETH
      await contracts.WETH.approve(borrowerOperations.address, dec(1, 24), { from: alice });
      const tx = await borrowerOperations.adjustTrove(
        aliceTroveId,
        th._100pct,
        collIncrease,
        true,
        debtIncrease,
        true,
        { from: alice },
      );
      assert.isTrue(tx.receipt.status);

      const actualNewICR = await troveManager.getCurrentICR(aliceTroveId, price);
      assert.isTrue(actualNewICR.gt(CCR));
    });

    it("adjustTrove(): A trove with ICR > CCR in Recovery Mode can improve their ICR", async () => {
      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(3, 18)),
        extraParams: { from: alice },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob },
      });
      const CCR = await troveManager.CCR();

      assert.isFalse(await th.checkRecoveryMode(contracts));

      await priceFeed.setPrice(dec(105, 18)); // trigger drop in ETH price
      const price = await priceFeed.getPrice();

      assert.isTrue(await th.checkRecoveryMode(contracts));

      const initialICR = await troveManager.getCurrentICR(aliceTroveId, price);
      // Check initial ICR is above 150%
      assert.isTrue(initialICR.gt(CCR));

      const aliceDebt = await getTroveEntireDebt(aliceTroveId);
      const aliceColl = await getTroveEntireColl(aliceTroveId);
      const debtIncrease = toBN(dec(5000, 18));
      const collIncrease = toBN(dec(150, "ether"));

      const newICR = await troveManager.computeICR(
        aliceColl.add(collIncrease),
        aliceDebt.add(debtIncrease),
        price,
      );

      // Check new ICR would be > old ICR
      assert.isTrue(newICR.gt(initialICR));

      // approve ERC20 ETH
      await contracts.WETH.approve(borrowerOperations.address, dec(1, 24), { from: alice });
      const tx = await borrowerOperations.adjustTrove(
        aliceTroveId,
        th._100pct,
        collIncrease,
        true,
        debtIncrease,
        true,
        { from: alice },
      );
      assert.isTrue(tx.receipt.status);

      const actualNewICR = await troveManager.getCurrentICR(aliceTroveId, price);
      assert.isTrue(actualNewICR.gt(initialICR));
    });

    it("adjustTrove(): reverts when change would cause the TCR of the system to fall below the CCR", async () => {
      await priceFeed.setPrice(dec(100, 18));

      await openTrove({ ICR: toBN(dec(15, 17)), extraParams: { from: alice } });
      const { troveId: bobTroveId } = await openTrove({ ICR: toBN(dec(15, 17)), extraParams: { from: bob } });

      // Check TCR and Recovery Mode
      const TCR = (await th.getTCR(contracts)).toString();
      assert.equal(TCR, "1500000000000000000");
      assert.isFalse(await th.checkRecoveryMode(contracts));

      // Bob attempts an operation that would bring the TCR below the CCR
      try {
        const txBob = await borrowerOperations.adjustTrove(
          bobTroveId,
          th._100pct,
          0,
          false,
          dec(1, 18),
          true,
          { from: bob },
        );
        assert.isFalse(txBob.receipt.status);
      } catch (err) {
        assert.include(err.message, "revert");
      }
    });

    it("adjustTrove(): reverts when Bold repaid is > debt of the trove", async () => {
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } });
      const { troveId: bobTroveId } = await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: bob } });

      const bobDebt = await getTroveEntireDebt(bobTroveId);
      assert.isTrue(bobDebt.gt(toBN("0")));

      // Alice transfers 1 Bold to bob
      await boldToken.transfer(bob, th.toBN(dec(1, 18)), { from: alice });

      const remainingDebt = (await troveManager.getTroveDebt(bobTroveId)).sub(
        BOLD_GAS_COMPENSATION,
      );

      // Bob attempts an adjustment that would repay 1 wei more than his debt
      // approve ERC20 ETH
      await contracts.WETH.approve(borrowerOperations.address, dec(1, 24), { from: bob });
      await assertRevert(
        borrowerOperations.adjustTrove(
          bobTroveId,
          th._100pct,
          dec(1, "ether"),
          true,
          remainingDebt.add(toBN(1)),
          false,
          { from: bob },
        ),
        "revert",
      );
    });

    it("adjustTrove(): reverts when attempted ETH withdrawal is >= the trove's collateral", async () => {
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } });
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: bob } });
      const { troveId: carolTroveId } = await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: carol } });

      const carolColl = await getTroveEntireColl(carolTroveId);

      // Carol attempts an adjustment that would withdraw 1 wei more than her ETH
      try {
        const txCarol = await borrowerOperations.adjustTrove(
          carolTroveId,
          th._100pct,
          carolColl.add(toBN(1)),
          false,
          0,
          true,
          { from: carol },
        );
        assert.isFalse(txCarol.receipt.status);
      } catch (err) {
        assert.include(err.message, "revert");
      }
    });

    it("adjustTrove(): reverts when change would cause the ICR of the trove to fall below the MCR", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(100, 18)),
        extraParams: { from: whale },
      });

      await priceFeed.setPrice(dec(100, 18));

      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(11, 17)),
        extraParams: { from: alice },
      });
      const { troveId: bobTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(11, 17)),
        extraParams: { from: bob },
      });

      // Bob attempts to increase debt by 100 Bold and 1 ether, i.e. a change that constitutes a 100% ratio of coll:debt.
      // Since his ICR prior is 110%, this change would reduce his ICR below MCR.
      try {
        // approve ERC20 ETH
        await contracts.WETH.approve(borrowerOperations.address, dec(1, 24), { from: bob });
        const txBob = await borrowerOperations.adjustTrove(
          bobTroveId,
          th._100pct,
          dec(1, "ether"),
          true,
          dec(100, 18),
          true,
          { from: bob },
        );
        assert.isFalse(txBob.receipt.status);
      } catch (err) {
        assert.include(err.message, "revert");
      }
    });

    it("adjustTrove(): With 0 coll change, doesnt change borrower's coll or ActivePool coll", async () => {
      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });

      const aliceCollBefore = await getTroveEntireColl(aliceTroveId);
      const activePoolCollBefore = await activePool.getETHBalance();

      assert.isTrue(aliceCollBefore.gt(toBN("0")));
      assert.isTrue(aliceCollBefore.eq(activePoolCollBefore));

      // Alice adjusts trove. No coll change, and a debt increase (+50Bold)
      await borrowerOperations.adjustTrove(
        aliceTroveId,
        th._100pct,
        0,
        false,
        dec(50, 18),
        true,
        { from: alice },
      );

      const aliceCollAfter = await getTroveEntireColl(aliceTroveId);
      const activePoolCollAfter = await activePool.getETHBalance();

      assert.isTrue(aliceCollAfter.eq(activePoolCollAfter));
      assert.isTrue(activePoolCollAfter.eq(activePoolCollAfter));
    });

    it("adjustTrove(): With 0 debt change, doesnt change borrower's debt or ActivePool debt", async () => {
      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });

      const aliceDebtBefore = await getTroveEntireDebt(aliceTroveId);
      const activePoolDebtBefore = await activePool.getTotalActiveDebt();

      assert.isTrue(aliceDebtBefore.gt(toBN("0")));
      assert.isTrue(aliceDebtBefore.eq(activePoolDebtBefore));

      // Alice adjusts trove. Coll change, no debt change
      // approve ERC20 ETH
      await contracts.WETH.approve(borrowerOperations.address, dec(1, 24), { from: alice });
      await borrowerOperations.adjustTrove(
        aliceTroveId,
        th._100pct,
        dec(1, "ether"),
        true,
        0,
        false,
        { from: alice },
      );

      const aliceDebtAfter = await getTroveEntireDebt(aliceTroveId);
      const activePoolDebtAfter = await activePool.getTotalActiveDebt();

      assert.isTrue(aliceDebtAfter.eq(aliceDebtBefore));
      assert.isTrue(activePoolDebtAfter.eq(activePoolDebtBefore));
    });

    it("adjustTrove(): updates borrower's debt and coll with an increase in both", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale },
      });

      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: alice },
      });

      const debtBefore = await getTroveEntireDebt(aliceTroveId);
      const collBefore = await getTroveEntireColl(aliceTroveId);
      assert.isTrue(debtBefore.gt(toBN("0")));
      assert.isTrue(collBefore.gt(toBN("0")));

      // Alice adjusts trove. Coll and debt increase(+1 ETH, +50Bold)
      // approve ERC20 ETH
      await contracts.WETH.approve(borrowerOperations.address, dec(1, 24), { from: alice });
      await borrowerOperations.adjustTrove(
        aliceTroveId,
        th._100pct,
        dec(1, "ether"),
        true,
        await getNetBorrowingAmount(dec(50, 18)),
        true,
        { from: alice },
      );

      const debtAfter = await getTroveEntireDebt(aliceTroveId);
      const collAfter = await getTroveEntireColl(aliceTroveId);

      th.assertIsApproximatelyEqual(
        debtAfter,
        debtBefore.add(toBN(dec(50, 18))),
        10000,
      );
      th.assertIsApproximatelyEqual(
        collAfter,
        collBefore.add(toBN(dec(1, 18))),
        10000,
      );
    });

    it("adjustTrove(): updates borrower's debt and coll with a decrease in both", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale },
      });

      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: alice },
      });

      const debtBefore = await getTroveEntireDebt(aliceTroveId);
      const collBefore = await getTroveEntireColl(aliceTroveId);
      assert.isTrue(debtBefore.gt(toBN("0")));
      assert.isTrue(collBefore.gt(toBN("0")));

      // Alice adjusts trove coll and debt decrease (-0.5 ETH, -50Bold)
      await borrowerOperations.adjustTrove(
        aliceTroveId,
        th._100pct,
        dec(500, "finney"),
        false,
        dec(50, 18),
        false,
        { from: alice },
      );

      const debtAfter = await getTroveEntireDebt(aliceTroveId);
      const collAfter = await getTroveEntireColl(aliceTroveId);

      assert.isTrue(debtAfter.eq(debtBefore.sub(toBN(dec(50, 18)))));
      assert.isTrue(collAfter.eq(collBefore.sub(toBN(dec(5, 17)))));
    });

    it("adjustTrove(): updates borrower's  debt and coll with coll increase, debt decrease", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale },
      });

      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: alice },
      });

      const debtBefore = await getTroveEntireDebt(aliceTroveId);
      const collBefore = await getTroveEntireColl(aliceTroveId);
      assert.isTrue(debtBefore.gt(toBN("0")));
      assert.isTrue(collBefore.gt(toBN("0")));

      // Alice adjusts trove - coll increase and debt decrease (+0.5 ETH, -50Bold)
      // approve ERC20 ETH
      await contracts.WETH.approve(borrowerOperations.address, dec(1, 24), { from: alice });
      await borrowerOperations.adjustTrove(
        aliceTroveId,
        th._100pct,
        dec(500, "finney"),
        true,
        dec(50, 18),
        false,
        { from: alice },
      );

      const debtAfter = await getTroveEntireDebt(aliceTroveId);
      const collAfter = await getTroveEntireColl(aliceTroveId);

      th.assertIsApproximatelyEqual(
        debtAfter,
        debtBefore.sub(toBN(dec(50, 18))),
        10000,
      );
      th.assertIsApproximatelyEqual(
        collAfter,
        collBefore.add(toBN(dec(5, 17))),
        10000,
      );
    });

    it("adjustTrove(): updates borrower's debt and coll with coll decrease, debt increase", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale },
      });

      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: alice },
      });

      const debtBefore = await getTroveEntireDebt(aliceTroveId);
      const collBefore = await getTroveEntireColl(aliceTroveId);
      assert.isTrue(debtBefore.gt(toBN("0")));
      assert.isTrue(collBefore.gt(toBN("0")));

      // Alice adjusts trove - coll decrease and debt increase (0.1 ETH, 10Bold)
      await borrowerOperations.adjustTrove(
        aliceTroveId,
        th._100pct,
        dec(1, 17),
        false,
        await getNetBorrowingAmount(dec(1, 18)),
        true,
        { from: alice },
      );

      const debtAfter = await getTroveEntireDebt(aliceTroveId);
      const collAfter = await getTroveEntireColl(aliceTroveId);

      th.assertIsApproximatelyEqual(
        debtAfter,
        debtBefore.add(toBN(dec(1, 18))),
        10000,
      );
      th.assertIsApproximatelyEqual(
        collAfter,
        collBefore.sub(toBN(dec(1, 17))),
        10000,
      );
    });

    it("adjustTrove(): updates borrower's stake and totalStakes with a coll increase", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale },
      });

      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: alice },
      });

      const stakeBefore = await troveManager.getTroveStake(aliceTroveId);
      const totalStakesBefore = await troveManager.totalStakes();
      assert.isTrue(stakeBefore.gt(toBN("0")));
      assert.isTrue(totalStakesBefore.gt(toBN("0")));

      // Alice adjusts trove - coll and debt increase (+1 ETH, +50 Bold)
      // approve ERC20 ETH
      await contracts.WETH.approve(borrowerOperations.address, dec(1, 24), { from: alice });
      await borrowerOperations.adjustTrove(
        aliceTroveId,
        th._100pct,
        dec(1, "ether"),
        true,
        dec(50, 18),
        true,
        { from: alice },
      );

      const stakeAfter = await troveManager.getTroveStake(aliceTroveId);
      const totalStakesAfter = await troveManager.totalStakes();

      assert.isTrue(stakeAfter.eq(stakeBefore.add(toBN(dec(1, 18)))));
      assert.isTrue(
        totalStakesAfter.eq(totalStakesBefore.add(toBN(dec(1, 18)))),
      );
    });

    it("adjustTrove(): updates borrower's stake and totalStakes with a coll decrease", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale },
      });

      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: alice },
      });

      const stakeBefore = await troveManager.getTroveStake(aliceTroveId);
      const totalStakesBefore = await troveManager.totalStakes();
      assert.isTrue(stakeBefore.gt(toBN("0")));
      assert.isTrue(totalStakesBefore.gt(toBN("0")));

      // Alice adjusts trove - coll decrease and debt decrease
      await borrowerOperations.adjustTrove(
        aliceTroveId,
        th._100pct,
        dec(500, "finney"),
        false,
        dec(50, 18),
        false,
        { from: alice },
      );

      const stakeAfter = await troveManager.getTroveStake(aliceTroveId);
      const totalStakesAfter = await troveManager.totalStakes();

      assert.isTrue(stakeAfter.eq(stakeBefore.sub(toBN(dec(5, 17)))));
      assert.isTrue(
        totalStakesAfter.eq(totalStakesBefore.sub(toBN(dec(5, 17)))),
      );
    });

    it("adjustTrove(): changes BoldToken balance by the requested decrease", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale },
      });

      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: alice },
      });

      const alice_BoldTokenBalance_Before = await boldToken.balanceOf(alice);
      assert.isTrue(alice_BoldTokenBalance_Before.gt(toBN("0")));

      // Alice adjusts trove - coll decrease and debt decrease
      await borrowerOperations.adjustTrove(
        aliceTroveId,
        th._100pct,
        dec(100, "finney"),
        false,
        dec(10, 18),
        false,
        { from: alice },
      );

      // check after
      const alice_BoldTokenBalance_After = await boldToken.balanceOf(alice);
      assert.isTrue(
        alice_BoldTokenBalance_After.eq(
          alice_BoldTokenBalance_Before.sub(toBN(dec(10, 18))),
        ),
      );
    });

    it("adjustTrove(): changes BoldToken balance by the requested increase", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale },
      });

      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: alice },
      });

      const alice_BoldTokenBalance_Before = await boldToken.balanceOf(alice);
      assert.isTrue(alice_BoldTokenBalance_Before.gt(toBN("0")));

      // Alice adjusts trove - coll increase and debt increase
      // approve ERC20 ETH
      await contracts.WETH.approve(borrowerOperations.address, dec(1, 24), { from: alice });
      await borrowerOperations.adjustTrove(
        aliceTroveId,
        th._100pct,
        dec(1, "ether"),
        true,
        dec(100, 18),
        true,
        { from: alice },
      );

      // check after
      const alice_BoldTokenBalance_After = await boldToken.balanceOf(alice);
      assert.isTrue(
        alice_BoldTokenBalance_After.eq(
          alice_BoldTokenBalance_Before.add(toBN(dec(100, 18))),
        ),
      );
    });

    it("adjustTrove(): Changes the activePool ETH and raw ether balance by the requested decrease", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale },
      });

      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: alice },
      });

      const activePool_ETH_Before = await activePool.getETHBalance();
      const activePool_RawEther_Before = toBN(
        await contracts.WETH.balanceOf(activePool.address),
      );
      assert.isTrue(activePool_ETH_Before.gt(toBN("0")));
      assert.isTrue(activePool_RawEther_Before.gt(toBN("0")));

      // Alice adjusts trove - coll decrease and debt decrease
      await borrowerOperations.adjustTrove(
        aliceTroveId,
        th._100pct,
        dec(100, "finney"),
        false,
        dec(10, 18),
        false,
        { from: alice },
      );

      const activePool_ETH_After = await activePool.getETHBalance();
      const activePool_RawEther_After = toBN(
        await contracts.WETH.balanceOf(activePool.address),
      );
      assert.isTrue(
        activePool_ETH_After.eq(activePool_ETH_Before.sub(toBN(dec(1, 17)))),
      );
      assert.isTrue(
        activePool_RawEther_After.eq(
          activePool_ETH_Before.sub(toBN(dec(1, 17))),
        ),
      );
    });

    it("adjustTrove(): Changes the activePool ETH and raw ether balance by the amount of ETH sent", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale },
      });

      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: alice },
      });

      const activePool_ETH_Before = await activePool.getETHBalance();
      const activePool_RawEther_Before = toBN(
        await contracts.WETH.balanceOf(activePool.address),
      );
      assert.isTrue(activePool_ETH_Before.gt(toBN("0")));
      assert.isTrue(activePool_RawEther_Before.gt(toBN("0")));

      // Alice adjusts trove - coll increase and debt increase
      // approve ERC20 ETH
      await contracts.WETH.approve(borrowerOperations.address, dec(1, 24), { from: alice });
      await borrowerOperations.adjustTrove(
        aliceTroveId,
        th._100pct,
        dec(1, "ether"),
        true,
        dec(100, 18),
        true,
        { from: alice },
      );

      const activePool_ETH_After = await activePool.getETHBalance();
      const activePool_RawEther_After = toBN(
        await contracts.WETH.balanceOf(activePool.address),
      );
      assert.isTrue(
        activePool_ETH_After.eq(activePool_ETH_Before.add(toBN(dec(1, 18)))),
      );
      assert.isTrue(
        activePool_RawEther_After.eq(
          activePool_ETH_Before.add(toBN(dec(1, 18))),
        ),
      );
    });

    it("adjustTrove(): Changes the Bold debt in ActivePool by requested decrease", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale },
      });

      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: alice },
      });

      const activePool_BoldDebt_Before = await activePool.getTotalActiveDebt();
      assert.isTrue(activePool_BoldDebt_Before.gt(toBN("0")));

      // Alice adjusts trove - coll increase and debt decrease
      // approve ERC20 ETH
      await contracts.WETH.approve(borrowerOperations.address, dec(1, 24), { from: alice });
      await borrowerOperations.adjustTrove(
        aliceTroveId,
        th._100pct,
        dec(1, "ether"),
        true,
        dec(30, 18),
        false,
        { from: alice },
      );

      const activePool_BoldDebt_After = await activePool.getTotalActiveDebt();
      assert.isTrue(
        activePool_BoldDebt_After.eq(
          activePool_BoldDebt_Before.sub(toBN(dec(30, 18))),
        ),
      );
    });

    it("adjustTrove(): Changes the Bold debt in ActivePool by requested increase", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale },
      });
      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: alice },
      });

      const activePool_BoldDebt_Before = await activePool.getTotalActiveDebt();
      assert.isTrue(activePool_BoldDebt_Before.gt(toBN("0")));

      // Alice adjusts trove - coll increase and debt increase
      // approve ERC20 ETH
      await contracts.WETH.approve(borrowerOperations.address, dec(1, 24), { from: alice });
      await borrowerOperations.adjustTrove(
        aliceTroveId,
        th._100pct,
        dec(1, "ether"),
        true,
        await getNetBorrowingAmount(dec(100, 18)),
        true,
        { from: alice },
      );

      const activePool_BoldDebt_After = await activePool.getTotalActiveDebt();

      th.assertIsApproximatelyEqual(
        activePool_BoldDebt_After,
        activePool_BoldDebt_Before.add(toBN(dec(100, 18))),
      );
    });

    it("adjustTrove(): new coll = 0 and new debt = 0 is not allowed, as gas compensation still counts toward ICR", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale },
      });

      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: alice },
      });
      const aliceColl = await getTroveEntireColl(aliceTroveId);
      const aliceDebt = await getTroveEntireColl(aliceTroveId);
      const status_Before = await troveManager.getTroveStatus(aliceTroveId);
      const isInSortedList_Before = await sortedTroves.contains(aliceTroveId);

      assert.equal(status_Before, 1); // 1: Active
      assert.isTrue(isInSortedList_Before);

      await assertRevert(
        borrowerOperations.adjustTrove(
          aliceTroveId,
          th._100pct,
          aliceColl,
          false,
          aliceDebt,
          true,
          { from: alice },
        ),
        "BorrowerOps: An operation that would result in ICR < MCR is not permitted",
      );
    });

    it("adjustTrove(): Reverts if requested debt increase and amount is zero", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale },
      });
      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: alice },
      });

      await assertRevert(
        borrowerOperations.adjustTrove(aliceTroveId, th._100pct, 0, false, 0, true, {
          from: alice,
        }),
        "BorrowerOps: Debt increase requires non-zero debtChange",
      );
    });

    it("adjustTrove(): Reverts if it’s zero adjustment", async () => {
      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: alice },
      });

      await assertRevert(
        borrowerOperations.adjustTrove(aliceTroveId, th._100pct, 0, false, 0, false, {
          from: alice,
        }),
        "BorrowerOps: There must be either a collateral change or a debt change",
      );
    });

    it("adjustTrove(): Reverts if requested coll withdrawal is greater than trove's collateral", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale },
      });
      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: alice },
      });

      const aliceColl = await getTroveEntireColl(aliceTroveId);

      // Requested coll withdrawal > coll in the trove
      await assertRevert(
        borrowerOperations.adjustTrove(
          aliceTroveId,
          th._100pct,
          aliceColl.add(toBN(1)),
          false,
          0,
          false,
          { from: alice },
        ),
      );
      await assertRevert(
        borrowerOperations.adjustTrove(
          aliceTroveId,
          th._100pct,
          aliceColl.add(toBN(dec(37, "ether"))),
          false,
          0,
          false,
          { from: alice },
        ),
      );
    });

    it("adjustTrove(): Reverts if borrower has insufficient Bold balance to cover his debt repayment", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale },
      });
      const { troveId: BTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: B },
      });
      const bobDebt = await getTroveEntireDebt(BTroveId);

      // Bob transfers some Bold to carol
      await boldToken.transfer(C, dec(10, 18), { from: B });

      // Confirm B's Bold balance is less than 50 Bold
      const B_BoldBal = await boldToken.balanceOf(B);
      assert.isTrue(B_BoldBal.lt(bobDebt));

      const repayBoldPromise_B = borrowerOperations.adjustTrove(
        BTroveId,
        th._100pct,
        0,
        false,
        bobDebt,
        false,
        { from: B },
      );

      // B attempts to repay all his debt
      await assertRevert(repayBoldPromise_B, "revert");
    });

    // --- Internal _adjustTrove() ---

    // no need to test this with proxies
    it("Internal _adjustTrove(): reverts when op is a withdrawal and _borrower param is not the msg.sender", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: bob },
      });

      const txPromise_A = borrowerOperations.callInternalAdjustLoan(
        alice,
        dec(1, 18),
        dec(1, 18),
        true,
        { from: bob },
      );
      await assertRevert(
        txPromise_A,
        "BorrowerOps: Caller must be the borrower for a withdrawal",
      );
      const txPromise_B = borrowerOperations.callInternalAdjustLoan(
        bob,
        dec(1, 18),
        dec(1, 18),
        true,
        { from: owner },
      );
      await assertRevert(
        txPromise_B,
        "BorrowerOps: Caller must be the borrower for a withdrawal",
      );
      const txPromise_C = borrowerOperations.callInternalAdjustLoan(
        carol,
        dec(1, 18),
        dec(1, 18),
        true,
        { from: bob },
      );
      await assertRevert(
        txPromise_C,
        "BorrowerOps: Caller must be the borrower for a withdrawal",
      );
    });

    // --- closeTrove() ---

    it("closeTrove(): reverts when it would lower the TCR below CCR", async () => {
      const { troveId: aliceTroveId } = await openTrove({
        ICR: toBN(dec(300, 16)),
        extraParams: { from: alice },
      });
      await openTrove({
        ICR: toBN(dec(120, 16)),
        extraBoldAmount: toBN(dec(300, 18)),
        extraParams: { from: bob },
      });

      const price = await priceFeed.getPrice();

      // to compensate borrowing fees
      await boldToken.transfer(alice, dec(300, 18), { from: bob });

      assert.isFalse(await troveManager.checkRecoveryMode(price));

      await assertRevert(
        borrowerOperations.closeTrove(aliceTroveId, { from: alice }),
        "BorrowerOps: An operation that would result in TCR < CCR is not permitted",
      );
    });

    it("closeTrove(): reverts when calling address does not have active trove", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: alice },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: bob },
      });

      // Carol with no active trove attempts to close her trove
      try {
        const txCarol = await borrowerOperations.closeTrove(th.addressToTroveId(carol), { from: carol });
        assert.isFalse(txCarol.receipt.status);
      } catch (err) {
        assert.include(err.message, "revert");
      }
    });

    it("closeTrove(): reverts when system is in Recovery Mode", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(100000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });
      const { troveId: bobTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob },
      });
      const { troveId: carolTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: carol },
      });

      // Alice transfers her Bold to Bob and Carol so they can cover fees
      const aliceBal = await boldToken.balanceOf(alice);
      await boldToken.transfer(bob, aliceBal.div(toBN(2)), { from: alice });
      await boldToken.transfer(carol, aliceBal.div(toBN(2)), { from: alice });

      // check Recovery Mode
      assert.isFalse(await th.checkRecoveryMode(contracts));

      // Bob successfully closes his trove
      const txBob = await borrowerOperations.closeTrove(bobTroveId, { from: bob });
      assert.isTrue(txBob.receipt.status);

      await priceFeed.setPrice(dec(100, 18));

      assert.isTrue(await th.checkRecoveryMode(contracts));

      // Carol attempts to close her trove during Recovery Mode
      await assertRevert(
        borrowerOperations.closeTrove(carolTroveId, { from: carol }),
        "BorrowerOps: Operation not permitted during Recovery Mode",
      );
    });

    it("closeTrove(): reduces a Trove's collateral to zero", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: dennis },
      });

      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });

      const aliceCollBefore = await getTroveEntireColl(aliceTroveId);
      const dennisBold = await boldToken.balanceOf(dennis);
      assert.isTrue(aliceCollBefore.gt(toBN("0")));
      assert.isTrue(dennisBold.gt(toBN("0")));

      // To compensate borrowing fees
      await boldToken.transfer(alice, dennisBold.div(toBN(2)), {
        from: dennis,
      });

      // Alice attempts to close trove
      await borrowerOperations.closeTrove(aliceTroveId, { from: alice });

      const aliceCollAfter = await getTroveEntireColl(aliceTroveId);
      assert.equal(aliceCollAfter, "0");
    });

    it("closeTrove(): reduces a Trove's debt to zero", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: dennis },
      });

      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });

      const aliceDebtBefore = await getTroveEntireColl(aliceTroveId);
      const dennisBold = await boldToken.balanceOf(dennis);
      assert.isTrue(aliceDebtBefore.gt(toBN("0")));
      assert.isTrue(dennisBold.gt(toBN("0")));

      // To compensate borrowing fees
      await boldToken.transfer(alice, dennisBold.div(toBN(2)), {
        from: dennis,
      });

      // Alice attempts to close trove
      await borrowerOperations.closeTrove(aliceTroveId, { from: alice });

      const aliceCollAfter = await getTroveEntireColl(aliceTroveId);
      assert.equal(aliceCollAfter, "0");
    });

    it("closeTrove(): sets Trove's stake to zero", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: dennis },
      });

      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });

      const aliceStakeBefore = await getTroveStake(aliceTroveId);
      assert.isTrue(aliceStakeBefore.gt(toBN("0")));

      const dennisBold = await boldToken.balanceOf(dennis);
      assert.isTrue(aliceStakeBefore.gt(toBN("0")));
      assert.isTrue(dennisBold.gt(toBN("0")));

      // To compensate borrowing fees
      await boldToken.transfer(alice, dennisBold.div(toBN(2)), {
        from: dennis,
      });

      // Alice attempts to close trove
      await borrowerOperations.closeTrove(aliceTroveId, { from: alice });

      const stakeAfter = (await troveManager.Troves(aliceTroveId))[2].toString();
      assert.equal(stakeAfter, "0");
      // check withdrawal was successful
    });

    it("closeTrove(): zero's the troves reward snapshots", async () => {
      // Dennis opens trove and transfers tokens to alice
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: dennis },
      });

      const { troveId: bobTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob },
      });

      // Price drops
      await priceFeed.setPrice(dec(100, 18));

      // Liquidate Bob
      await troveManager.liquidate(bobTroveId);
      assert.isFalse(await sortedTroves.contains(bobTroveId));

      // Price bounces back
      await priceFeed.setPrice(dec(200, 18));

      // Alice and Carol open troves
      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });
      const { troveId: carol_Id } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: carol },
      });

      // Price drops ...again
      await priceFeed.setPrice(dec(100, 18));

      // Get Alice's pending reward snapshots
      const L_ETH_A_Snapshot = (await troveManager.rewardSnapshots(aliceTroveId))[0];
      const L_boldDebt_A_Snapshot = (
        await troveManager.rewardSnapshots(aliceTroveId)
      )[1];
      assert.isTrue(L_ETH_A_Snapshot.gt(toBN("0")));
      assert.isTrue(L_boldDebt_A_Snapshot.gt(toBN("0")));

      // Liquidate Carol
      await troveManager.liquidate(carol_Id);
      assert.isFalse(await sortedTroves.contains(carol_Id));

      // Get Alice's pending reward snapshots after Carol's liquidation. Check above 0
      const L_ETH_Snapshot_A_AfterLiquidation = (
        await troveManager.rewardSnapshots(aliceTroveId)
      )[0];
      const L_boldDebt_Snapshot_A_AfterLiquidation = (
        await troveManager.rewardSnapshots(aliceTroveId)
      )[1];

      assert.isTrue(L_ETH_Snapshot_A_AfterLiquidation.gt(toBN("0")));
      assert.isTrue(L_boldDebt_Snapshot_A_AfterLiquidation.gt(toBN("0")));

      // to compensate borrowing fees
      await boldToken.transfer(alice, await boldToken.balanceOf(dennis), {
        from: dennis,
      });

      await priceFeed.setPrice(dec(2000, 18));

      // Alice closes trove
      await borrowerOperations.closeTrove(aliceTroveId, { from: alice });

      // Check Alice's pending reward snapshots are zero
      const L_ETH_Snapshot_A_afterAliceCloses = (
        await troveManager.rewardSnapshots(aliceTroveId)
      )[0];
      const L_boldDebt_Snapshot_A_afterAliceCloses = (
        await troveManager.rewardSnapshots(aliceTroveId)
      )[1];

      assert.equal(L_ETH_Snapshot_A_afterAliceCloses, "0");
      assert.equal(L_boldDebt_Snapshot_A_afterAliceCloses, "0");
    });

    it("closeTrove(): sets trove's status to closed and removes it from sorted troves list", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: dennis },
      });

      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });

      // Check Trove is active
      const alice_Trove_Before = await troveManager.Troves(aliceTroveId);
      const status_Before = alice_Trove_Before[3];

      assert.equal(status_Before, 1);
      assert.isTrue(await sortedTroves.contains(aliceTroveId));

      // to compensate borrowing fees
      await boldToken.transfer(alice, await boldToken.balanceOf(dennis), {
        from: dennis,
      });

      // Close the trove
      await borrowerOperations.closeTrove(aliceTroveId, { from: alice });

      const alice_Trove_After = await troveManager.Troves(aliceTroveId);
      const status_After = alice_Trove_After[3];

      assert.equal(status_After, 2);
      assert.isFalse(await sortedTroves.contains(aliceTroveId));
    });

    it("closeTrove(): reduces ActivePool ETH and raw ether by correct amount", async () => {
      const { troveId: dennisTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: dennis },
      });
      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });

      const dennisColl = await getTroveEntireColl(dennisTroveId);
      const aliceColl = await getTroveEntireColl(aliceTroveId);
      assert.isTrue(dennisColl.gt("0"));
      assert.isTrue(aliceColl.gt("0"));

      // Check active Pool ETH before
      const activePool_ETH_before = await activePool.getETHBalance();
      const activePool_RawEther_before = toBN(
        await contracts.WETH.balanceOf(activePool.address),
      );
      assert.isTrue(activePool_ETH_before.eq(aliceColl.add(dennisColl)));
      assert.isTrue(activePool_ETH_before.gt(toBN("0")));
      assert.isTrue(activePool_RawEther_before.eq(activePool_ETH_before));

      // to compensate borrowing fees
      await boldToken.transfer(alice, await boldToken.balanceOf(dennis), {
        from: dennis,
      });

      // Close the trove
      await borrowerOperations.closeTrove(aliceTroveId, { from: alice });

      // Check after
      const activePool_ETH_After = await activePool.getETHBalance();
      const activePool_RawEther_After = toBN(
        await contracts.WETH.balanceOf(activePool.address),
      );
      assert.isTrue(activePool_ETH_After.eq(dennisColl));
      assert.isTrue(activePool_RawEther_After.eq(dennisColl));
    });

    it("closeTrove(): reduces ActivePool debt by correct amount", async () => {
      const { troveId: dennisTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: dennis },
      });
      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });

      const dennisDebt = await getTroveEntireDebt(dennisTroveId);
      const aliceDebt = await getTroveEntireDebt(aliceTroveId);
      assert.isTrue(dennisDebt.gt("0"));
      assert.isTrue(aliceDebt.gt("0"));

      // Check before
      const activePool_Debt_before = await activePool.getTotalActiveDebt();
      assert.isTrue(activePool_Debt_before.eq(aliceDebt.add(dennisDebt)));
      assert.isTrue(activePool_Debt_before.gt(toBN("0")));

      // to compensate borrowing fees
      await boldToken.transfer(alice, await boldToken.balanceOf(dennis), {
        from: dennis,
      });

      // Close the trove
      await borrowerOperations.closeTrove(aliceTroveId, { from: alice });

      // Check after
      const activePool_Debt_After = (await activePool.getTotalActiveDebt()).toString();
      th.assertIsApproximatelyEqual(activePool_Debt_After, dennisDebt);
    });

    it("closeTrove(): updates the the total stakes", async () => {
      const { troveId: dennisTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: dennis },
      });
      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });
      const { troveId: bobTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob },
      });

      // Get individual stakes
      const aliceStakeBefore = await getTroveStake(aliceTroveId);
      const bobStakeBefore = await getTroveStake(bobTroveId);
      const dennisStakeBefore = await getTroveStake(dennisTroveId);
      assert.isTrue(aliceStakeBefore.gt("0"));
      assert.isTrue(bobStakeBefore.gt("0"));
      assert.isTrue(dennisStakeBefore.gt("0"));

      const totalStakesBefore = await troveManager.totalStakes();

      assert.isTrue(
        totalStakesBefore.eq(
          aliceStakeBefore.add(bobStakeBefore).add(dennisStakeBefore),
        ),
      );

      // to compensate borrowing fees
      await boldToken.transfer(alice, await boldToken.balanceOf(dennis), {
        from: dennis,
      });

      // Alice closes trove
      await borrowerOperations.closeTrove(aliceTroveId, { from: alice });

      // Check stake and total stakes get updated
      const aliceStakeAfter = await getTroveStake(aliceTroveId);
      const totalStakesAfter = await troveManager.totalStakes();

      assert.equal(aliceStakeAfter, 0);
      assert.isTrue(
        totalStakesAfter.eq(totalStakesBefore.sub(aliceStakeBefore)),
      );
    });

    // TODO: wrap contracts.WETH.balanceOf to be able to go through proxies
    it("closeTrove(): sends the correct amount of ETH to the user", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: dennis },
      });
      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });

      const aliceColl = await getTroveEntireColl(aliceTroveId);
      assert.isTrue(aliceColl.gt(toBN("0")));

      const alice_ETHBalance_Before = web3.utils.toBN(
        await contracts.WETH.balanceOf(alice),
      );

      // to compensate borrowing fees
      await boldToken.transfer(alice, await boldToken.balanceOf(dennis), {
        from: dennis,
      });

      await borrowerOperations.closeTrove(aliceTroveId, { from: alice, gasPrice: 0 });

      const alice_ETHBalance_After = web3.utils.toBN(
        await contracts.WETH.balanceOf(alice),
      );
      const balanceDiff = alice_ETHBalance_After.sub(alice_ETHBalance_Before);

      assert.isTrue(balanceDiff.eq(aliceColl));
    });

    it("closeTrove(): subtracts the debt of the closed Trove from the Borrower's BoldToken balance", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: dennis },
      });
      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });

      const aliceDebt = await getTroveEntireDebt(aliceTroveId);
      assert.isTrue(aliceDebt.gt(toBN("0")));

      // to compensate borrowing fees
      await boldToken.transfer(alice, await boldToken.balanceOf(dennis), {
        from: dennis,
      });

      const alice_BoldBalance_Before = await boldToken.balanceOf(alice);
      assert.isTrue(alice_BoldBalance_Before.gt(toBN("0")));

      // close trove
      await borrowerOperations.closeTrove(aliceTroveId, { from: alice });

      // check alice Bold balance after
      const alice_BoldBalance_After = await boldToken.balanceOf(alice);
      th.assertIsApproximatelyEqual(
        alice_BoldBalance_After,
        alice_BoldBalance_Before.sub(aliceDebt.sub(BOLD_GAS_COMPENSATION)),
      );
    });

    it("closeTrove(): applies pending rewards", async () => {
      // --- SETUP ---
      const { troveId: whaleTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(1000000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale },
      });
      const whaleDebt = await getTroveEntireDebt(whaleTroveId);
      const whaleColl = await getTroveEntireColl(whaleTroveId);

      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(15000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });
      const { troveId: bobTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob },
      });
      const { troveId: carolTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: carol },
      });

      const carolDebt = await getTroveEntireDebt(carolTroveId);
      const carolColl = await getTroveEntireColl(carolTroveId);

      // Whale transfers to A and B to cover their fees
      await boldToken.transfer(alice, dec(10000, 18), { from: whale });
      await boldToken.transfer(bob, dec(10000, 18), { from: whale });

      // --- TEST ---

      // price drops to 1ETH:100Bold, reducing Carol's ICR below MCR
      await priceFeed.setPrice(dec(100, 18));
      const price = await priceFeed.getPrice();

      // liquidate Carol's Trove, Alice and Bob earn rewards.
      const liquidationTx = await troveManager.liquidate(carolTroveId, {
        from: owner,
      });
      const [liquidatedDebt_C, liquidatedColl_C, gasComp_C] = th.getEmittedLiquidationValues(liquidationTx);

      // Carol opens a new Trove
      await openTrove({
        troveIndex: 1,
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: carol },
      });

      // check Alice and Bob's reward snapshots are zero before they alter their Troves
      const alice_rewardSnapshot_Before = await troveManager.rewardSnapshots(
        alice,
      );
      const alice_ETHrewardSnapshot_Before = alice_rewardSnapshot_Before[0];
      const alice_BoldDebtRewardSnapshot_Before = alice_rewardSnapshot_Before[1];

      const bob_rewardSnapshot_Before = await troveManager.rewardSnapshots(bobTroveId);
      const bob_ETHrewardSnapshot_Before = bob_rewardSnapshot_Before[0];
      const bob_BoldDebtRewardSnapshot_Before = bob_rewardSnapshot_Before[1];

      assert.equal(alice_ETHrewardSnapshot_Before, 0);
      assert.equal(alice_BoldDebtRewardSnapshot_Before, 0);
      assert.equal(bob_ETHrewardSnapshot_Before, 0);
      assert.equal(bob_BoldDebtRewardSnapshot_Before, 0);

      const defaultPool_ETH = await defaultPool.getETHBalance();
      const defaultPool_BoldDebt = await defaultPool.getBoldDebt();

      // Carol's liquidated coll (1 ETH) and drawn debt should have entered the Default Pool
      assert.isAtMost(th.getDifference(defaultPool_ETH, liquidatedColl_C), 100);
      assert.isAtMost(
        th.getDifference(defaultPool_BoldDebt, liquidatedDebt_C),
        100,
      );

      const pendingCollReward_A = await troveManager.getPendingETHReward(aliceTroveId);
      const pendingDebtReward_A = await troveManager.getPendingBoldDebtReward(aliceTroveId);
      assert.isTrue(pendingCollReward_A.gt("0"));
      assert.isTrue(pendingDebtReward_A.gt("0"));

      // Close Alice's trove. Alice's pending rewards should be removed from the DefaultPool when she close.
      await borrowerOperations.closeTrove(aliceTroveId, { from: alice });

      const defaultPool_ETH_afterAliceCloses = await defaultPool.getETHBalance();
      const defaultPool_BoldDebt_afterAliceCloses = await defaultPool.getBoldDebt();

      assert.isAtMost(
        th.getDifference(
          defaultPool_ETH_afterAliceCloses,
          defaultPool_ETH.sub(pendingCollReward_A),
        ),
        1000,
      );
      assert.isAtMost(
        th.getDifference(
          defaultPool_BoldDebt_afterAliceCloses,
          defaultPool_BoldDebt.sub(pendingDebtReward_A),
        ),
        1000,
      );

      // whale adjusts trove, pulling their rewards out of DefaultPool
      await borrowerOperations.adjustTrove(
        whaleTroveId,
        th._100pct,
        0,
        false,
        dec(1, 18),
        true,
        { from: whale },
      );

      // Close Bob's trove. Expect DefaultPool coll and debt to drop to 0, since closing pulls his rewards out.
      await borrowerOperations.closeTrove(bobTroveId, { from: bob });

      const defaultPool_ETH_afterBobCloses = await defaultPool.getETHBalance();
      const defaultPool_BoldDebt_afterBobCloses = await defaultPool.getBoldDebt();

      assert.isAtMost(
        th.getDifference(defaultPool_ETH_afterBobCloses, 0),
        100000,
      );
      assert.isAtMost(
        th.getDifference(defaultPool_BoldDebt_afterBobCloses, 0),
        100000,
      );
    });

    it("closeTrove(): reverts if borrower has insufficient Bold balance to repay his entire debt", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(15000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: A },
      });
      const { troveId: BTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: B },
      });

      // B sends away 1 Bold to A
      await boldToken.transfer(A, th.toBN(dec(1, 18)), { from: B });

      // Confirm B's Bold balance is less than his trove debt
      const B_BoldBal = await boldToken.balanceOf(B);
      const B_troveDebt = await getTroveEntireDebt(BTroveId);

      assert.isTrue(B_BoldBal.lt(B_troveDebt));

      const closeTrovePromise_B = borrowerOperations.closeTrove(BTroveId, { from: B });

      // Check closing trove reverts
      await assertRevert(
        closeTrovePromise_B,
        "BorrowerOps: Caller doesnt have enough Bold to make repayment",
      );
    });

    // --- openTrove() ---

    // TODO: use rawLogs instead of logs
    it("openTrove(): emits a TroveUpdated event with the correct collateral and debt", async () => {
      const { troveId: ATroveId, tx: txA } = await openTrove({
        extraBoldAmount: toBN(dec(15000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: A },
      });
      const { troveId: BTroveId, tx: txB } = await openTrove({
        extraBoldAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: B },
      });
      const { troveId: CTroveId, tx: txC } = await openTrove({
        extraBoldAmount: toBN(dec(3000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: C },
      });

      const A_Coll = await getTroveEntireColl(ATroveId);
      const B_Coll = await getTroveEntireColl(BTroveId);
      const C_Coll = await getTroveEntireColl(CTroveId);
      const A_Debt = await getTroveEntireDebt(ATroveId);
      const B_Debt = await getTroveEntireDebt(BTroveId);
      const C_Debt = await getTroveEntireDebt(CTroveId);

      const A_emittedDebt = toBN(
        th.getEventArgByName(txA, "TroveUpdated", "_debt"),
      );
      const A_emittedColl = toBN(
        th.getEventArgByName(txA, "TroveUpdated", "_coll"),
      );
      const B_emittedDebt = toBN(
        th.getEventArgByName(txB, "TroveUpdated", "_debt"),
      );
      const B_emittedColl = toBN(
        th.getEventArgByName(txB, "TroveUpdated", "_coll"),
      );
      const C_emittedDebt = toBN(
        th.getEventArgByName(txC, "TroveUpdated", "_debt"),
      );
      const C_emittedColl = toBN(
        th.getEventArgByName(txC, "TroveUpdated", "_coll"),
      );

      // Check emitted debt values are correct
      assert.isTrue(A_Debt.eq(A_emittedDebt));
      assert.isTrue(B_Debt.eq(B_emittedDebt));
      assert.isTrue(C_Debt.eq(C_emittedDebt));

      // Check emitted coll values are correct
      assert.isTrue(A_Coll.eq(A_emittedColl));
      assert.isTrue(B_Coll.eq(B_emittedColl));
      assert.isTrue(C_Coll.eq(C_emittedColl));

      const baseRateBefore = await collateralRegistry.baseRate();

      // Artificially make baseRate 6% (higher than the intital 5%)
      await collateralRegistry.setBaseRate(dec(6, 16));
      await collateralRegistry.setLastFeeOpTimeToNow();

      assert.isTrue((await collateralRegistry.baseRate()).gt(baseRateBefore));

      const { troveId: DTroveId, tx: txD } = await openTrove({
        extraBoldAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: D },
      });
      const { troveId: ETroveId, tx: txE } = await openTrove({
        extraBoldAmount: toBN(dec(3000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: E },
      });
      const D_Coll = await getTroveEntireColl(DTroveId);
      const E_Coll = await getTroveEntireColl(ETroveId);
      const D_Debt = await getTroveEntireDebt(DTroveId);
      const E_Debt = await getTroveEntireDebt(ETroveId);

      const D_emittedDebt = toBN(
        th.getEventArgByName(txD, "TroveUpdated", "_debt"),
      );
      const D_emittedColl = toBN(
        th.getEventArgByName(txD, "TroveUpdated", "_coll"),
      );
      const E_emittedDebt = toBN(
        th.getEventArgByName(txE, "TroveUpdated", "_debt"),
      );
      const E_emittedColl = toBN(
        th.getEventArgByName(txE, "TroveUpdated", "_coll"),
      );

      // Check emitted debt values are correct
      assert.isTrue(D_Debt.eq(D_emittedDebt));
      assert.isTrue(E_Debt.eq(E_emittedDebt));

      // Check emitted coll values are correct
      assert.isTrue(D_Coll.eq(D_emittedColl));
      assert.isTrue(E_Coll.eq(E_emittedColl));
    });

    it("openTrove(): Opens a trove with net debt >= minimum net debt", async () => {
      // Add 1 wei to correct for rounding error in helper function
      const ATroveId = await th.openTroveWrapper(
        contracts,
        th._100pct,
        await getNetBorrowingAmount(MIN_NET_DEBT.add(toBN(1))),
        A,
        A,
        0,
        { from: A, value: dec(100, 30) },
      );
      assert.isTrue(await sortedTroves.contains(ATroveId));

      const CTroveId = await th.openTroveWrapper(
        contracts,
        th._100pct,
        await getNetBorrowingAmount(MIN_NET_DEBT.add(toBN(dec(47789898, 22)))),
        A,
        A,
        0,
        { from: C, value: dec(100, 30) },
      );
      assert.isTrue(await sortedTroves.contains(CTroveId));
    });

    it("openTrove(): reverts if net debt < minimum net debt", async () => {
      const txAPromise = th.openTroveWrapper(contracts, th._100pct, 0, A, A, 0, {
        from: A,
        value: dec(100, 30),
      });
      await assertRevert(txAPromise, "revert");

      const txBPromise = th.openTroveWrapper(
        contracts,
        th._100pct,
        await getNetBorrowingAmount(MIN_NET_DEBT.sub(toBN(1))),
        B,
        B,
        0,
        { from: B, value: dec(100, 30) },
      );
      await assertRevert(txBPromise, "revert");

      const txCPromise = th.openTroveWrapper(contracts, th._100pct, MIN_NET_DEBT.sub(toBN(dec(173, 18))), C, C, 0, {
        from: C,
        value: dec(100, 30),
      });
      await assertRevert(txCPromise, "revert");
    });

    it("openTrove(): reverts when system is in Recovery Mode and ICR < CCR", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: whale },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });
      assert.isFalse(await th.checkRecoveryMode(contracts));

      // price drops, and Recovery Mode kicks in
      await priceFeed.setPrice(dec(105, 18));

      assert.isTrue(await th.checkRecoveryMode(contracts));

      // Bob tries to open a trove with 149% ICR during Recovery Mode
      try {
        const txBob = await openTrove({
          extraBoldAmount: toBN(dec(5000, 18)),
          ICR: toBN(dec(149, 16)),
          extraParams: { from: alice },
        });
        assert.isFalse(txBob.receipt.status);
      } catch (err) {
        assert.include(err.message, "revert");
      }
    });

    it("openTrove(): reverts when trove ICR < MCR", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: whale },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });

      assert.isFalse(await th.checkRecoveryMode(contracts));

      // Bob attempts to open a 109% ICR trove in Normal Mode
      try {
        const txBob = (
          await openTrove({
            extraBoldAmount: toBN(dec(5000, 18)),
            ICR: toBN(dec(109, 16)),
            extraParams: { from: bob },
          })
        ).tx;
        assert.isFalse(txBob.receipt.status);
      } catch (err) {
        assert.include(err.message, "revert");
      }

      // price drops, and Recovery Mode kicks in
      await priceFeed.setPrice(dec(105, 18));

      assert.isTrue(await th.checkRecoveryMode(contracts));

      // Bob attempts to open a 109% ICR trove in Recovery Mode
      try {
        const txBob = await openTrove({
          extraBoldAmount: toBN(dec(5000, 18)),
          ICR: toBN(dec(109, 16)),
          extraParams: { from: bob },
        });
        assert.isFalse(txBob.receipt.status);
      } catch (err) {
        assert.include(err.message, "revert");
      }
    });

    it("openTrove(): reverts when opening the trove would cause the TCR of the system to fall below the CCR", async () => {
      await priceFeed.setPrice(dec(100, 18));

      // Alice creates trove with 150% ICR.  System TCR = 150%.
      await openTrove({
        extraBoldAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(15, 17)),
        extraParams: { from: alice },
      });

      const TCR = await th.getTCR(contracts);
      assert.equal(TCR, dec(150, 16));

      // Bob attempts to open a trove with ICR = 149%
      // System TCR would fall below 150%
      try {
        const txBob = await openTrove({
          extraBoldAmount: toBN(dec(5000, 18)),
          ICR: toBN(dec(149, 16)),
          extraParams: { from: bob },
        });
        assert.isFalse(txBob.receipt.status);
      } catch (err) {
        assert.include(err.message, "revert");
      }
    });

    it("openTrove(): reverts if trove is already active", async () => {
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale },
      });

      await openTrove({
        extraBoldAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(15, 17)),
        extraParams: { from: alice },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(15, 17)),
        extraParams: { from: bob },
      });

      try {
        const txB_1 = await openTrove({
          extraBoldAmount: toBN(dec(5000, 18)),
          ICR: toBN(dec(3, 18)),
          extraParams: { from: bob },
        });

        assert.isFalse(txB_1.receipt.status);
      } catch (err) {
        assert.include(err.message, "revert");
      }

      try {
        const txB_2 = await openTrove({
          ICR: toBN(dec(2, 18)),
          extraParams: { from: alice },
        });

        assert.isFalse(txB_2.receipt.status);
      } catch (err) {
        assert.include(err.message, "revert");
      }
    });

    it("openTrove(): Can open a trove with ICR == CCR when system is in Recovery Mode", async () => {
      // --- SETUP ---
      //  Alice and Bob add coll and withdraw such  that the TCR is ~150%
      await openTrove({
        extraBoldAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(15, 17)),
        extraParams: { from: alice },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(15, 17)),
        extraParams: { from: bob },
      });

      const TCR = (await th.getTCR(contracts)).toString();
      assert.equal(TCR, "1500000000000000000");

      // price drops to 1ETH:100Bold, reducing TCR below 150%
      await priceFeed.setPrice("100000000000000000000");
      const price = await priceFeed.getPrice();

      assert.isTrue(await th.checkRecoveryMode(contracts));

      // Carol opens at 150% ICR in Recovery Mode
      const { troveId: carolTroveId, tx: txCarol } = await openTrove({
        extraBoldAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(15, 17)),
        extraParams: { from: carol },
      });
      assert.isTrue(txCarol.receipt.status);
      assert.isTrue(await sortedTroves.contains(carolTroveId));

      const carol_TroveStatus = await troveManager.getTroveStatus(carolTroveId);
      assert.equal(carol_TroveStatus, 1);

      const carolICR = await troveManager.getCurrentICR(carolTroveId, price);
      assert.isTrue(carolICR.eq(toBN(dec(150, 16))));
    });

    it("openTrove(): Reverts opening a trove with min debt when system is in Recovery Mode", async () => {
      // --- SETUP ---
      //  Alice and Bob add coll and withdraw such  that the TCR is ~150%
      await openTrove({
        extraBoldAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(15, 17)),
        extraParams: { from: alice },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(15, 17)),
        extraParams: { from: bob },
      });

      const TCR = (await th.getTCR(contracts)).toString();
      assert.equal(TCR, "1500000000000000000");

      // price drops to 1ETH:100Bold, reducing TCR below 150%
      await priceFeed.setPrice("100000000000000000000");

      assert.isTrue(await th.checkRecoveryMode(contracts));

      await assertRevert(
        th.openTroveWrapper(contracts, th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT), carol, carol, 0, {
          from: carol,
          value: dec(1, "ether"),
        }),
      );
    });

    it("openTrove(): creates a new Trove and assigns the correct collateral and debt amount", async () => {
      /*
      const debt_Before = await getTroveEntireDebt(aliceTroveId);
      const coll_Before = await getTroveEntireColl(aliceTroveId);
      const status_Before = await troveManager.getTroveStatus(aliceTroveId);

      // check coll and debt before
      assert.equal(debt_Before, 0);
      assert.equal(coll_Before, 0);

      // check non-existent status
      assert.equal(status_Before, 0);
      */

      const BoldRequest = MIN_NET_DEBT;
      const aliceTroveId = await th.openTroveWrapper(contracts, th._100pct, MIN_NET_DEBT, carol, carol, 0, {
        from: alice,
        value: dec(100, "ether"),
      });

      // Get the expected debt based on the Bold request (adding fee and liq. reserve on top)
      const expectedDebt = BoldRequest.add(BOLD_GAS_COMPENSATION);

      const debt_After = await getTroveEntireDebt(aliceTroveId);
      const coll_After = await getTroveEntireColl(aliceTroveId);
      const status_After = await troveManager.getTroveStatus(aliceTroveId);

      // check coll and debt after
      assert.isTrue(coll_After.gt("0"));
      assert.isTrue(debt_After.gt("0"));

      assert.isTrue(debt_After.eq(expectedDebt));

      // check active status
      assert.equal(status_After, 1);
    });

    it("openTrove(): adds Trove owner to TroveIds array", async () => {
      const TroveIdsCount_Before = (
        await troveManager.getTroveIdsCount()
      ).toString();
      assert.equal(TroveIdsCount_Before, "0");

      await openTrove({
        extraBoldAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(15, 17)),
        extraParams: { from: alice },
      });

      const TroveIdsCount_After = (
        await troveManager.getTroveIdsCount()
      ).toString();
      assert.equal(TroveIdsCount_After, "1");
    });

    it("openTrove(): creates a stake and adds it to total stakes", async () => {
      // const aliceStakeBefore = await getTroveStake(aliceTroveId);
      const totalStakesBefore = await troveManager.totalStakes();

      // assert.equal(aliceStakeBefore, "0");
      assert.equal(totalStakesBefore, "0");

      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });
      const aliceCollAfter = await getTroveEntireColl(aliceTroveId);
      const aliceStakeAfter = await getTroveStake(aliceTroveId);
      assert.isTrue(aliceCollAfter.gt(toBN("0")));
      assert.isTrue(aliceStakeAfter.eq(aliceCollAfter));

      const totalStakesAfter = await troveManager.totalStakes();

      assert.isTrue(totalStakesAfter.eq(aliceStakeAfter));
    });

    it("openTrove(): inserts Trove to Sorted Troves list", async () => {
      // Check before
      // const aliceTroveInList_Before = await sortedTroves.contains(aliceTroveId);
      const listIsEmpty_Before = await sortedTroves.isEmpty();
      // assert.equal(aliceTroveInList_Before, false);
      assert.equal(listIsEmpty_Before, true);

      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });

      // check after
      const aliceTroveInList_After = await sortedTroves.contains(aliceTroveId);
      const listIsEmpty_After = await sortedTroves.isEmpty();
      assert.equal(aliceTroveInList_After, true);
      assert.equal(listIsEmpty_After, false);
    });

    it("openTrove(): Increases the activePool ETH and raw ether balance by correct amount", async () => {
      const activePool_ETH_Before = await activePool.getETHBalance();
      const activePool_RawEther_Before = await contracts.WETH.balanceOf(
        activePool.address,
      );
      assert.equal(activePool_ETH_Before, 0);
      assert.equal(activePool_RawEther_Before, 0);

      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });
      const aliceCollAfter = await getTroveEntireColl(aliceTroveId);

      const activePool_ETH_After = await activePool.getETHBalance();
      const activePool_RawEther_After = toBN(
        await contracts.WETH.balanceOf(activePool.address),
      );
      assert.isTrue(activePool_ETH_After.eq(aliceCollAfter));
      assert.isTrue(activePool_RawEther_After.eq(aliceCollAfter));
    });

    it("openTrove(): records up-to-date initial snapshots of L_ETH and L_boldDebt", async () => {
      // --- SETUP ---

      await openTrove({
        extraBoldAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });
      const { troveId: carolTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: carol },
      });

      // --- TEST ---

      // price drops to 1ETH:100Bold, reducing Carol's ICR below MCR
      await priceFeed.setPrice(dec(100, 18));

      // close Carol's Trove, liquidating her 1 ether and 180Bold.
      const liquidationTx = await troveManager.liquidate(carolTroveId, {
        from: owner,
      });
      const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx);

      /* with total stakes = 10 ether, after liquidation, L_ETH should equal 1/10 ether per-ether-staked,
       and L_Bold should equal 18 Bold per-ether-staked. */

      const L_ETH = await troveManager.L_ETH();
      const L_Bold = await troveManager.L_boldDebt();

      assert.isTrue(L_ETH.gt(toBN("0")));
      assert.isTrue(L_Bold.gt(toBN("0")));

      // Bob opens trove
      const { troveId: bobTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob },
      });

      // Check Bob's snapshots of L_ETH and L_Bold equal the respective current values
      const bob_rewardSnapshot = await troveManager.rewardSnapshots(bobTroveId);
      const bob_ETHrewardSnapshot = bob_rewardSnapshot[0];
      const bob_BoldDebtRewardSnapshot = bob_rewardSnapshot[1];

      assert.isAtMost(th.getDifference(bob_ETHrewardSnapshot, L_ETH), 1000);
      assert.isAtMost(
        th.getDifference(bob_BoldDebtRewardSnapshot, L_Bold),
        1000,
      );
    });

    it("openTrove(): allows a user to open a Trove, then close it, then re-open it", async () => {
      // Open Troves
      await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: whale },
      });
      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });
      await openTrove({
        extraBoldAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: carol },
      });

      // Check Trove is active
      const alice_Trove_1 = await troveManager.Troves(aliceTroveId);
      const status_1 = alice_Trove_1[3];
      assert.equal(status_1, 1);
      assert.isTrue(await sortedTroves.contains(aliceTroveId));

      // to compensate borrowing fees
      await boldToken.transfer(alice, dec(10000, 18), { from: whale });

      // Repay and close Trove
      await borrowerOperations.closeTrove(aliceTroveId, { from: alice });

      // Check Trove is closed
      const alice_Trove_2 = await troveManager.Troves(aliceTroveId);
      const status_2 = alice_Trove_2[3];
      assert.equal(status_2, 2);
      assert.isFalse(await sortedTroves.contains(aliceTroveId));

      // Re-open Trove
      await openTrove({
        troveIndex: 0,
        extraBoldAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });

      // Check Trove is re-opened
      const alice_Trove_3 = await troveManager.Troves(aliceTroveId);
      const status_3 = alice_Trove_3[3];
      assert.equal(status_3, 1);
      assert.isTrue(await sortedTroves.contains(aliceTroveId));
    });

    it("openTrove(): increases the Trove's Bold debt by the correct amount", async () => {
      // check before
      const alice_Trove_Before = await troveManager.Troves(th.addressToTroveId(alice));
      const debt_Before = alice_Trove_Before[0];
      assert.equal(debt_Before, 0);

      const aliceTroveId = await th.openTroveWrapper(
        contracts,
        th._100pct,
        await getOpenTroveBoldAmount(dec(10000, 18)),
        alice,
        alice,
        0,
        { from: alice, value: dec(100, "ether") },
      );

      // check after
      const alice_Trove_After = await troveManager.Troves(aliceTroveId);
      const debt_After = alice_Trove_After[0];
      th.assertIsApproximatelyEqual(debt_After, dec(10000, 18), 10000);
    });

    it("openTrove(): increases Bold debt in ActivePool by the debt of the trove", async () => {
      const activePool_BoldDebt_Before = await activePool.getTotalActiveDebt();
      assert.equal(activePool_BoldDebt_Before, 0);

      const { troveId: aliceTroveId } = await openTrove({
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice },
      });
      const aliceDebt = await getTroveEntireDebt(aliceTroveId);
      assert.isTrue(aliceDebt.gt(toBN("0")));

      const activePool_BoldDebt_After = await activePool.getTotalActiveDebt();
      assert.isTrue(activePool_BoldDebt_After.eq(aliceDebt));
    });

    it("openTrove(): increases user BoldToken balance by correct amount", async () => {
      // check before
      const alice_BoldTokenBalance_Before = await boldToken.balanceOf(alice);
      assert.equal(alice_BoldTokenBalance_Before, 0);

      await th.openTroveWrapper(contracts, th._100pct, dec(10000, 18), alice, alice, 0, {
        from: alice,
        value: dec(100, "ether"),
      });

      // check after
      const alice_BoldTokenBalance_After = await boldToken.balanceOf(alice);
      assert.equal(alice_BoldTokenBalance_After, dec(10000, 18));
    });

    //  --- getNewICRFromTroveChange - (external wrapper in Tester contract calls internal function) ---

    describe("getNewICRFromTroveChange() returns the correct ICR", async () => {
      // 0, 0
      it("collChange = 0, debtChange = 0", async () => {
        price = await priceFeed.getPrice();
        const initialColl = dec(1, "ether");
        const initialDebt = dec(100, 18);
        const collChange = 0;
        const debtChange = 0;

        const newICR = (
          await borrowerOperations.getNewICRFromTroveChange(
            initialColl,
            initialDebt,
            collChange,
            true,
            debtChange,
            true,
            price,
          )
        ).toString();
        assert.equal(newICR, "2000000000000000000");
      });

      // 0, +ve
      it("collChange = 0, debtChange is positive", async () => {
        price = await priceFeed.getPrice();
        const initialColl = dec(1, "ether");
        const initialDebt = dec(100, 18);
        const collChange = 0;
        const debtChange = dec(50, 18);

        const newICR = (
          await borrowerOperations.getNewICRFromTroveChange(
            initialColl,
            initialDebt,
            collChange,
            true,
            debtChange,
            true,
            price,
          )
        ).toString();
        assert.isAtMost(th.getDifference(newICR, "1333333333333333333"), 100);
      });

      // 0, -ve
      it("collChange = 0, debtChange is negative", async () => {
        price = await priceFeed.getPrice();
        const initialColl = dec(1, "ether");
        const initialDebt = dec(100, 18);
        const collChange = 0;
        const debtChange = dec(50, 18);

        const newICR = (
          await borrowerOperations.getNewICRFromTroveChange(
            initialColl,
            initialDebt,
            collChange,
            true,
            debtChange,
            false,
            price,
          )
        ).toString();
        assert.equal(newICR, "4000000000000000000");
      });

      // +ve, 0
      it("collChange is positive, debtChange is 0", async () => {
        price = await priceFeed.getPrice();
        const initialColl = dec(1, "ether");
        const initialDebt = dec(100, 18);
        const collChange = dec(1, "ether");
        const debtChange = 0;

        const newICR = (
          await borrowerOperations.getNewICRFromTroveChange(
            initialColl,
            initialDebt,
            collChange,
            true,
            debtChange,
            true,
            price,
          )
        ).toString();
        assert.equal(newICR, "4000000000000000000");
      });

      // -ve, 0
      it("collChange is negative, debtChange is 0", async () => {
        price = await priceFeed.getPrice();
        const initialColl = dec(1, "ether");
        const initialDebt = dec(100, 18);
        const collChange = dec(5, 17);
        const debtChange = 0;

        const newICR = (
          await borrowerOperations.getNewICRFromTroveChange(
            initialColl,
            initialDebt,
            collChange,
            false,
            debtChange,
            true,
            price,
          )
        ).toString();
        assert.equal(newICR, "1000000000000000000");
      });

      // -ve, -ve
      it("collChange is negative, debtChange is negative", async () => {
        price = await priceFeed.getPrice();
        const initialColl = dec(1, "ether");
        const initialDebt = dec(100, 18);
        const collChange = dec(5, 17);
        const debtChange = dec(50, 18);

        const newICR = (
          await borrowerOperations.getNewICRFromTroveChange(
            initialColl,
            initialDebt,
            collChange,
            false,
            debtChange,
            false,
            price,
          )
        ).toString();
        assert.equal(newICR, "2000000000000000000");
      });

      // +ve, +ve
      it("collChange is positive, debtChange is positive", async () => {
        price = await priceFeed.getPrice();
        const initialColl = dec(1, "ether");
        const initialDebt = dec(100, 18);
        const collChange = dec(1, "ether");
        const debtChange = dec(100, 18);

        const newICR = (
          await borrowerOperations.getNewICRFromTroveChange(
            initialColl,
            initialDebt,
            collChange,
            true,
            debtChange,
            true,
            price,
          )
        ).toString();
        assert.equal(newICR, "2000000000000000000");
      });

      // +ve, -ve
      it("collChange is positive, debtChange is negative", async () => {
        price = await priceFeed.getPrice();
        const initialColl = dec(1, "ether");
        const initialDebt = dec(100, 18);
        const collChange = dec(1, "ether");
        const debtChange = dec(50, 18);

        const newICR = (
          await borrowerOperations.getNewICRFromTroveChange(
            initialColl,
            initialDebt,
            collChange,
            true,
            debtChange,
            false,
            price,
          )
        ).toString();
        assert.equal(newICR, "8000000000000000000");
      });

      // -ve, +ve
      it("collChange is negative, debtChange is positive", async () => {
        price = await priceFeed.getPrice();
        const initialColl = dec(1, "ether");
        const initialDebt = dec(100, 18);
        const collChange = dec(5, 17);
        const debtChange = dec(100, 18);

        const newICR = (
          await borrowerOperations.getNewICRFromTroveChange(
            initialColl,
            initialDebt,
            collChange,
            false,
            debtChange,
            true,
            price,
          )
        ).toString();
        assert.equal(newICR, "500000000000000000");
      });
    });

    // --- getCompositeDebt ---

    it("getCompositeDebt(): returns debt + gas comp", async () => {
      const res1 = await borrowerOperations.getCompositeDebt("0");
      assert.equal(res1, BOLD_GAS_COMPENSATION.toString());

      const res2 = await borrowerOperations.getCompositeDebt(dec(90, 18));
      th.assertIsApproximatelyEqual(
        res2,
        BOLD_GAS_COMPENSATION.add(toBN(dec(90, 18))),
      );

      const res3 = await borrowerOperations.getCompositeDebt(
        dec(24423422357345049, 12),
      );
      th.assertIsApproximatelyEqual(
        res3,
        BOLD_GAS_COMPENSATION.add(toBN(dec(24423422357345049, 12))),
      );
    });

    //  --- getNewTCRFromTroveChange  - (external wrapper in Tester contract calls internal function) ---

    describe("getNewTCRFromTroveChange() returns the correct TCR", async () => {
      // 0, 0
      it("collChange = 0, debtChange = 0", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const bobColl = toBN(dec(1000, "ether"));
        const whaleColl = toBN(dec(10000, "ether"));
        const bobTotalDebt = toBN(dec(100000, 18));
        const whaleTotalDebt = toBN(dec(2000, 18));
        const bobBoldAmount = await getOpenTroveBoldAmount(bobTotalDebt);
        const whaleBoldAmount = await getOpenTroveBoldAmount(whaleTotalDebt);

        await th.openTroveWrapper(contracts, th._100pct, whaleBoldAmount, whale, whale, 0, {
          from: whale,
          value: whaleColl,
        });
        const bobTroveId = await th.openTroveWrapper(contracts, th._100pct, bobBoldAmount, bob, bob, 0, {
          from: bob,
          value: bobColl,
        });

        const liqPrice = th.toBN(dec(100, 18));
        // th.logBN("Bob ICR before liq", await troveManager.getCurrentICR(bob, liqPrice))
        await priceFeed.setPrice(liqPrice);
        // Confirm we are in Normal Mode
        assert.isFalse(await troveManager.checkRecoveryMode(liqPrice));

        const liquidationTx = await troveManager.liquidate(bobTroveId);
        assert.isFalse(await sortedTroves.contains(bobTroveId));

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx);

        // --- TEST ---
        const collChange = 0;
        const debtChange = 0;
        const newTCR = await borrowerOperations.getNewTCRFromTroveChange(
          collChange,
          true,
          debtChange,
          true,
          liqPrice,
        );

        const expectedTCR = whaleColl
          .add(liquidatedColl)
          .mul(liqPrice)
          .div(whaleTotalDebt.add(liquidatedDebt));

        assert.isTrue(newTCR.eq(expectedTCR));
      });

      // 0, +ve
      it("collChange = 0, debtChange is positive", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const bobColl = toBN(dec(1000, "ether"));
        const whaleColl = toBN(dec(10000, "ether"));
        const bobTotalDebt = toBN(dec(100000, 18));
        const whaleTotalDebt = toBN(dec(2000, 18));
        const bobBoldAmount = await getOpenTroveBoldAmount(bobTotalDebt);
        const whaleBoldAmount = await getOpenTroveBoldAmount(whaleTotalDebt);

        await th.openTroveWrapper(contracts, th._100pct, whaleBoldAmount, whale, whale, 0, {
          from: whale,
          value: whaleColl,
        });

        const bobTroveId = await th.openTroveWrapper(contracts, th._100pct, bobBoldAmount, bob, bob, 0, {
          from: bob,
          value: bobColl,
        });

        const liqPrice = th.toBN(dec(100, 18));
        // th.logBN("Bob ICR before liq", await troveManager.getCurrentICR(bob, liqPrice))
        await priceFeed.setPrice(liqPrice);
        // Confirm we are in Normal Mode
        assert.isFalse(await troveManager.checkRecoveryMode(liqPrice));

        const liquidationTx = await troveManager.liquidate(bobTroveId);
        assert.isFalse(await sortedTroves.contains(bobTroveId));

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx);

        // --- TEST ---
        const collChange = th.toBN(0);
        const debtChange = th.toBN(dec(100, 18));
        const newTCR = await borrowerOperations.getNewTCRFromTroveChange(
          collChange,
          true,
          debtChange,
          true,
          liqPrice,
        );

        const expectedTCR = whaleColl
          .add(liquidatedColl)
          .mul(liqPrice)
          .div(whaleTotalDebt.add(liquidatedDebt).add(debtChange));

        assert.isTrue(newTCR.eq(expectedTCR));
      });

      // 0, -ve
      it("collChange = 0, debtChange is negative", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const bobColl = toBN(dec(1000, "ether"));
        const whaleColl = toBN(dec(10000, "ether"));
        const bobTotalDebt = toBN(dec(100000, 18));
        const whaleTotalDebt = toBN(dec(2000, 18));
        const bobBoldAmount = await getOpenTroveBoldAmount(bobTotalDebt);
        const whaleBoldAmount = await getOpenTroveBoldAmount(whaleTotalDebt);

        await th.openTroveWrapper(contracts, th._100pct, whaleBoldAmount, whale, whale, 0, {
          from: whale,
          value: whaleColl,
        });

        const bobTroveId = await th.openTroveWrapper(contracts, th._100pct, bobBoldAmount, bob, bob, 0, {
          from: bob,
          value: bobColl,
        });

        const liqPrice = th.toBN(dec(100, 18));
        // th.logBN("Bob ICR before liq", await troveManager.getCurrentICR(bob, liqPrice))
        await priceFeed.setPrice(liqPrice);
        // Confirm we are in Normal Mode
        assert.isFalse(await troveManager.checkRecoveryMode(liqPrice));

        const liquidationTx = await troveManager.liquidate(bobTroveId);
        assert.isFalse(await sortedTroves.contains(bobTroveId));

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx);

        // --- TEST ---
        const collChange = th.toBN(0);
        const debtChange = th.toBN(dec(100, 18));
        const newTCR = await borrowerOperations.getNewTCRFromTroveChange(
          collChange,
          true,
          debtChange,
          false,
          liqPrice,
        );

        const expectedTCR = whaleColl
          .add(liquidatedColl)
          .mul(liqPrice)
          .div(whaleTotalDebt.add(liquidatedDebt).sub(debtChange));

        assert.isTrue(newTCR.eq(expectedTCR));
      });

      // +ve, 0
      it("collChange is positive, debtChange = 0", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const bobColl = toBN(dec(1000, "ether"));
        const whaleColl = toBN(dec(10000, "ether"));
        const bobTotalDebt = toBN(dec(100000, 18));
        const whaleTotalDebt = toBN(dec(2000, 18));
        const bobBoldAmount = await getOpenTroveBoldAmount(bobTotalDebt);
        const whaleBoldAmount = await getOpenTroveBoldAmount(whaleTotalDebt);

        await th.openTroveWrapper(contracts, th._100pct, whaleBoldAmount, whale, whale, 0, {
          from: whale,
          value: whaleColl,
        });
        const bobTroveId = await th.openTroveWrapper(contracts, th._100pct, bobBoldAmount, bob, bob, 0, {
          from: bob,
          value: bobColl,
        });

        const liqPrice = th.toBN(dec(100, 18));
        // th.logBN("Bob ICR before liq", await troveManager.getCurrentICR(bob, liqPrice))
        await priceFeed.setPrice(liqPrice);
        // Confirm we are in Normal Mode
        assert.isFalse(await troveManager.checkRecoveryMode(liqPrice));

        const liquidationTx = await troveManager.liquidate(bobTroveId);
        assert.isFalse(await sortedTroves.contains(bobTroveId));

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx);

        // --- TEST ---
        const collChange = th.toBN(dec(100, 18));
        const debtChange = th.toBN(0);
        const newTCR = await borrowerOperations.getNewTCRFromTroveChange(
          collChange,
          true,
          debtChange,
          true,
          liqPrice,
        );

        const expectedTCR = whaleColl
          .add(liquidatedColl).add(collChange)
          .mul(liqPrice)
          .div(whaleTotalDebt.add(liquidatedDebt));

        assert.isTrue(newTCR.eq(expectedTCR));
      });

      // -ve, 0
      it("collChange is negative, debtChange = 0", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const bobColl = toBN(dec(1000, "ether"));
        const whaleColl = toBN(dec(10000, "ether"));
        const bobTotalDebt = toBN(dec(100000, 18));
        const whaleTotalDebt = toBN(dec(2000, 18));
        const bobBoldAmount = await getOpenTroveBoldAmount(bobTotalDebt);
        const whaleBoldAmount = await getOpenTroveBoldAmount(whaleTotalDebt);

        await th.openTroveWrapper(contracts, th._100pct, whaleBoldAmount, whale, whale, 0, {
          from: whale,
          value: whaleColl,
        });

        const bobTroveId = await th.openTroveWrapper(contracts, th._100pct, bobBoldAmount, bob, bob, 0, {
          from: bob,
          value: bobColl,
        });

        const liqPrice = th.toBN(dec(100, 18));
        // th.logBN("Bob ICR before liq", await troveManager.getCurrentICR(bob, liqPrice))
        await priceFeed.setPrice(liqPrice);
        // Confirm we are in Normal Mode
        assert.isFalse(await troveManager.checkRecoveryMode(liqPrice));

        const liquidationTx = await troveManager.liquidate(bobTroveId);
        assert.isFalse(await sortedTroves.contains(bobTroveId));

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx);

        // --- TEST ---
        const collChange = th.toBN(dec(100, 18));
        const debtChange = th.toBN(0);
        const newTCR = await borrowerOperations.getNewTCRFromTroveChange(
          collChange,
          false,
          debtChange,
          true,
          liqPrice,
        );

        const expectedTCR = whaleColl
          .add(liquidatedColl).sub(collChange)
          .mul(liqPrice)
          .div(whaleTotalDebt.add(liquidatedDebt));

        assert.isTrue(newTCR.eq(expectedTCR));
      });

      // -ve, -ve
      it("collChange is negative, debtChange is negative", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const bobColl = toBN(dec(1000, "ether"));
        const whaleColl = toBN(dec(10000, "ether"));
        const bobTotalDebt = toBN(dec(100000, 18));
        const whaleTotalDebt = toBN(dec(2000, 18));
        const bobBoldAmount = await getOpenTroveBoldAmount(bobTotalDebt);
        const whaleBoldAmount = await getOpenTroveBoldAmount(whaleTotalDebt);

        await th.openTroveWrapper(contracts, th._100pct, whaleBoldAmount, whale, whale, 0, {
          from: whale,
          value: whaleColl,
        });

        const bobTroveId = await th.openTroveWrapper(contracts, th._100pct, bobBoldAmount, bob, bob, 0, {
          from: bob,
          value: bobColl,
        });

        const liqPrice = th.toBN(dec(100, 18));
        // th.logBN("Bob ICR before liq", await troveManager.getCurrentICR(bob, liqPrice))
        await priceFeed.setPrice(liqPrice);
        // Confirm we are in Normal Mode
        assert.isFalse(await troveManager.checkRecoveryMode(liqPrice));

        const liquidationTx = await troveManager.liquidate(bobTroveId);
        assert.isFalse(await sortedTroves.contains(bobTroveId));

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx);

        // --- TEST ---
        const collChange = th.toBN(dec(100, 18));
        const debtChange = th.toBN(dec(100, 18));
        const newTCR = await borrowerOperations.getNewTCRFromTroveChange(
          collChange,
          false,
          debtChange,
          false,
          liqPrice,
        );

        const expectedTCR = whaleColl
          .add(liquidatedColl).sub(collChange)
          .mul(liqPrice)
          .div(whaleTotalDebt.add(liquidatedDebt).sub(debtChange));

        assert.isTrue(newTCR.eq(expectedTCR));
      });

      // +ve, +ve
      it("collChange is positive, debtChange is positive", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const bobColl = toBN(dec(1000, "ether"));
        const whaleColl = toBN(dec(10000, "ether"));
        const bobTotalDebt = toBN(dec(100000, 18));
        const whaleTotalDebt = toBN(dec(2000, 18));
        const bobBoldAmount = await getOpenTroveBoldAmount(bobTotalDebt);
        const whaleBoldAmount = await getOpenTroveBoldAmount(whaleTotalDebt);

        await th.openTroveWrapper(contracts, th._100pct, whaleBoldAmount, whale, whale, 0, {
          from: whale,
          value: whaleColl,
        });

        const bobTroveId = await th.openTroveWrapper(contracts, th._100pct, bobBoldAmount, bob, bob, 0, {
          from: bob,
          value: bobColl,
        });

        const liqPrice = th.toBN(dec(100, 18));
        // th.logBN("Bob ICR before liq", await troveManager.getCurrentICR(bob, liqPrice))
        await priceFeed.setPrice(liqPrice);
        // Confirm we are in Normal Mode
        assert.isFalse(await troveManager.checkRecoveryMode(liqPrice));

        const liquidationTx = await troveManager.liquidate(bobTroveId);
        assert.isFalse(await sortedTroves.contains(bobTroveId));

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx);

        // --- TEST ---
        const collChange = th.toBN(dec(100, 18));
        const debtChange = th.toBN(dec(100, 18));
        const newTCR = await borrowerOperations.getNewTCRFromTroveChange(
          collChange,
          true,
          debtChange,
          true,
          liqPrice,
        );

        const expectedTCR = whaleColl
          .add(liquidatedColl).add(collChange)
          .mul(liqPrice)
          .div(whaleTotalDebt.add(liquidatedDebt).add(debtChange));

        assert.isTrue(newTCR.eq(expectedTCR));
      });

      // +ve, -ve
      it("collChange is positive, debtChange is negative", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const bobColl = toBN(dec(1000, "ether"));
        const whaleColl = toBN(dec(10000, "ether"));
        const bobTotalDebt = toBN(dec(100000, 18));
        const whaleTotalDebt = toBN(dec(2000, 18));
        const bobBoldAmount = await getOpenTroveBoldAmount(bobTotalDebt);
        const whaleBoldAmount = await getOpenTroveBoldAmount(whaleTotalDebt);

        await th.openTroveWrapper(contracts, th._100pct, whaleBoldAmount, whale, whale, 0, {
          from: whale,
          value: whaleColl,
        });

        const bobTroveId = await th.openTroveWrapper(contracts, th._100pct, bobBoldAmount, bob, bob, 0, {
          from: bob,
          value: bobColl,
        });

        const liqPrice = th.toBN(dec(100, 18));
        // th.logBN("Bob ICR before liq", await troveManager.getCurrentICR(bob, liqPrice))
        await priceFeed.setPrice(liqPrice);
        // Confirm we are in Normal Mode
        assert.isFalse(await troveManager.checkRecoveryMode(liqPrice));

        const liquidationTx = await troveManager.liquidate(bobTroveId);
        assert.isFalse(await sortedTroves.contains(bobTroveId));

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx);

        // --- TEST ---
        const collChange = th.toBN(dec(100, 18));
        const debtChange = th.toBN(dec(100, 18));
        const newTCR = await borrowerOperations.getNewTCRFromTroveChange(
          collChange,
          true,
          debtChange,
          false,
          liqPrice,
        );

        const expectedTCR = whaleColl
          .add(liquidatedColl).add(collChange)
          .mul(liqPrice)
          .div(whaleTotalDebt.add(liquidatedDebt).sub(debtChange));

        assert.isTrue(newTCR.eq(expectedTCR));
      });

      // ive, +ve
      it("collChange is negative, debtChange is positive", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const bobColl = toBN(dec(1000, "ether"));
        const whaleColl = toBN(dec(10000, "ether"));
        const bobTotalDebt = toBN(dec(100000, 18));
        const whaleTotalDebt = toBN(dec(2000, 18));
        const bobBoldAmount = await getOpenTroveBoldAmount(bobTotalDebt);
        const whaleBoldAmount = await getOpenTroveBoldAmount(whaleTotalDebt);

        await th.openTroveWrapper(contracts, th._100pct, whaleBoldAmount, whale, whale, 0, {
          from: whale,
          value: whaleColl,
        });

        const bobTroveId = await th.openTroveWrapper(contracts, th._100pct, bobBoldAmount, bob, bob, 0, {
          from: bob,
          value: bobColl,
        });

        const liqPrice = th.toBN(dec(100, 18));
        // th.logBN("Bob ICR before liq", await troveManager.getCurrentICR(bob, liqPrice))
        await priceFeed.setPrice(liqPrice);
        // Confirm we are in Normal Mode
        assert.isFalse(await troveManager.checkRecoveryMode(liqPrice));

        const liquidationTx = await troveManager.liquidate(bobTroveId);
        assert.isFalse(await sortedTroves.contains(bobTroveId));

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx);

        // --- TEST ---
        const collChange = th.toBN(dec(100, 18));
        const debtChange = th.toBN(dec(100, 18));
        const newTCR = await borrowerOperations.getNewTCRFromTroveChange(
          collChange,
          false,
          debtChange,
          true,
          liqPrice,
        );

        const expectedTCR = whaleColl
          .add(liquidatedColl).sub(collChange)
          .mul(liqPrice)
          .div(whaleTotalDebt.add(liquidatedDebt).add(debtChange));

        assert.isTrue(newTCR.eq(expectedTCR));
      });
    });
  };

  testCorpus();
});

contract("Reset chain state", async (accounts) => {});

/* TODO:

 1) Test SortedList re-ordering by ICR. ICR ratio
 changes with addColl, withdrawColl, withdrawBold, repayBold, etc. Can split them up and put them with
 individual functions, or give ordering it's own 'describe' block.

 2)In security phase:
 -'Negative' tests for all the above functions.
 */
