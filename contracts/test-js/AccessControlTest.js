const { TestHelper: th } = require("../utils/testHelpers.js");
const { createDeployAndFundFixture } = require("../utils/testFixtures.js");
const TroveManagerTester = artifacts.require("TroveManagerTester");

const { dec, toBN } = th;

/* The majority of access control tests are contained in this file. However, tests for restrictions
on the Liquity admin address's capabilities during the first year are found in:

test/launchSequenceTest/DuringLockupPeriodTest.js */

// A TroveChange with all zeroes
const noChange = {
  appliedRedistBoldDebtGain: 0,
  appliedRedistCollGain: 0,
  collIncrease: 0,
  collDecrease: 0,
  debtIncrease: 0,
  debtDecrease: 0,
  newWeightedRecordedDebt: 0,
  oldWeightedRecordedDebt: 0,
  upfrontFee: 0,
  batchAccruedManagementFee: 0,
  newWeightedRecordedBatchManagementFee: 0,
  oldWeightedRecordedBatchManagementFee: 0,
};

contract(
  "Access Control: Liquity functions with the caller restricted to Liquity contract(s)",
  async (accounts) => {
    const fundedAccounts = accounts.slice(0, 10);

    const [owner, alice, bob, carol] = fundedAccounts;
    const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(
      997,
      1000,
    );

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
        await Promise.all(fundedAccounts.map(
          (account) =>
            th.openTrove(contracts, {
              extraBoldAmount: toBN(dec(20000, 18)),
              ICR: toBN(dec(2, 18)),
              extraParams: { from: account },
            }),
        ));
      },
    });

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

    describe("TroveManager", async (accounts) => {
      it("onOpenTrove(): reverts when called by an account that is not BorrowerOperations", async () => {
        // Attempt call from alice
        try {
          await troveManager.onOpenTrove(bob, th.addressToTroveId(bob), noChange, 0, { from: alice });
        } catch (err) {
          assert.include(err.message, "revert");
          // assert.include(err.message, "Caller is not the BorrowerOperations contract")
        }
      });

      it("onCloseTrove(): reverts when called by an account that is not BorrowerOperations", async () => {
        // Attempt call from alice
        try {
          await troveManager.onCloseTrove(th.addressToTroveId(bob), noChange, bob, 0, 0, { from: alice });
        } catch (err) {
          assert.include(err.message, "revert");
          // assert.include(err.message, "Caller is not the BorrowerOperations contract")
        }
      });

      it("onAdjustTroveInterestRate(): reverts when called by an account that is not BorrowerOperations", async () => {
        // Attempt call from alice
        try {
          await troveManager.onAdjustTroveInterestRate(th.addressToTroveId(bob), 0, 0, 0, noChange, { from: alice });
        } catch (err) {
          assert.include(err.message, "revert");
          // assert.include(err.message, "Caller is not the BorrowerOperations contract")
        }
      });

      it("onAdjustTrove(): reverts when called by an account that is not BorrowerOperations", async () => {
        // Attempt call from alice
        try {
          await troveManager.onAdjustTrove(th.addressToTroveId(bob), 0, 0, noChange, { from: alice });
        } catch (err) {
          assert.include(err.message, "revert");
          // assert.include(err.message, "Caller is not the BorrowerOperations contract")
        }
      });

      it("onApplyTroveInterest(): reverts when called by an account that is not BorrowerOperations", async () => {
        // Attempt call from alice
        try {
          await troveManager.onApplyTroveInterest(th.addressToTroveId(bob), 0, 0, noChange, { from: alice });
        } catch (err) {
          assert.include(err.message, "revert");
          // assert.include(err.message, "Caller is not the BorrowerOperations contract")
        }
      });

      it("setTroveStatusToActive(): reverts when called by an account that is not BorrowerOperations", async () => {
        // Attempt call from alice
        try {
          await troveManager.setTroveStatusToActive(th.addressToTroveId(bob), { from: alice });
        } catch (err) {
          assert.include(err.message, "revert");
          // assert.include(err.message, "Caller is not the BorrowerOperations contract")
        }
      });
    });

    describe("ActivePool", async (accounts) => {
      // sendColl
      it("sendColl(): reverts when called by an account that is not BO nor TroveM nor SP", async () => {
        // Attempt call from alice
        try {
          const txAlice = await activePool.sendColl(alice, 100, { from: alice });
        } catch (err) {
          assert.include(err.message, "revert");
          assert.include(
            err.message,
            "Caller is neither BorrowerOperations nor TroveManager nor StabilityPool",
          );
        }
      });

      // sendCollToDefaultPool
      it("sendCollToDefaultPool(): reverts when called by an account that is not TroveManager", async () => {
        // Attempt call from alice
        try {
          const txAlice = await activePool.sendCollToDefaultPool(100, { from: alice });
        } catch (err) {
          assert.include(err.message, "revert");
          assert.include(
            err.message,
            "ActivePool: Caller is not TroveManager",
          );
        }
      });

      // receiveColl (payment)
      it("receiveColl(): reverts when called by an account that is not Borrower Operations nor Default Pool", async () => {
        // Attempt call from alice
        try {
          await activePool.receiveColl(100, { from: alice });
        } catch (err) {
          assert.include(err.message, "revert");
          assert.include(
            err.message,
            "ActivePool: Caller is neither BO nor Default Pool",
          );
        }
      });
    });

    describe("DefaultPool", async (accounts) => {
      // sendCollToActivePool
      it("sendCollToActivePool(): reverts when called by an account that is not TroveManager", async () => {
        // Attempt call from alice
        try {
          const txAlice = await defaultPool.sendCollToActivePool(100, {
            from: alice,
          });
        } catch (err) {
          assert.include(err.message, "revert");
          assert.include(err.message, "Caller is not the TroveManager");
        }
      });

      // increaseBold
      it("increaseBoldDebt(): reverts when called by an account that is not TroveManager", async () => {
        // Attempt call from alice
        try {
          const txAlice = await defaultPool.increaseBoldDebt(100, {
            from: alice,
          });
        } catch (err) {
          assert.include(err.message, "revert");
          assert.include(err.message, "Caller is not the TroveManager");
        }
      });

      // decreaseBold
      it("decreaseBold(): reverts when called by an account that is not TroveManager", async () => {
        // Attempt call from alice
        try {
          const txAlice = await defaultPool.decreaseBoldDebt(100, {
            from: alice,
          });
        } catch (err) {
          assert.include(err.message, "revert");
          assert.include(err.message, "Caller is not the TroveManager");
        }
      });

      // receiveColl (payment)
      it("receiveColl(): reverts when called by an account that is not the Active Pool", async () => {
        // Attempt call from alice
        try {
          await defaultPool.receiveColl(100, { from: alice });
        } catch (err) {
          assert.include(err.message, "revert");
          assert.include(
            err.message,
            "DefaultPool: Caller is not the ActivePool",
          );
        }
      });
    });

    describe("StabilityPool", async (accounts) => {
      // --- onlyTroveManager ---

      // offset
      it("offset(): reverts when called by an account that is not TroveManager", async () => {
        // Attempt call from alice
        try {
          txAlice = await stabilityPool.offset(100, 10, { from: alice });
          assert.fail(txAlice);
        } catch (err) {
          assert.include(err.message, "revert");
          assert.include(err.message, "Caller is not TroveManager");
        }
      });
    });

    describe("BoldToken", async (accounts) => {
      //    mint
      it("mint(): reverts when called by an account that is not BorrowerOperations", async () => {
        // Attempt call from alice
        const txAlice = boldToken.mint(bob, 100, { from: alice });
        await th.assertRevert(txAlice, "Caller is not BorrowerOperations");
      });

      // burn
      it("burn(): reverts when called by an account that is not BO nor TroveM nor SP", async () => {
        // Attempt call from alice
        try {
          const txAlice = await boldToken.burn(bob, 100, { from: alice });
        } catch (err) {
          assert.include(err.message, "revert");
          // assert.include(err.message, "Caller is neither BorrowerOperations nor TroveManager nor StabilityPool")
        }
      });

      // sendToPool
      it("sendToPool(): reverts when called by an account that is not StabilityPool", async () => {
        // Attempt call from alice
        try {
          const txAlice = await boldToken.sendToPool(
            bob,
            activePool.address,
            100,
            { from: alice },
          );
        } catch (err) {
          assert.include(err.message, "revert");
          assert.include(err.message, "Caller is not the StabilityPool");
        }
      });

      // returnFromPool
      it("returnFromPool(): reverts when called by an account that is not TroveManager nor StabilityPool", async () => {
        // Attempt call from alice
        try {
          const txAlice = await boldToken.returnFromPool(
            activePool.address,
            bob,
            100,
            { from: alice },
          );
        } catch (err) {
          assert.include(err.message, "revert");
          // assert.include(err.message, "Caller is neither TroveManager nor StabilityPool")
        }
      });
    });

    describe("SortedTroves", async (accounts) => {
      // --- onlyBorrowerOperations ---
      //     insert
      it("insert(): reverts when called by an account that is not BorrowerOps", async () => {
        // Attempt call from alice
        try {
          const txAlice = await sortedTroves.insert(
            bob,
            "150000000000000000000",
            bob,
            bob,
            { from: alice },
          );
        } catch (err) {
          assert.include(err.message, "revert");
          assert.include(err.message, " Caller is not BorrowerOperations");
        }
      });

      // --- onlyTroveManager ---
      // remove
      it("remove(): reverts when called by an account that is not TroveManager", async () => {
        // Attempt call from alice
        try {
          const txAlice = await sortedTroves.remove(bob, { from: alice });
        } catch (err) {
          assert.include(err.message, "revert");
          assert.include(err.message, "SortedTroves: Caller is not BorrowerOperations nor TroveManager");
        }
      });

      // --- onlyTroveMorBM ---
      // reinsert
      it("reinsert(): reverts when called by an account that is not BorrowerOps", async () => {
        // Attempt call from alice
        try {
          const txAlice = await sortedTroves.reInsert(
            bob,
            "150000000000000000000",
            bob,
            bob,
            { from: alice },
          );
        } catch (err) {
          assert.include(err.message, "revert");
          assert.include(err.message, "Caller is not BorrowerOperations");
        }
      });
    });
  },
);
