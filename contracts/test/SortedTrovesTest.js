const deploymentHelper = require("../utils/deploymentHelpers.js");
const { fundAccounts } = require("../utils/fundAccounts.js");
const testHelpers = require("../utils/testHelpers.js");

const SortedTroves = artifacts.require("SortedTroves");
const SortedTrovesTester = artifacts.require("SortedTrovesTester");
const TroveManagerTester = artifacts.require("TroveManagerTester");
const BoldToken = artifacts.require("BoldToken");

const th = testHelpers.TestHelper;
const dec = th.dec;
const toBN = th.toBN;

contract("SortedTroves", async (accounts) => {
  const assertSortedListIsOrdered = async (contracts) => {
    const price = await contracts.priceFeedTestnet.getPrice();

    let trove = await contracts.sortedTroves.getLast();
    while (trove !== (await contracts.sortedTroves.getFirst())) {
      // Get the adjacent upper trove ("prev" moves up the list, from lower ICR -> higher ICR)
      const prevTrove = await contracts.sortedTroves.getPrev(trove);

      const troveICR = await contracts.troveManager.getCurrentICR(trove, price);
      const prevTroveICR = await contracts.troveManager.getCurrentICR(
        prevTrove,
        price
      );

      assert.isTrue(prevTroveICR.gte(troveICR));

      const troveNICR = await contracts.troveManager.getNominalICR(trove);
      const prevTroveNICR = await contracts.troveManager.getNominalICR(
        prevTrove
      );

      assert.isTrue(prevTroveNICR.gte(troveNICR));

      // climb the list
      trove = prevTrove;
    }
  };

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
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H,
    I,
    J,
    whale,
  ] = accounts;

  let priceFeed;
  let sortedTroves;
  let troveManager;
  let borrowerOperations;
  let boldToken;

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000);

  let contracts;

  const openTrove = async (params) => th.openTrove(contracts, params);

  describe("SortedTroves", () => {
    beforeEach(async () => {
      contracts = await deploymentHelper.deployLiquityCore();
      contracts.troveManager = await TroveManagerTester.new();
      contracts.boldToken = await BoldToken.new(
        contracts.troveManager.address,
        contracts.stabilityPool.address,
        contracts.borrowerOperations.address
      );

      priceFeed = contracts.priceFeedTestnet;
      sortedTroves = contracts.sortedTroves;
      troveManager = contracts.troveManager;
      borrowerOperations = contracts.borrowerOperations;
      boldToken = contracts.boldToken;

      await deploymentHelper.connectCoreContracts(contracts);

      await fundAccounts(
        [
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
          A,
          B,
          C,
          D,
          E,
          F,
          G,
          H,
          I,
          J,
          whale,
          bountyAddress,
          lpRewardsAddress,
          multisig,
        ],
        contracts.WETH
      );
    });

    it("contains(): returns true for addresses that have opened troves", async () => {
      await openTrove({
        ICR: toBN(dec(150, 16)),
        extraParams: { from: alice },
      });
      await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: bob } });
      await openTrove({
        ICR: toBN(dec(2000, 18)),
        extraParams: { from: carol },
      });

      // Confirm trove statuses became active
      assert.equal((await troveManager.Troves(alice))[3], "1");
      assert.equal((await troveManager.Troves(bob))[3], "1");
      assert.equal((await troveManager.Troves(carol))[3], "1");

      // Check sorted list contains troves
      assert.isTrue(await sortedTroves.contains(alice));
      assert.isTrue(await sortedTroves.contains(bob));
      assert.isTrue(await sortedTroves.contains(carol));
    });

    it("contains(): returns false for addresses that have not opened troves", async () => {
      await openTrove({
        ICR: toBN(dec(150, 16)),
        extraParams: { from: alice },
      });
      await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: bob } });
      await openTrove({
        ICR: toBN(dec(2000, 18)),
        extraParams: { from: carol },
      });

      // Confirm troves have non-existent status
      assert.equal((await troveManager.Troves(dennis))[3], "0");
      assert.equal((await troveManager.Troves(erin))[3], "0");

      // Check sorted list do not contain troves
      assert.isFalse(await sortedTroves.contains(dennis));
      assert.isFalse(await sortedTroves.contains(erin));
    });

    it("contains(): returns false for addresses that opened and then closed a trove", async () => {
      await openTrove({
        ICR: toBN(dec(1000, 18)),
        extraBoldAmount: toBN(dec(3000, 18)),
        extraParams: { from: whale },
      });

      await openTrove({
        ICR: toBN(dec(150, 16)),
        extraParams: { from: alice },
      });
      await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: bob } });
      await openTrove({
        ICR: toBN(dec(2000, 18)),
        extraParams: { from: carol },
      });

      // to compensate borrowing fees
      await boldToken.transfer(alice, dec(1000, 18), { from: whale });
      await boldToken.transfer(bob, dec(1000, 18), { from: whale });
      await boldToken.transfer(carol, dec(1000, 18), { from: whale });

      // A, B, C close troves
      await borrowerOperations.closeTrove({ from: alice });
      await borrowerOperations.closeTrove({ from: bob });
      await borrowerOperations.closeTrove({ from: carol });

      // Confirm trove statuses became closed
      assert.equal((await troveManager.Troves(alice))[3], "2");
      assert.equal((await troveManager.Troves(bob))[3], "2");
      assert.equal((await troveManager.Troves(carol))[3], "2");

      // Check sorted list does not contain troves
      assert.isFalse(await sortedTroves.contains(alice));
      assert.isFalse(await sortedTroves.contains(bob));
      assert.isFalse(await sortedTroves.contains(carol));
    });

    // true for addresses that opened -> closed -> opened a trove
    it("contains(): returns true for addresses that opened, closed and then re-opened a trove", async () => {
      await openTrove({
        ICR: toBN(dec(1000, 18)),
        extraBoldAmount: toBN(dec(3000, 18)),
        extraParams: { from: whale },
      });

      await openTrove({
        ICR: toBN(dec(150, 16)),
        extraParams: { from: alice },
      });
      await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: bob } });
      await openTrove({
        ICR: toBN(dec(2000, 18)),
        extraParams: { from: carol },
      });

      // to compensate borrowing fees
      await boldToken.transfer(alice, dec(1000, 18), { from: whale });
      await boldToken.transfer(bob, dec(1000, 18), { from: whale });
      await boldToken.transfer(carol, dec(1000, 18), { from: whale });

      // A, B, C close troves
      await borrowerOperations.closeTrove({ from: alice });
      await borrowerOperations.closeTrove({ from: bob });
      await borrowerOperations.closeTrove({ from: carol });

      // Confirm trove statuses became closed
      assert.equal((await troveManager.Troves(alice))[3], "2");
      assert.equal((await troveManager.Troves(bob))[3], "2");
      assert.equal((await troveManager.Troves(carol))[3], "2");

      await openTrove({
        ICR: toBN(dec(1000, 16)),
        extraParams: { from: alice },
      });
      await openTrove({ ICR: toBN(dec(2000, 18)), extraParams: { from: bob } });
      await openTrove({
        ICR: toBN(dec(3000, 18)),
        extraParams: { from: carol },
      });

      // Confirm trove statuses became open again
      assert.equal((await troveManager.Troves(alice))[3], "1");
      assert.equal((await troveManager.Troves(bob))[3], "1");
      assert.equal((await troveManager.Troves(carol))[3], "1");

      // Check sorted list does  contain troves
      assert.isTrue(await sortedTroves.contains(alice));
      assert.isTrue(await sortedTroves.contains(bob));
      assert.isTrue(await sortedTroves.contains(carol));
    });

    // false when list size is 0
    it("contains(): returns false when there are no troves in the system", async () => {
      assert.isFalse(await sortedTroves.contains(alice));
      assert.isFalse(await sortedTroves.contains(bob));
      assert.isFalse(await sortedTroves.contains(carol));
    });

    // true when list size is 1 and the trove the only one in system
    it("contains(): true when list size is 1 and the trove the only one in system", async () => {
      await openTrove({
        ICR: toBN(dec(150, 16)),
        extraParams: { from: alice },
      });

      assert.isTrue(await sortedTroves.contains(alice));
    });

    // false when list size is 1 and trove is not in the system
    it("contains(): false when list size is 1 and trove is not in the system", async () => {
      await openTrove({
        ICR: toBN(dec(150, 16)),
        extraParams: { from: alice },
      });

      assert.isFalse(await sortedTroves.contains(bob));
    });

    // --- getMaxSize ---

    it("getMaxSize(): Returns the maximum list size", async () => {
      const max = await sortedTroves.getMaxSize();
      assert.equal(web3.utils.toHex(max), th.maxBytes32);
    });

    // --- findInsertPosition ---

    it("Finds the correct insert position given two addresses that loosely bound the correct position", async () => {
      await priceFeed.setPrice(dec(100, 18));

      //  Inserted in descending order of interest rate
      await openTrove({
        ICR: toBN(dec(500, 18)),
        extraParams: { from: whale },
      });
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: A, annualInterestRate: toBN(dec(1,18))}}); // 100% interest rate
      await openTrove({ ICR: toBN(dec(5, 18)), extraParams: { from: B , annualInterestRate: toBN(dec(75, 16))}}); // 75% interest rate
      await openTrove({ ICR: toBN(dec(250, 16)), extraParams: { from: C, annualInterestRate: toBN(dec(5, 17))}}); // 50% interest rate
      await openTrove({ ICR: toBN(dec(166, 16)), extraParams: { from: D, annualInterestRate: toBN(dec(25,16))}}); // 25% interest rate
      await openTrove({ ICR: toBN(dec(125, 16)), extraParams: { from: E, annualInterestRate: toBN(dec(1, 16))}}); // 1% interest rate

      // Expect a trove with 60% interest rate to be inserted between B and C
      const targetAnnualIRate = toBN(dec(60, 16));

      // Pass addresses that loosely bound the right postiion
      const hints = await sortedTroves.findInsertPosition(targetAnnualIRate, A, E);

      // Expect the exact correct insert hints have been returned
      assert.equal(hints[0], B);
      assert.equal(hints[1], C);

      // The price doesn’t affect the hints
      await priceFeed.setPrice(dec(500, 18));
      const hints2 = await sortedTroves.findInsertPosition(targetAnnualIRate, A, E);

      // Expect the exact correct insert hints have been returned
      assert.equal(hints2[0], B);
      assert.equal(hints2[1], C);
    });
  });

  describe("SortedTroves with mock dependencies", () => {
    let sortedTrovesTester; 

    beforeEach(async () => {
      sortedTroves = await SortedTroves.new();
      sortedTrovesTester = await SortedTrovesTester.new();

      await sortedTrovesTester.setSortedTroves(sortedTroves.address);
    });

    context("when params are wrongly set", () => {
      it("setParams(): reverts if size is zero", async () => {
        await th.assertRevert(
          sortedTroves.setParams(
            0,
            // The SortedTrovesTester is being used here as both a wrapper for SortedTroves and a mock TroveManager.
            sortedTrovesTester.address,
            sortedTrovesTester.address
          ),
          "SortedTroves: Size can’t be zero"
        );
      });
    });

    context("when params are properly set", () => {
      beforeEach("set params", async () => {
        await sortedTroves.setParams(
          2,
          sortedTrovesTester.address,
          sortedTrovesTester.address
        );
      });

      it("insert(): fails if list is full", async () => {
        await sortedTrovesTester.insert(alice, 1, alice, alice);
        await sortedTrovesTester.insert(bob, 1, alice, alice);
        await th.assertRevert(
          sortedTrovesTester.insert(carol, 1, alice, alice),
          "SortedTroves: List is full"
        );
      });

      it("insert(): fails if list already contains the node", async () => {
        await sortedTrovesTester.insert(alice, 1, alice, alice);
        await th.assertRevert(
          sortedTrovesTester.insert(alice, 1, alice, alice),
          "SortedTroves: List already contains the node"
        );
      });

      it("insert(): fails if id is zero", async () => {
        await th.assertRevert(
          sortedTrovesTester.insert(th.ZERO_ADDRESS, 1, alice, alice),
          "SortedTroves: Id cannot be zero"
        );
      });

      it("remove(): fails if id is not in the list", async () => {
        await th.assertRevert(
          sortedTrovesTester.remove(alice),
          "SortedTroves: List does not contain the id"
        );
      });

      it("reInsert(): fails if list doesn’t contain the node", async () => {
        await th.assertRevert(
          sortedTrovesTester.reInsert(alice, 1, alice, alice),
          "SortedTroves: List does not contain the id"
        );
      });

      it("findInsertPosition(): No prevId for hint - ascend list starting from nextId, result is after the tail", async () => {
        await sortedTrovesTester.insert(alice, 1, alice, alice);
        const pos = await sortedTroves.findInsertPosition(
          1,
          th.ZERO_ADDRESS,
          alice
        );
        assert.equal(pos[0], alice, "prevId result should be nextId param");
        assert.equal(pos[1], th.ZERO_ADDRESS, "nextId result should be zero");
      });
    });
  });
});
