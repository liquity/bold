const { TestHelper: th } = require("../utils/testHelpers.js");
const { createDeployAndFundFixture } = require("../utils/testFixtures.js");

const SortedTroves = artifacts.require("SortedTroves");
const SortedTrovesTester = artifacts.require("SortedTrovesTester");
const TroveManagerTester = artifacts.require("TroveManagerTester");

const { dec, toBN } = th;

contract("SortedTroves", async (accounts) => {
  const fundedAccounts = accounts.slice(0, 28);

  const assertSortedListIsOrdered = async (contracts) => {
    const price = await contracts.priceFeedTestnet.getPrice();

    let trove = await contracts.sortedTroves.getLast();
    while (trove !== (await contracts.sortedTroves.getFirst())) {
      // Get the adjacent upper trove ("prev" moves up the list, from lower ICR -> higher ICR)
      const prevTrove = await contracts.sortedTroves.getPrev(trove);

      const troveICR = await contracts.troveManager.getCurrentICR(trove, price);
      const prevTroveICR = await contracts.troveManager.getCurrentICR(
        prevTrove,
        price,
      );

      assert.isTrue(prevTroveICR.gte(troveICR));

      const troveNICR = await contracts.troveManager.getNominalICR(trove);
      const prevTroveNICR = await contracts.troveManager.getNominalICR(
        prevTrove,
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
  ] = fundedAccounts;

  let priceFeed;
  let sortedTroves;
  let troveManager;
  let borrowerOperations;
  let boldToken;

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000);

  let contracts;

  const deployFixture = createDeployAndFundFixture({
    accounts: fundedAccounts,
    mocks: { TroveManager: TroveManagerTester },
  });

  const openTrove = async (params) => th.openTrove(contracts, params);

  describe("SortedTroves", () => {
    beforeEach(async () => {
      const result = await deployFixture();
      contracts = result.contracts;
      priceFeed = contracts.priceFeedTestnet;
      sortedTroves = contracts.sortedTroves;
      troveManager = contracts.troveManager;
      borrowerOperations = contracts.borrowerOperations;
      boldToken = contracts.boldToken;
    });

    it("contains(): returns true for addresses that have opened troves", async () => {
      const { troveId: aliceTroveId } = await openTrove({
        ICR: toBN(dec(150, 16)),
        extraParams: { from: alice },
      });
      const { troveId: bobTroveId } = await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: bob } });
      const { troveId: carolTroveId } = await openTrove({
        ICR: toBN(dec(2000, 18)),
        extraParams: { from: carol },
      });

      // Confirm trove statuses became active
      assert.equal((await troveManager.Troves(aliceTroveId))[3], "1");
      assert.equal((await troveManager.Troves(bobTroveId))[3], "1");
      assert.equal((await troveManager.Troves(carolTroveId))[3], "1");

      // Check sorted list contains troves
      assert.isTrue(await sortedTroves.contains(aliceTroveId));
      assert.isTrue(await sortedTroves.contains(bobTroveId));
      assert.isTrue(await sortedTroves.contains(carolTroveId));
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

      const { troveId: aliceTroveId } = await openTrove({
        ICR: toBN(dec(150, 16)),
        extraParams: { from: alice },
      });
      const { troveId: bobTroveId } = await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: bob } });
      const { troveId: carolTroveId } = await openTrove({
        ICR: toBN(dec(2000, 18)),
        extraParams: { from: carol },
      });

      // to compensate borrowing fees
      await boldToken.transfer(alice, dec(1000, 18), { from: whale });
      await boldToken.transfer(bob, dec(1000, 18), { from: whale });
      await boldToken.transfer(carol, dec(1000, 18), { from: whale });

      // A, B, C close troves
      await borrowerOperations.closeTrove(aliceTroveId, { from: alice });
      await borrowerOperations.closeTrove(bobTroveId, { from: bob });
      await borrowerOperations.closeTrove(carolTroveId, { from: carol });

      // Confirm trove statuses became closed
      assert.equal((await troveManager.Troves(aliceTroveId))[3], "2");
      assert.equal((await troveManager.Troves(bobTroveId))[3], "2");
      assert.equal((await troveManager.Troves(carolTroveId))[3], "2");

      // Check sorted list does not contain troves
      assert.isFalse(await sortedTroves.contains(aliceTroveId));
      assert.isFalse(await sortedTroves.contains(bobTroveId));
      assert.isFalse(await sortedTroves.contains(carolTroveId));
    });

    // true for addresses that opened -> closed -> opened a trove
    it("contains(): returns true for addresses that opened, closed and then re-opened a trove", async () => {
      await openTrove({
        ICR: toBN(dec(1000, 18)),
        extraBoldAmount: toBN(dec(3000, 18)),
        extraParams: { from: whale },
      });

      const { troveId: aliceTroveId } = await openTrove({
        ICR: toBN(dec(150, 16)),
        extraParams: { from: alice },
      });
      const { troveId: bobTroveId } = await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: bob } });
      const { troveId: carolTroveId } = await openTrove({
        ICR: toBN(dec(2000, 18)),
        extraParams: { from: carol },
      });

      // to compensate borrowing fees
      await boldToken.transfer(alice, dec(1000, 18), { from: whale });
      await boldToken.transfer(bob, dec(1000, 18), { from: whale });
      await boldToken.transfer(carol, dec(1000, 18), { from: whale });

      // A, B, C close troves
      await borrowerOperations.closeTrove(aliceTroveId, { from: alice });
      await borrowerOperations.closeTrove(bobTroveId, { from: bob });
      await borrowerOperations.closeTrove(carolTroveId, { from: carol });

      // Confirm trove statuses became closed
      assert.equal((await troveManager.Troves(aliceTroveId))[3], "2");
      assert.equal((await troveManager.Troves(bobTroveId))[3], "2");
      assert.equal((await troveManager.Troves(carolTroveId))[3], "2");

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
      assert.equal((await troveManager.Troves(aliceTroveId))[3], "1");
      assert.equal((await troveManager.Troves(bobTroveId))[3], "1");
      assert.equal((await troveManager.Troves(carolTroveId))[3], "1");

      // Check sorted list does  contain troves
      assert.isTrue(await sortedTroves.contains(aliceTroveId));
      assert.isTrue(await sortedTroves.contains(bobTroveId));
      assert.isTrue(await sortedTroves.contains(carolTroveId));
    });

    // false when list size is 0
    it("contains(): returns false when there are no troves in the system", async () => {
      assert.isFalse(await sortedTroves.contains(th.addressToTroveId(alice)));
      assert.isFalse(await sortedTroves.contains(th.addressToTroveId(bob)));
      assert.isFalse(await sortedTroves.contains(th.addressToTroveId(carol)));
    });

    // true when list size is 1 and the trove the only one in system
    it("contains(): true when list size is 1 and the trove the only one in system", async () => {
      const { troveId: aliceTroveId } = await openTrove({
        ICR: toBN(dec(150, 16)),
        extraParams: { from: alice },
      });

      assert.isTrue(await sortedTroves.contains(aliceTroveId));
    });

    // false when list size is 1 and trove is not in the system
    it("contains(): false when list size is 1 and trove is not in the system", async () => {
      await openTrove({
        ICR: toBN(dec(150, 16)),
        extraParams: { from: alice },
      });

      assert.isFalse(await sortedTroves.contains(th.addressToTroveId(bob)));
    });

    // --- findInsertPosition ---

    it("Finds the correct insert position given two addresses that loosely bound the correct position", async () => {
      await priceFeed.setPrice(dec(100, 18));

      //  Inserted in descending order of interest rate
      await openTrove({
        ICR: toBN(dec(500, 18)),
        extraParams: { from: whale },
      });
      const { troveId: ATroveId } = await openTrove({
        ICR: toBN(dec(10, 18)),
        extraParams: { from: A, annualInterestRate: toBN(dec(1, 18)) },
      }); // 100% interest rate
      const { troveId: BTroveId } = await openTrove({
        ICR: toBN(dec(5, 18)),
        extraParams: { from: B, annualInterestRate: toBN(dec(75, 16)) },
      }); // 75% interest rate
      const { troveId: CTroveId } = await openTrove({
        ICR: toBN(dec(250, 16)),
        extraParams: { from: C, annualInterestRate: toBN(dec(5, 17)) },
      }); // 50% interest rate
      await openTrove({ ICR: toBN(dec(166, 16)), extraParams: { from: D, annualInterestRate: toBN(dec(25, 16)) } }); // 25% interest rate
      const { troveId: ETroveId } = await openTrove({
        ICR: toBN(dec(125, 16)),
        extraParams: { from: E, annualInterestRate: toBN(dec(1, 16)) },
      }); // 1% interest rate

      // Expect a trove with 60% interest rate to be inserted between B and C
      const targetAnnualIRate = toBN(dec(60, 16));

      // Pass addresses that loosely bound the right postiion
      const hints = await sortedTroves.findInsertPosition(targetAnnualIRate, ATroveId, ETroveId);

      // Expect the exact correct insert hints have been returned
      assert.isTrue(hints[0].eq(toBN(BTroveId)));
      assert.isTrue(hints[1].eq(toBN(CTroveId)));

      // The price doesn’t affect the hints
      await priceFeed.setPrice(dec(500, 18));
      const hints2 = await sortedTroves.findInsertPosition(targetAnnualIRate, ATroveId, ETroveId);

      // Expect the exact correct insert hints have been returned
      assert.isTrue(hints2[0].eq(BTroveId));
      assert.isTrue(hints2[1].eq(CTroveId));
    });
  });

  describe("SortedTroves with mock dependencies", () => {
    let sortedTrovesTester;

    beforeEach(async () => {
      sortedTroves = await SortedTroves.new();
      sortedTrovesTester = await SortedTrovesTester.new();

      await sortedTrovesTester.setSortedTroves(sortedTroves.address);
    });

    context("when params are properly set", () => {
      beforeEach("set addresses", async () => {
        await sortedTroves.setAddresses(
          sortedTrovesTester.address,
          sortedTrovesTester.address,
        );
      });

      it("insert(): fails if list already contains the node", async () => {
        await sortedTrovesTester.insert(alice, 1, alice, alice);
        await th.assertRevert(
          sortedTrovesTester.insert(alice, 1, alice, alice),
          "SortedTroves: List already contains the node",
        );
      });

      it("insert(): fails if id is zero", async () => {
        await th.assertRevert(
          sortedTrovesTester.insert(toBN(0), 1, alice, alice),
          "SortedTroves: Id cannot be zero",
        );
      });

      it("remove(): fails if id is not in the list", async () => {
        await th.assertRevert(
          sortedTrovesTester.remove(th.addressToTroveId(alice)),
          "SortedTroves: List does not contain the id",
        );
      });

      it("reInsert(): fails if list doesn’t contain the node", async () => {
        await th.assertRevert(
          sortedTrovesTester.reInsert(
            th.addressToTroveId(alice),
            1,
            th.addressToTroveId(alice),
            th.addressToTroveId(alice),
          ),
          "SortedTroves: List does not contain the id",
        );
      });

      // danielattilasimon: I believe this test was reinforcing questionable behavior.
      // The initial position (0, alice) _is_ already a valid insert position for the given list
      // (which happens to contain only alice), so why are we expecting findInsertPosition() to
      // move away from such a position?
      //
      // it("findInsertPosition(): No prevId for hint - ascend list starting from nextId, result is after the tail", async () => {
      //   await sortedTrovesTester.insert(th.addressToTroveId(alice), 1, th.addressToTroveId(alice), th.addressToTroveId(alice));
      //   const pos = await sortedTroves.findInsertPosition(
      //     1,
      //     toBN(0),
      //     th.addressToTroveId(alice)
      //   );
      //   assert.isTrue(pos[0].eq(toBN(th.addressToTroveId(alice))), "prevId result should be nextId param");
      //   assert.isTrue(pos[1].eq(toBN(0)), "nextId result should be zero");
      // });
    });
  });
});
